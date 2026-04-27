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
- **LLM**: Anthropic Messages API, модель `claude-opus-4-7` (`UZOR_LLM_MODEL`
  переопределяет). Adaptive thinking + `effort: high`, prompt caching на
  системном промпте, structured outputs через JSON-Schema + Zod-валидация.
  Если ключ не задан или вызов падает — graceful fallback на детерминированный
  шаблонный генератор (`lib/observations.ts`); лендинг никогда не возвращает
  500 из-за LLM. Per-IP rate limit на `/api/session` (8 / час).

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
  observations.ts         # шаблонный генератор наблюдений (fallback)
  session-store.ts        # in-memory store (заглушка для Redis)
  validation.ts           # zod-схемы
  rate-limit.ts           # per-IP rate limiter (PRD §13.6)
  llm/
    claude.ts             # Anthropic SDK: системный промпт §10.3,
                          # adaptive thinking, prompt caching, JSON-Schema
    index.ts              # unified интерфейс: Claude → fallback → template
    log.ts                # AIGenerationLog stub (PRD §10.7 / §14.6)

types/
  index.ts                # SessionPayload, NumerologyContext, FrictionZone
```

## Что осталось как TODO

- [ ] Подключить backend FastAPI: проксировать `POST /api/session`
      в `POST /session` на backend, использовать Redis вместо in-memory store
      и Redis-bound rate limiter вместо in-memory.
- [ ] Из РФ — переключить Anthropic на OpenRouter proxy (PRD §13.2):
      Anthropic API недоступен по российским IP. Текущая реализация работает
      из нероссийских окружений напрямую, либо через VPN-egress на стороне
      хостинга. Минимальная правка — поменять `baseURL` у клиента.
- [ ] YandexGPT 4 Pro как secondary fallback перед template_fallback (PRD §13.2).
- [ ] OG-image generation на Edge runtime через `@vercel/og` (PRD §13.4).
- [ ] Email-провайдер для листа ожидания (Unisender / SendPulse).
- [ ] RuStore deep-link на CTA «Продолжить 7 дней бесплатно» —
      сейчас ведёт на `/pricing` как плейсхолдер.
- [ ] Аналитика (PostHog + Simple Analytics, PRD §13.1).
- [ ] Cookie consent gate (152-ФЗ).
- [ ] Финальные тексты политики и условий — после юр-консультации.

## Стоимость LLM

Один вызов Claude Opus 4.7 c adaptive thinking и системным промптом ~700
токенов:

- **Первый запрос**: ~$0.04–$0.06 (input + cache write + thinking + output)
- **Последующие при попадании в кэш системного промпта** (5 мин TTL):
  ~$0.02–$0.04

Для cost-sensitive продакшна имеет смысл переключиться на Sonnet 4.6
(`UZOR_LLM_MODEL=claude-sonnet-4-6`) — ~×3 дешевле, потеря качества тона в
этом конкретном пайплайне ограниченная (PRD §3.2.8 говорит о чувствительности
под-персоны B; нужен A/B-тест на ≥1k реальных запросов перед фиксацией модели).

## Тон

Любой UI-текст проходит проверку по PRD §10:

- Не используем: «звёзды», «судьба», «карма», «энергия», «вселенная».
- Без восклицательных знаков и эмодзи.
- «Ты», не «Вы».
- Литературный регистр, наблюдательный, не предписывающий.
