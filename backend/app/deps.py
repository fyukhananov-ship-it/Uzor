"""FastAPI dependencies: текущий пользователь, БД-сессия."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.security import TokenError, verify_access_token

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing_or_invalid_authorization")

    try:
        user_id = verify_access_token(credentials.credentials)
    except TokenError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e

    user = await db.get(User, user_id)
    if user is None or user.is_deleted:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user_not_found")
    return user


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Для эндпойнтов, работающих и для анонимов, и для залогиненных."""
    if credentials is None:
        return None
    try:
        user_id = verify_access_token(credentials.credentials)
    except TokenError:
        return None
    user = await db.get(User, user_id)
    if user is None or user.is_deleted:
        return None
    return user


__all__ = [
    "get_current_user",
    "get_current_user_optional",
    "get_db",  # реэкспорт ради короткого импорта `from app.deps import ...`
    "select",
]
