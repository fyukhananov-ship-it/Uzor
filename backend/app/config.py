"""Конфигурация приложения через pydantic-settings.

Все значения читаются из .env (или переменных окружения). При запуске тестов
DATABASE_URL автоматически переопределяется на in-memory SQLite в conftest.py.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "production", "test"] = "development"

    database_url: str = "postgresql+asyncpg://uzor:uzor@localhost:5432/uzor"
    redis_url: str = "redis://localhost:6379/0"

    # JWT — для magic link аутентификации и API-токенов.
    jwt_secret: str = "dev-only-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    magic_link_ttl_minutes: int = 15

    # LLM
    anthropic_api_key: str = ""
    uzor_llm_model: str = "claude-opus-4-7"
    llm_timeout_seconds: float = 8.0

    # CORS — список через запятую в .env, разбиваем тут.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.environment == "development"

    @property
    def has_anthropic_key(self) -> bool:
        return bool(self.anthropic_api_key.strip())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Кэшированный синглтон. lru_cache даёт нам отложенную инициализацию,
    которая всё равно срабатывает один раз за процесс."""
    return Settings()
