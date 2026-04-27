"""End-to-end тесты session-flow.

Без ANTHROPIC_API_KEY backend идёт по template_primary — детерминированно
и без сети. Тесты должны проходить полностью offline.
"""

from sqlalchemy import select

from app.models import AIGenerationLog, AnonymousSession


class TestCreateSession:
    async def test_returns_201_with_observations(self, client):
        resp = await client.post(
            "/session",
            json={"birthDateUser": "1990-05-12", "birthDatePartner": "1992-09-03"},
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert "token" in data
        assert len(data["observations"]) == 3
        kinds = {o["kind"] for o in data["observations"]}
        assert kinds == {"dynamic", "friction", "strength"}
        assert all(o["text"] for o in data["observations"])

    async def test_validation_error_on_bad_date(self, client):
        resp = await client.post(
            "/session",
            json={"birthDateUser": "not-a-date", "birthDatePartner": "1992-09-03"},
        )
        assert resp.status_code == 422

    async def test_persists_session_in_db(self, client, db_session):
        resp = await client.post(
            "/session",
            json={"birthDateUser": "1990-05-12", "birthDatePartner": "1992-09-03"},
        )
        assert resp.status_code == 201
        token = resp.json()["token"]

        result = await db_session.execute(select(AnonymousSession))
        rows = result.scalars().all()
        assert len(rows) == 1
        assert str(rows[0].token) == token

    async def test_writes_ai_generation_log(self, client, db_session):
        await client.post(
            "/session",
            json={"birthDateUser": "1990-05-12", "birthDatePartner": "1992-09-03"},
        )
        result = await db_session.execute(select(AIGenerationLog))
        logs = result.scalars().all()
        assert len(logs) == 1
        # Без ключа Claude — должно быть template_primary.
        assert logs[0].source == "template_primary"
        assert logs[0].generation_type.value == "wow_screen"
        assert logs[0].input_context["friction"] in {
            "timing_mismatch",
            "phase_mismatch",
            "energy_mismatch",
            "depth_mismatch",
            "rhythm_match",
            "complementary_pair",
        }


class TestGetSession:
    async def test_round_trip(self, client):
        create = await client.post(
            "/session",
            json={"birthDateUser": "1990-05-12", "birthDatePartner": "1992-09-03"},
        )
        token = create.json()["token"]

        get_resp = await client.get(f"/session/{token}")
        assert get_resp.status_code == 200
        # Те же три наблюдения, что и в create.
        assert get_resp.json()["observations"] == create.json()["observations"]

    async def test_404_on_unknown_token(self, client):
        resp = await client.get("/session/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


class TestHealth:
    async def test_health_returns_ok(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestAuth:
    async def test_magic_link_request_returns_dev_token(self, client):
        resp = await client.post("/auth/magic/request", json={"email": "test@example.com"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["sent"] is True
        # В env=test (см. conftest) is_dev=False, dev_token=None.
        # Создадим токен через прямой вызов security и проверим verify-flow.

    async def test_full_magic_link_flow(self, client):
        from app.security import issue_magic_token

        token = issue_magic_token("filipp@example.com")
        verify = await client.post("/auth/magic/verify", json={"token": token})
        assert verify.status_code == 200
        body = verify.json()
        assert body["user"]["email"] == "filipp@example.com"
        assert body["access"]
        assert body["refresh"]

    async def test_refresh_rotates_pair(self, client):
        from app.security import issue_magic_token

        token = issue_magic_token("user@example.com")
        verify = await client.post("/auth/magic/verify", json={"token": token})
        old_refresh = verify.json()["refresh"]

        rotated = await client.post("/auth/refresh", json={"refresh": old_refresh})
        assert rotated.status_code == 200
        assert rotated.json()["access"]
        assert rotated.json()["refresh"]
        # Новые токены отличаются от старых (jti разные).
        assert rotated.json()["refresh"] != old_refresh
