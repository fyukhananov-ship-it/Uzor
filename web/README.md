# Узор — веб-лендинг

Виральная воронка по PRD: пользователь приходит из лонгрида/рекомендации,
вводит две даты рождения, получает короткий разбор пары и выбор —
установить приложение или отправить разбор партнёру.

Это **один из трёх пакетов** будущего монорепо:

- `web/` — этот пакет. Next.js 15 + Tailwind. Реализован.
- `backend/` — FastAPI + PostgreSQL + Redis + Celery. Не реализован.
- `android/` — Kotlin + Jetpack Compose. Не реализован.

## Стек

- **Next.js 15** App Router, **TypeScript strict**.
- **Tailwind CSS** с палитрой по PRD §12.3 (warm off-white / dusty rose / sage / faded blue).
- **next/font** — Inter для UI и Source Serif 4 для контента (PRD §12.4).
- **zod** для валидации (включая backend-эндпойнты).
- Анонимные сессии — in-memory map (заглушка). На проде — Redis с TTL 7 дней.
- LLM — заглушен детерминированным шаблонным генератором (`lib/observations.ts`).
  Когда появится backend, лендинг будет проксировать запрос в `POST /session`
  на FastAPI; стек шаблонов остаётся как fallback.

## Запуск локально

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Скрипты

- `npm run dev` — dev-сервер на 3000.
- `npm run build` — production-сборка.
- `npm run start` — запуск собранной версии.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — Next ESLint.

## Структура

```
app/
  page.tsx                # /
  start/page.tsx          # многошаговый онбординг
  p/[token]/page.tsx      # shared compatibility page
  pricing/                # тарифы
  about/                  # о продукте
  privacy/                # политика (черновик)
  terms/                  # условия (черновик)
  ios-waitlist/           # лист ожидания iOS
  api/
    session/              # POST — создать; GET /[token] — прочитать
    waitlist/             # POST — записать email

components/
  BirthDateInput.tsx
  LoadingSequence.tsx
  ObservationCard.tsx

lib/
  numerology.ts           # детерминированный движок (PRD §10.4)
  observations.ts         # шаблонный генератор наблюдений
  session-store.ts        # in-memory store (заглушка для Redis)
  validation.ts           # zod-схемы

types/
  index.ts                # SessionPayload, NumerologyContext, FrictionZone
```

## Что осталось как TODO

- [ ] Подключить backend FastAPI: проксировать `POST /api/session`
      в `POST /session` на backend, использовать Redis вместо in-memory store.
- [ ] Реальный LLM-провайдер (OpenRouter primary + YandexGPT резерв,
      PRD §13.2). Текущий шаблонный генератор остаётся как fallback.
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
