"""JWT-токены и magic-link генерация (PRD §13.9).

Token lifecycle:
— Access JWT: 15 минут, для авторизации API-запросов.
— Refresh JWT: 30 дней, ротируется на каждом use (защита от утечки —
  если старый refresh пытается обновиться повторно, оба токена
  инвалидируются и пользователь принудительно reauthorize).
— Magic link: одноразовый короткоживущий токен (TTL 15 минут),
  отправляется на email.

В v1 храним blacklist использованных refresh-tokens в Redis для anti-replay
(не реализовано в этом коммите — TODO).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast

from jose import JWTError, jwt

from app.config import get_settings

TokenType = Literal["access", "refresh", "magic"]


class TokenError(Exception):
    """Базовая ошибка верификации токена."""


def _now() -> datetime:
    return datetime.now(UTC)


def _encode(
    *,
    subject: str,
    token_type: TokenType,
    ttl: timedelta,
    extra: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    now = _now()
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
        "jti": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str, expected_type: TokenType) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "type", "jti"]},
        )
    except JWTError as e:
        raise TokenError(f"invalid_token: {e}") from e

    if payload.get("type") != expected_type:
        raise TokenError(f"wrong_token_type: expected {expected_type}, got {payload.get('type')}")
    return cast(dict[str, Any], payload)


def issue_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    return _encode(
        subject=str(user_id),
        token_type="access",
        ttl=timedelta(minutes=settings.access_token_ttl_minutes),
    )


def issue_refresh_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    return _encode(
        subject=str(user_id),
        token_type="refresh",
        ttl=timedelta(days=settings.refresh_token_ttl_days),
    )


def issue_magic_token(email: str) -> str:
    """Magic link: subject — email. На /verify создаётся User по email."""
    settings = get_settings()
    return _encode(
        subject=email.lower().strip(),
        token_type="magic",
        ttl=timedelta(minutes=settings.magic_link_ttl_minutes),
    )


def verify_access_token(token: str) -> uuid.UUID:
    payload = _decode(token, "access")
    return uuid.UUID(payload["sub"])


def verify_refresh_token(token: str) -> tuple[uuid.UUID, str]:
    """Возвращает (user_id, jti). jti нужен для blacklist в Redis (anti-replay)."""
    payload = _decode(token, "refresh")
    return uuid.UUID(payload["sub"]), payload["jti"]


def verify_magic_token(token: str) -> str:
    """Возвращает email."""
    payload = _decode(token, "magic")
    return payload["sub"]
