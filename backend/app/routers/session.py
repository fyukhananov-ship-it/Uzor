"""Anonymous session endpoints — wow-screen бэкенд лендинга (PRD §6.1, Прил. Б).

POST /session — создать сессию: рассчитать нумерологию, сгенерировать
наблюдения через Claude (или fallback), сохранить в anonymous_sessions
с TTL 7 дней. Возвращает токен + наблюдения для рендеринга wow-экрана.

GET /session/{token} — прочитать ранее созданную сессию (используется
для shared compatibility page и для resume-flow когда пользователь
устанавливает Android-приложение через Install Referrer).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db
from app.llm import generate_observations
from app.models import AnonymousSession
from app.numerology import pair_context_of
from app.observations import Observation
from app.schemas import (
    NumerologyOut,
    ObservationOut,
    PairContextOut,
    SessionCreateIn,
    SessionOut,
)

router = APIRouter(tags=["session"])

ANONYMOUS_SESSION_TTL = timedelta(days=7)


def _serialize(
    session_token: uuid.UUID,
    payload: SessionCreateIn,
    observations: list[Observation],
    context_obj,
    created_at: datetime,
    expires_at: datetime,
) -> SessionOut:
    return SessionOut(
        token=session_token,
        birth_date_user=payload.birth_date_user,
        birth_date_partner=payload.birth_date_partner,
        observations=[
            ObservationOut(kind=o.kind, text=o.text) for o in observations
        ],
        context=PairContextOut(
            user=NumerologyOut(
                life_path=context_obj.user.life_path,
                personal_year=context_obj.user.personal_year,
                personal_month=context_obj.user.personal_month,
                personal_day=context_obj.user.personal_day,
            ),
            partner=NumerologyOut(
                life_path=context_obj.partner.life_path,
                personal_year=context_obj.partner.personal_year,
                personal_month=context_obj.partner.personal_month,
                personal_day=context_obj.partner.personal_day,
            ),
            pair_cycle=context_obj.pair_cycle,
            friction=context_obj.friction.value,
            date=context_obj.date,
        ),
        created_at=created_at,
        expires_at=expires_at,
    )


@router.post(
    "/session",
    response_model=SessionOut,
    response_model_by_alias=True,  # отдаём camelCase для совместимости с TS-клиентом
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    payload: SessionCreateIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionOut:
    context = pair_context_of(payload.birth_date_user, payload.birth_date_partner)

    new_token = uuid.uuid4()

    # AIGenerationLog ссылается на anonymous_sessions.token, поэтому сначала
    # создаём пустую запись сессии, генерируем наблюдения (с логом), потом
    # обновляем pair_mini_analysis. Так FK всегда валиден.
    now = datetime.now(UTC)
    expires = now + ANONYMOUS_SESSION_TTL

    birth_user_iso = payload.birth_date_user.isoformat()
    birth_partner_iso = payload.birth_date_partner.isoformat()

    result = await generate_observations(
        db,
        birth_user=birth_user_iso,
        birth_partner=birth_partner_iso,
        context=context,
        anonymous_session_token=new_token,
    )

    payload_dict = _serialize(
        session_token=new_token,
        payload=payload,
        observations=result.observations,
        context_obj=context,
        created_at=now,
        expires_at=expires,
    ).model_dump(mode="json", by_alias=True)

    session_row = AnonymousSession(
        token=new_token,
        birth_date_user=payload.birth_date_user,
        birth_date_partner=payload.birth_date_partner,
        pair_mini_analysis=payload_dict,
        created_at=now,
        expires_at=expires,
    )
    db.add(session_row)
    await db.flush()

    return _serialize(
        session_token=new_token,
        payload=payload,
        observations=result.observations,
        context_obj=context,
        created_at=now,
        expires_at=expires,
    )


@router.get("/session/{token}", response_model=SessionOut, response_model_by_alias=True)
async def get_session(
    token: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SessionOut:
    session = await db.get(AnonymousSession, token)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session_not_found")

    # TTL валидируем на чтении: фоновую очистку Postgres не делает,
    # cron-job на это поднимем отдельно (PRD §13.10).
    now = datetime.now(UTC)
    expires = session.expires_at
    # SQLite хранит datetime без tz — нормализуем к UTC перед сравнением.
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= now:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session_expired")

    return SessionOut.model_validate(session.pair_mini_analysis)
