# Узор — backend

FastAPI-сервис для лендинга и (будущего) Android-приложения. Реализован
по PRD §13.1 и §13.2.

## Стек

- **Python 3.11+ + FastAPI**, async на всю глубину.
- **PostgreSQL 16** + **Redis 7** (через `docker-compose`).
- **SQLAlchemy 2.0** async + **Alembic** для миграций.
- **Anthropic SDK** для LLM-генерации с graceful fallback на детерминированные
  шаблоны (если ключ отсутствует или вызов падает).
- **python-jose** для JWT.
- **pytest + httpx ASGI transport** для интеграционных тестов на in-memory
  SQLite (offline, без сети).

## Что реализовано

| Эндпойнт | Назначение |
|---|---|
| `GET /health` | Liveness probe |
| `POST /auth/magic/request` | Запросить magic-link на email |
| `POST /auth/magic/verify` | Обменять magic-токен на пару JWT (access + refresh) |
| `POST /auth/refresh` | Ротировать refresh-токен |
| `POST /auth/logout` | (no-op stub, готов под Redis-blacklist) |
| `POST /session` | Анонимный wow-разбор: две даты → 3 наблюдения |
| `GET /session/{token}` | Прочитать анонимную сессию (для shared-page и Android Install Referrer) |

## Что есть в схеме (PRD §9.1)

13 таблиц через одну Alembic-миграцию: `users`, `anonymous_sessions`,
`profiles`, `pair_links`, `reflections`, `moment_tags`, `pattern_reports`,
`prompts`, `subscriptions`, `device_registrations`, `events`,
`ai_generation_log`, `reflection_topics`. Endpoints для всех таблиц
кроме первых двух — TODO для будущих фаз; схема стоит сразу, чтобы
Android-разработка не упиралась в миграции.

## Запуск локально

### 1. Поднять Postgres + Redis

```bash
docker compose up -d
```

### 2. Установить зависимости

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```

### 3. Настроить `.env`

```bash
cp .env.example .env
# отредактируй ANTHROPIC_API_KEY, JWT_SECRET по желанию
```

### 4. Накатить миграции

```bash
alembic upgrade head
```

### 5. Запустить API

```bash
uvicorn app.main:app --reload --port 8000
```

Открой http://localhost:8000/docs — Swagger UI (только в dev).

### Смоук-тест

```bash
curl -X POST http://localhost:8000/session \
  -H 'content-type: application/json' \
  -d '{"birthDateUser":"1990-05-12","birthDatePartner":"1992-09-03"}'
```

## Тесты

```bash
pytest -q
```

23/23 тестов на старте: нумерология, session-flow, magic-link auth, refresh.

## Линт и типы

```bash
ruff check app tests
mypy app   # опционально, не строгий
```

## LLM режимы

Поведение `POST /session` определяется наличием `ANTHROPIC_API_KEY`:

- **Без ключа** → `template_primary`. Шаблонная генерация
  (`app/observations.py`), идентичная веб-лендингу. Никаких сетевых вызовов.
- **С ключом, вызов успешен** → `claude`. Реальная генерация через
  `claude-opus-4-7` с adaptive thinking, prompt caching, JSON-Schema
  structured output. Tone-валидатор как последняя линия защиты.
- **С ключом, вызов упал** → `template_fallback`. Любая ошибка (auth,
  billing, сеть, тон-валидация, тайм-аут) ловится, в `AIGenerationLog`
  пишется `error_message`, ответ — шаблонная генерация.

Каждый вызов любого источника пишется в `ai_generation_log` со всем
контекстом и метриками (PRD §10.7). Это calibration dataset для
Knowledge Layer v1.5.

## Архитектурные решения и их обоснование

- **Anthropic из РФ:** API блокирует российские IP. В production-deploy
  в РФ переключаемся на OpenRouter — `AsyncAnthropic(base_url=...)` в
  `app/llm.py`. Сейчас — прямой вызов Anthropic.
- **Anonymous-session TTL** валидируется на чтении (`expires_at <= now`).
  Фоновую очистку Postgres не делает — отдельный cron-job на это
  поднимем по PRD §13.10 в нужный момент.
- **Magic-link в dev возвращает токен в payload** (`dev_token`). В
  production это поле скрывается, токен уходит только в письме.
  Это позволяет проходить flow без поднятого email-провайдера.
- **Refresh без blacklist в этом коммите.** Anti-replay через Redis
  по `jti` — TODO. Без него один refresh-токен можно использовать
  многократно. Перед production-релизом обязательно поднять blacklist.
- **JSONB-колонки** работают на Postgres; на SQLite (тесты) деградируют
  до JSON через `JSON().with_variant(JSONB(), "postgresql")`.

## Что осталось как TODO

- [ ] Google ID-token и Yandex OAuth (нужны реальные client-id).
- [ ] Email-провайдер для magic-link (Unisender / SendPulse, PRD §13.1).
- [ ] Redis-blacklist `jti` для anti-replay refresh-токенов.
- [ ] Endpoints для Profile / PairLink / Reflection / MomentTag /
      PatternReport — пишем, когда стартует Android-разработка.
- [ ] Celery worker для pre-generation overnight (PRD §13.10).
- [ ] Per-user rate limit (PRD §13.6) — сейчас только tone-проверки.
- [ ] OpenRouter base-url для Anthropic в production.
- [ ] Sentry для ошибок, AppMetrica/PostHog для аналитики.
- [ ] CI/CD по PRD §13.11 (GitHub Actions: ruff + mypy + pytest +
      docker build).
