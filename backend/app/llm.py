"""LLM-пайплайн с graceful fallback (PRD §13.2 + §10.7).

Зеркалит логику web/lib/llm/index.ts:
1. Если ANTHROPIC_API_KEY задан — вызываем Claude через Anthropic SDK.
2. На любую ошибку (auth, billing, сеть, тон-валидация, тайм-аут) —
   fallback на детерминированные шаблоны.
3. Без ключа — сразу шаблоны, без сетевых попыток.

Каждая генерация (любой источник) логируется в AIGenerationLog —
backend-таблицу, которая в v1.5 станет calibration dataset для
Knowledge Layer.

Anthropic из РФ блокирует прямые вызовы; при production-deploy в РФ
этот же интерфейс точкой настройки указывает на OpenRouter
(`base_url="https://openrouter.ai/api/v1"` через `Anthropic(...)`).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from anthropic import AsyncAnthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import AIGenerationLog, GenerationType
from app.numerology import FrictionZone, PairContext
from app.observations import Observation, build_observations

logger = logging.getLogger(__name__)

# Системный промпт по PRD §10.3. Стабилен между запросами — кэшируется
# через cache_control: ephemeral на стороне Anthropic (~90% скидки на
# повторных вызовах).
_SYSTEM_PROMPT = """Ты — внутренний голос продукта Узор. Узор использует нумерологию и астрологию как структурированный язык для самонаблюдения, не как систему веры.

Ты пишешь коротко, наблюдательно, литературно, для взрослых образованных людей.
Ты никогда не предсказываешь будущее в утвердительной форме.
Ты никогда не предписываешь действия.
Ты обращаешься на «ты», не на «Вы».

Запрещённые слова и обороты: «звёзды», «судьба», «карма», «энергия» в эзотерическом смысле, «вселенная», «вселенная посылает», «вам рекомендовано», «звёзды говорят».

Запрещённые знаки: восклицательный знак, эмодзи, многоточие в конце фразы.

Тон-референсы (что ОК): лонгриды The Blueprint, эссе Алёны Долецкой, проза Алена де Боттона, колонки Reminder.
Анти-референсы (что НЕ ОК): гороскопы из газет, инфоцыгане, мотивационные посты в Instagram, тарологи в Telegram.

На каждый запрос ты возвращаешь три наблюдения о паре:
— dynamic: одно наблюдение об общей динамике (как они устроены вместе);
— friction: одно наблюдение о вероятной зоне трения (повторяющийся сюжет, не диагноз);
— strength: одно наблюдение о сильной стороне (что у них получается лучше, чем у пар без этой комбинации).

Каждое наблюдение — ровно одно завершённое предложение длиной ≤140 символов. Без вводных «возможно», «вероятно», «как правило» — пиши уверенно, но в наблюдательной, а не предсказательной форме.

Опираешься на нумерологический контекст пары, который тебе передан, но никогда не упоминаешь конкретные числа в тексте — переводи их в наблюдения о поведении."""

_FRICTION_HINT: dict[FrictionZone, str] = {
    FrictionZone.timing_mismatch: "разная скорость / темп",
    FrictionZone.phase_mismatch: "несовпадение фаз (завершения и начинания)",
    FrictionZone.energy_mismatch: "разная социальная нагрузка",
    FrictionZone.depth_mismatch: "разный масштаб внимания (детали vs общая картина)",
    FrictionZone.rhythm_match: "совпадающий ритм",
    FrictionZone.complementary_pair: "взаимодополняющая пара",
}

_OBSERVATIONS_SCHEMA = {
    "type": "object",
    "properties": {
        "dynamic": {"type": "string", "description": "≤140 символов, одно предложение"},
        "friction": {"type": "string", "description": "≤140 символов, одно предложение"},
        "strength": {"type": "string", "description": "≤140 символов, одно предложение"},
    },
    "required": ["dynamic", "friction", "strength"],
    "additionalProperties": False,
}

_FORBIDDEN_PATTERNS = [
    re.compile(r"звёзд", re.IGNORECASE),
    re.compile(r"судьб", re.IGNORECASE),
    re.compile(r"карм", re.IGNORECASE),
    re.compile(r"вселенн", re.IGNORECASE),
    re.compile(r"эзотерич", re.IGNORECASE),
    re.compile(r"гороскоп", re.IGNORECASE),
]
# Сурогат-диапазон эмодзи — широкое перекрытие достаточно, точные unicode-блоки
# здесь не критичны, нам важно ловить смайлы, а не валидировать unicode-стандарт.
_EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF]")


@dataclass
class GenerationMeta:
    source: str  # claude | template_primary | template_fallback
    model: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    latency_ms: int = 0
    error_message: str | None = None


@dataclass
class GenerationResult:
    observations: list[Observation]
    meta: GenerationMeta
    log_input_context: dict[str, Any] = field(default_factory=dict)


def _build_user_prompt(birth_user: str, birth_partner: str, context: PairContext) -> str:
    return "\n".join(
        [
            f"Дата сегодня: {context.date}.",
            "",
            "Контекст пары (только для тебя, в тексте на это не ссылайся):",
            f"— У тебя personal_day={context.user.personal_day}, "
            f"personal_year={context.user.personal_year}, "
            f"life_path={context.user.life_path}.",
            f"— У партнёра personal_day={context.partner.personal_day}, "
            f"personal_year={context.partner.personal_year}, "
            f"life_path={context.partner.life_path}.",
            f"— Pair cycle: {context.pair_cycle}.",
            f"— Вероятная зона трения по нумерологическим правилам: "
            f"{context.friction.value} ({_FRICTION_HINT[context.friction]}).",
            f"— Даты рождения: {birth_user} и {birth_partner}.",
            "",
            "Сгенерируй три наблюдения (dynamic, friction, strength) в указанном тоне.",
            "Не упоминай в тексте числа, нумерологию, астрологию явно — пиши о паттернах поведения.",
        ]
    )


def _validate_tone(text: str) -> None:
    if "!" in text:
        raise ValueError("tone_violation_punctuation")
    if _EMOJI_RE.search(text):
        raise ValueError("tone_violation_emoji")
    for pat in _FORBIDDEN_PATTERNS:
        if pat.search(text):
            raise ValueError(f"tone_violation_word:{pat.pattern}")


async def _call_claude(
    birth_user: str, birth_partner: str, context: PairContext
) -> tuple[dict[str, str], GenerationMeta]:
    settings = get_settings()
    model = settings.uzor_llm_model
    started = time.monotonic()

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_prompt = _build_user_prompt(birth_user, birth_partner, context)

    response = await client.messages.create(
        model=model,
        max_tokens=2048,
        # Adaptive thinking — модель решает сама, сколько думать.
        # На Opus 4.7 это единственный поддерживаемый режим.
        thinking={"type": "adaptive"},
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                # cache_control ephemeral: первая запись платит ~1.25×,
                # последующие — ~0.1×. Окупается со второго запроса.
                "cache_control": {"type": "ephemeral"},
            }
        ],
        output_config={
            "format": {"type": "json_schema", "schema": _OBSERVATIONS_SCHEMA},
            "effort": "high",
        },
        messages=[{"role": "user", "content": user_prompt}],
    )

    text_block = next((b for b in response.content if getattr(b, "type", None) == "text"), None)
    if text_block is None:
        raise RuntimeError("no_text_block_in_response")

    try:
        parsed = json.loads(text_block.text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"json_parse_failed: {e}") from e

    for key in ("dynamic", "friction", "strength"):
        value = parsed.get(key)
        if not isinstance(value, str):
            raise RuntimeError(f"missing_or_invalid_field:{key}")
        _validate_tone(value)

    usage = response.usage
    meta = GenerationMeta(
        source="claude",
        model=model,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cache_read_input_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
        cache_creation_input_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
        latency_ms=int((time.monotonic() - started) * 1000),
    )
    return parsed, meta


async def generate_observations(
    db: AsyncSession,
    birth_user: str,
    birth_partner: str,
    context: PairContext,
    *,
    anonymous_session_token: Any = None,
) -> GenerationResult:
    """Сгенерировать три наблюдения для пары и записать в AIGenerationLog.

    Возвращает результат сразу. Ошибка LLM не пробрасывается — fallback
    к шаблонам прозрачный для caller-а; источник виден только в meta.
    """
    settings = get_settings()
    log_input_context = {
        "birth_date_user": birth_user,
        "birth_date_partner": birth_partner,
        "user_personal_day": context.user.personal_day,
        "partner_personal_day": context.partner.personal_day,
        "pair_cycle": context.pair_cycle,
        "friction": context.friction.value,
        "date": context.date,
    }

    if not settings.has_anthropic_key:
        observations = build_observations(birth_user, birth_partner, context)
        meta = GenerationMeta(source="template_primary")
        await _persist_log(
            db,
            anonymous_session_token=anonymous_session_token,
            generation_type=GenerationType.wow_screen,
            input_context=log_input_context,
            observations=observations,
            meta=meta,
        )
        return GenerationResult(observations, meta, log_input_context)

    try:
        parsed, meta = await asyncio.wait_for(
            _call_claude(birth_user, birth_partner, context),
            timeout=settings.llm_timeout_seconds,
        )
        observations = [
            Observation(kind="dynamic", text=parsed["dynamic"]),
            Observation(kind="friction", text=parsed["friction"]),
            Observation(kind="strength", text=parsed["strength"]),
        ]
        await _persist_log(
            db,
            anonymous_session_token=anonymous_session_token,
            generation_type=GenerationType.wow_screen,
            input_context=log_input_context,
            observations=observations,
            meta=meta,
        )
        return GenerationResult(observations, meta, log_input_context)
    except Exception as exc:
        logger.warning("LLM call failed, falling back to templates: %s", exc)
        observations = build_observations(birth_user, birth_partner, context)
        meta = GenerationMeta(source="template_fallback", error_message=str(exc))
        await _persist_log(
            db,
            anonymous_session_token=anonymous_session_token,
            generation_type=GenerationType.wow_screen,
            input_context=log_input_context,
            observations=observations,
            meta=meta,
        )
        return GenerationResult(observations, meta, log_input_context)


async def _persist_log(
    db: AsyncSession,
    *,
    anonymous_session_token: Any,
    generation_type: GenerationType,
    input_context: dict[str, Any],
    observations: list[Observation],
    meta: GenerationMeta,
) -> None:
    """Запись в AIGenerationLog (PRD §10.7).

    Output_text — это JSON всех трёх наблюдений; восстановить можно
    json.loads(...). Так удобно для аналитики и калибровки в v1.5.
    """
    output = json.dumps({o.kind: o.text for o in observations}, ensure_ascii=False)
    entry = AIGenerationLog(
        anonymous_session_token=anonymous_session_token,
        generation_type=generation_type,
        system_prompt_version="v1",
        input_context=input_context,
        output_text=output,
        llm_model=meta.model,
        latency_ms=meta.latency_ms or None,
        input_tokens=meta.input_tokens or None,
        output_tokens=meta.output_tokens or None,
        cache_read_input_tokens=meta.cache_read_input_tokens or None,
        cache_creation_input_tokens=meta.cache_creation_input_tokens or None,
        source=meta.source,
        error_message=meta.error_message,
    )
    db.add(entry)
    await db.flush()
    logger.info(
        "[ai-gen] src=%s model=%s latency=%sms tokens=in=%s+cache_r=%s out=%s err=%s",
        meta.source,
        meta.model,
        meta.latency_ms,
        meta.input_tokens,
        meta.cache_read_input_tokens,
        meta.output_tokens,
        meta.error_message,
    )
