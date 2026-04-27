"""Pytest-фикстуры.

Тесты гоняем на in-memory SQLite через aiosqlite — Postgres-only фичи
(JSONB, postgresql_where на partial index) деградируют до общих JSON и
обычного индекса в SQLAlchemy.

Для каждого теста создаём чистую БД из Base.metadata, без alembic —
быстрее и не тащим миграционный пайплайн в unit-тесты.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

# Конфиг должен подняться с тестовыми переменными ДО импорта app.config —
# settings кэшируется через lru_cache.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-not-for-production-use-only")
os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import get_db
from app.main import app
from app.models import Base


@pytest_asyncio.fixture
async def engine():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with SessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(engine) -> AsyncGenerator[AsyncClient, None]:
    """HTTP-клиент с переопределённой get_db, которая отдаёт сессию
    поверх тестового in-memory движка."""
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with SessionLocal() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            else:
                await session.commit()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()
