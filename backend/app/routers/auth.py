"""Auth endpoints: magic link → JWT pair (PRD §13.9).

Google и Yandex OAuth — TODO (нужны реальные client-id для интеграционного
теста). Magic link достаточен для MVP: лендинг и Android могут сразу
запускать /auth/magic/request, в dev-режиме токен возвращается в ответе
вместо отправки на email.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.deps import get_db
from app.models import AuthProvider, User
from app.schemas import (
    AuthOut,
    MagicLinkRequestIn,
    MagicLinkRequestOut,
    MagicLinkVerifyIn,
    RefreshIn,
    TokenPair,
    UserOut,
)
from app.security import (
    TokenError,
    issue_access_token,
    issue_magic_token,
    issue_refresh_token,
    verify_magic_token,
    verify_refresh_token,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/magic/request", response_model=MagicLinkRequestOut)
async def request_magic_link(payload: MagicLinkRequestIn) -> MagicLinkRequestOut:
    """Сгенерировать magic-link и отправить на email.

    В dev-режиме токен возвращается прямо в ответе (поле `dev_token`),
    чтобы можно было пройти flow без поднятого email-провайдера.
    В production это поле скрывается, токен уходит только в письме.

    [ОТКРЫТО] Реальная отправка через Unisender / SendPulse — PRD §13.1.
    """
    settings = get_settings()
    token = issue_magic_token(payload.email)
    logger.info("magic link requested for %s", payload.email)

    if settings.is_dev:
        return MagicLinkRequestOut(sent=True, dev_token=token)
    return MagicLinkRequestOut(sent=True, dev_token=None)


@router.post("/magic/verify", response_model=AuthOut)
async def verify_magic_link(
    payload: MagicLinkVerifyIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthOut:
    """Принять magic-token, найти/создать User, выдать пару JWT."""
    try:
        email = verify_magic_token(payload.token)
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email, auth_provider=AuthProvider.magic_link)
        db.add(user)
        await db.flush()

    access = issue_access_token(user.id)
    refresh = issue_refresh_token(user.id)
    return AuthOut(access=access, refresh=refresh, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshIn,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenPair:
    """Ротировать refresh-токен (PRD §13.9).

    [ОТКРЫТО] Защита от replay через Redis-blacklist по jti.
    Сейчас выдаём новую пару без проверки, что переданный refresh
    не использовался — для MVP это допустимо, но перед production
    нужен blacklist.
    """
    try:
        user_id, _jti = verify_refresh_token(payload.refresh)
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e

    user = await db.get(User, user_id)
    if user is None or user.is_deleted:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user_not_found")

    new_access = issue_access_token(user.id)
    new_refresh = issue_refresh_token(user.id)
    return TokenPair(access=new_access, refresh=new_refresh)


@router.post("/logout")
async def logout() -> dict[str, bool]:
    """Завершить сессию.

    [ОТКРЫТО] Добавление refresh.jti в Redis-blacklist. Без blacklist
    эндпойнт ничего не делает на сервере — клиент должен сам выбросить
    токены. Семантически зарезервирован, чтобы не ломать клиентский API.
    """
    return {"ok": True}
