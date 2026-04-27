# Узор — веб-лендинг

Виральная воронка по PRD §6.1 — пользователь приходит из лонгрида или
рекомендации, вводит две даты рождения, получает короткий редакторский
разбор пары и выбор: установить приложение или отправить разбор партнёру.

После рефактора — **тонкий клиент** над `backend/`. Лендинг отвечает за
форму, валидацию ввода, тон голоса, редакторскую вёрстку, edge rate-limit.
Нумерология, LLM-конвейер, AIGenerationLog — на стороне FastAPI-сервиса.

## Архитектура

```
Browser ──▶ Next.js (web/)            ──▶ FastAPI (backend/) ──▶ Postgres
            │ form, validation,           │ numerology, Claude/template,
            │ rate limit, layout          │ AIGenerationLog, sessions
            │                             │
            └─── /api/session* — proxy ──┘
```

Web даже не импортирует Anthropic SDK — это сознательно убрано, чтобы
LLM-логика жила в одном месте.

## Стек

- **Next.js 15** App Router, **TypeScript strict**.
- **Tailwind CSS** с палитрой по PRD §12.3.
- **next/font** — Inter для UI и Source Serif 4 для контента.
- **zod** + **react-hook-form** для клиентской валидации.
- Никаких клиентских вызовов LLM. Backend в `../backend/` отвечает за всё.

## Запуск локально

Сначала подними backend (см. `../backend/README.md`), затем web.

```bash
# В терминале 1:
cd backend
docker compose up -d
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# В терминале 2:
cd web
cp .env.example .env.local   # выставь UZOR_BACKEND_URL если backend на другом порту
npm install
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

## Скрипты

- `npm run dev` — dev-сервер на 3000.
- `npm run build` — production-сборка.
- `npm run start` — запуск собранной версии.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — Next ESLint.

## Структура

```
app/
  page.tsx                # /  редакторский hero
  start/page.tsx          # /  многошаговый онбординг + wow-экран
  p/[token]/page.tsx      # /  shared compatibility page (читает backend)
  pricing/                # тарифы
  about/                  # о продукте
  privacy/                # политика (черновик)
  terms/                  # условия (черновик)
  ios-waitlist/           # лист ожидания iOS
  api/
    session/              # POST + GET — proxy на backend /session
    waitlist/             # POST — записать email (TODO: реальный провайдер)

components/
  BirthDateInput.tsx      # дата формы
  LoadingSequence.tsx     # 3-шаговая loading-последовательность
  ObservationCard.tsx     # редакторская карточка наблюдения
  TransparencyStrip.tsx   # «Как это получено» — раскрытие нумерологии

lib/
  backend.ts              # типизированный fetch-клиент к FastAPI
  validation.ts           # zod-схемы (форм + waitlist)
  rate-limit.ts           # per-IP rate limiter (PRD §13.6)
```

## Что осталось как TODO

- [ ] OG-image generation на Edge runtime через `@vercel/og` (PRD §13.4).
- [ ] Email-провайдер для листа ожидания (Unisender / SendPulse).
- [ ] RuStore deep-link на CTA «Продолжить 7 дней бесплатно» —
      сейчас ведёт на `/pricing` как плейсхолдер.
- [ ] Аналитика (PostHog + Simple Analytics, PRD §13.1).
- [ ] Cookie consent gate (152-ФЗ).
- [ ] Финальные тексты политики и условий — после юр-консультации.

## Тон

Любой UI-текст проходит проверку по PRD §10:

- Не используем: «звёзды», «судьба», «карма», «энергия», «вселенная».
- Без восклицательных знаков и эмодзи.
- «Ты», не «Вы».
- Литературный регистр, наблюдательный, не предписывающий.
