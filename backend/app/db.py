"""SQLAlchemy 2.0 async engine + session factory.

Используем async-движок (asyncpg для Postgres, aiosqlite для тестов).
Сессия инжектируется в роутеры через FastAPI-dependency `get_db`.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_settings = get_settings()

# echo=True в dev помогает увидеть фактический SQL в логах. В тестах и проде — выкл.
engine = create_async_engine(
    _settings.database_url,
    echo=False,
    pool_pre_ping=True,  # Защита от закрытых TCP-соединений после простоя.
    future=True,
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI-dependency: открывает сессию, гарантирует закрытие после запроса."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        else:
            await session.commit()
