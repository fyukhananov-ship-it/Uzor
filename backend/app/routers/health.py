from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe. Не проверяет БД (для readiness заведём отдельный)."""
    return {"status": "ok"}
