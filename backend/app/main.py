"""FastAPI application factory.

Запуск локально:
    uvicorn app.main:app --reload --port 8000

Маршруты:
    GET  /health                — liveness
    POST /auth/magic/request    — запросить magic-link
    POST /auth/magic/verify     — обменять magic-токен на пару JWT
    POST /auth/refresh          — ротировать refresh
    POST /auth/logout           — (no-op stub, ждёт Redis blacklist)
    POST /session               — создать anonymous wow-сессию
    GET  /session/{token}       — прочитать anonymous-сессию
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, health, session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Узор API",
        description=(
            "Backend для веб-лендинга и Android-приложения. "
            "PRD §13.1 / §13.2."
        ),
        version="0.1.0",
        # /docs только в dev — в production swagger закрываем.
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(session.router)
    return app


app = create_app()
