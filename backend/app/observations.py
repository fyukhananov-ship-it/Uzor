"""Шаблонный генератор наблюдений (PRD §10.5).

Порт с web/lib/observations.ts с тем же seed-алгоритмом — backend и web
выдают идентичные тексты для одних и тех же дат при отсутствии LLM.

Это fallback-слой: используется если ANTHROPIC_API_KEY не задан или
вызов Claude упал. В обоих случаях AIGenerationLog фиксирует факт
с source='template_primary' / 'template_fallback'.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.numerology import FrictionZone, PairContext

ObservationKind = Literal["dynamic", "friction", "strength"]


@dataclass(frozen=True)
class Observation:
    kind: ObservationKind
    text: str


_DYNAMIC_BY_FRICTION: dict[FrictionZone, list[str]] = {
    FrictionZone.timing_mismatch: [
        "Ты любишь начинать; партнёр — доделывать. Часто кажется, что вы на одном поле, но на самом деле на разных его концах.",
        "Один из вас ускоряется, когда другой замедляется. Это не сбой, а две разные передачи.",
        "Тебе нужен импульс, партнёру — пауза. Долго это выглядит как несовпадение, потом — как баланс.",
    ],
    FrictionZone.phase_mismatch: [
        "Один из вас сейчас в режиме завершений, другой — в режиме начинаний. На одном языке об этом говорить трудно.",
        "У одного фаза «дочитать главу», у другого — «открыть новую». В этом нет правых, есть разный шаг.",
    ],
    FrictionZone.energy_mismatch: [
        "У одного из вас сегодня запас на разговоры, у другого — на тишину. Пара живёт в режиме приливов и отливов.",
        "Тебе важно проговорить, партнёру — выдержать паузу. Это не отстранение, а другой способ думать.",
    ],
    FrictionZone.depth_mismatch: [
        "Один уходит в детали, другой держит общую картину. Каждый раз кажется, что «не слышит» — на самом деле смотрит с другой высоты.",
        "Ты проверяешь словом, партнёр — молчанием. Оба — способы доверять, просто разные.",
    ],
    FrictionZone.rhythm_match: [
        "Сегодня вы в одном ритме. Это редкий день: его легко не заметить, потому что нечему сопротивляться.",
        "Совпадающий день — короткое окно, когда не нужно сверяться. Стоит просто им воспользоваться.",
    ],
    FrictionZone.complementary_pair: [
        "Вы устроены по-разному, и это заметно даже в мелочах: один достраивает то, чего у другого нет в запасе.",
        "Каждый из вас закрывает то, что второй обычно бросает на полпути. Это рабочая, но не очевидная связка.",
    ],
}

_FRICTION_BY_ZONE: dict[FrictionZone, list[str]] = {
    FrictionZone.timing_mismatch: [
        "Ваша типичная зона трения — разная скорость. Партнёру кажется, что ты тормозишь; тебе — что он спешит. Чаще всего оба чувства справедливы.",
        "Расхождение по темпу — повторяющийся сюжет. Срабатывает не в важных решениях, а в бытовых мелочах.",
    ],
    FrictionZone.phase_mismatch: [
        "Зона трения — несовпадение фаз. Один хочет подвести черту, другой — начать заново; договариваться об этом сложнее, чем кажется.",
    ],
    FrictionZone.energy_mismatch: [
        "Типичное трение — разная социальная нагрузка. Одному нужно с кем-то побыть; другому — побыть наедине.",
    ],
    FrictionZone.depth_mismatch: [
        "Чаще всего вы спорите не о сути, а о масштабе. Один спрашивает «как именно», другой отвечает «в общем».",
    ],
    FrictionZone.rhythm_match: [
        "Когда ритм совпадает, исчезает обычная зона трения — но появляется другая: легко не заметить, что важное прошло мимо.",
    ],
    FrictionZone.complementary_pair: [
        "Дополняющая пара чаще спорит о приоритетах, чем о фактах. Не «что произошло», а «что из этого важнее».",
    ],
}

_STRENGTH_BY_ZONE: dict[FrictionZone, list[str]] = {
    FrictionZone.timing_mismatch: [
        "Сильная сторона — именно разная скорость. Вы закрываете то, что пары одной скорости бросают на полпути.",
        "Из разности темпов получается ресурс: один не даёт остыть, другой — спешить.",
    ],
    FrictionZone.phase_mismatch: [
        "Когда фазы расходятся, у пары есть редкое преимущество — кто-то всегда видит следующий шаг.",
    ],
    FrictionZone.energy_mismatch: [
        "Разная социальная нагрузка даёт паре дыхание: дом не превращается ни в проходной двор, ни в крепость.",
    ],
    FrictionZone.depth_mismatch: [
        "Один держит детали, другой — масштаб. Важные решения от такой пары почти не уходят недодуманными.",
    ],
    FrictionZone.rhythm_match: [
        "Когда ритм совпадает, у пары появляется лёгкость, которая редко дана надолго. Это запас, а не норма.",
    ],
    FrictionZone.complementary_pair: [
        "Ваша связка устроена так, что ни один из вас не остаётся один на своей задаче — это не банальность, это редкость.",
    ],
}


def _fnv1a(s: str) -> int:
    """FNV-1a 32-bit. Нужен только для стабильного выбора шаблона.
    Должен совпадать с реализацией в web/lib/observations.ts."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def _pick(arr: list[str], seed: int) -> str:
    if not arr:
        raise ValueError("empty_template_set")
    return arr[seed % len(arr)]


def build_observations(
    birth_date_user: str,
    birth_date_partner: str,
    context: PairContext,
) -> list[Observation]:
    """Сборка трёх наблюдений. Стабильна для одинакового входа."""
    seed = _fnv1a(
        f"{birth_date_user}|{birth_date_partner}|{context.friction.value}|"
        f"{context.user.personal_day}|{context.partner.personal_day}"
    )

    return [
        Observation(
            kind="dynamic",
            text=_pick(_DYNAMIC_BY_FRICTION[context.friction], seed),
        ),
        Observation(
            kind="friction",
            text=_pick(_FRICTION_BY_ZONE[context.friction], seed >> 8),
        ),
        Observation(
            kind="strength",
            text=_pick(_STRENGTH_BY_ZONE[context.friction], seed >> 16),
        ),
    ]
