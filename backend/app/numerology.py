"""Детерминированный нумерологический движок (PRD §10.4).

Порт с web/lib/numerology.ts. Контракт идентичен — те же входы дают те же
выходы, чтобы лендинг и backend выдавали одинаковые наблюдения.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from enum import StrEnum


class FrictionZone(StrEnum):
    timing_mismatch = "timing_mismatch"
    phase_mismatch = "phase_mismatch"
    energy_mismatch = "energy_mismatch"
    depth_mismatch = "depth_mismatch"
    rhythm_match = "rhythm_match"
    complementary_pair = "complementary_pair"


@dataclass(frozen=True)
class NumerologyContext:
    life_path: int
    personal_year: int
    personal_month: int
    personal_day: int


@dataclass(frozen=True)
class PairContext:
    user: NumerologyContext
    partner: NumerologyContext
    pair_cycle: str
    friction: FrictionZone
    date: str  # ISO YYYY-MM-DD


_FAST_DAYS = {1, 3, 5}
_SLOW_DAYS = {4, 7}
_MASTER_NUMBERS = {11, 22, 33}


def reduce(n: int, preserve_masters: bool = False) -> int:
    """Свести число к одной цифре.
    Master numbers (11/22/33) сохраняются только при preserve_masters=True.
    Используется для life_path; personal_day/month/year редуцируются полностью.
    """
    value = abs(int(n))
    while value > 9:
        if preserve_masters and value in _MASTER_NUMBERS:
            return value
        value = sum(int(d) for d in str(value))
    return value


def life_path(birth: date) -> int:
    return reduce(reduce(birth.year) + reduce(birth.month) + reduce(birth.day), preserve_masters=True)


def personal_year(birth: date, year: int) -> int:
    return reduce(reduce(birth.month) + reduce(birth.day) + reduce(year))


def personal_month(py: int, month: int) -> int:
    return reduce(py + month)


def personal_day(pm: int, day: int) -> int:
    return reduce(pm + day)


def compute_context(birth: date, today: date) -> NumerologyContext:
    py = personal_year(birth, today.year)
    pm = personal_month(py, today.month)
    pd = personal_day(pm, today.day)
    return NumerologyContext(
        life_path=life_path(birth),
        personal_year=py,
        personal_month=pm,
        personal_day=pd,
    )


def detect_friction(user: NumerologyContext, partner: NumerologyContext) -> FrictionZone:
    """Эвристика «зоны трения» (PRD §10.4).

    6 категорий покрывают основные сценарии. v1.5 расширяет до 15–20 правил;
    интерфейс при этом не меняется — добавляются новые ветки выше.
    """
    u, p = user.personal_day, partner.personal_day

    if (u in _FAST_DAYS and p in _SLOW_DAYS) or (p in _FAST_DAYS and u in _SLOW_DAYS):
        return FrictionZone.timing_mismatch
    if (u == 9 and p == 1) or (u == 1 and p == 9):
        return FrictionZone.phase_mismatch
    if (u == 5 and p == 2) or (u == 2 and p == 5):
        return FrictionZone.energy_mismatch
    if (u == 7 and p == 3) or (u == 3 and p == 7):
        return FrictionZone.depth_mismatch
    if u == p:
        return FrictionZone.rhythm_match
    return FrictionZone.complementary_pair


def pair_context_of(
    birth_user: date,
    birth_partner: date,
    today: date | None = None,
) -> PairContext:
    if today is None:
        today = datetime.now(UTC).date()

    user = compute_context(birth_user, today)
    partner = compute_context(birth_partner, today)
    return PairContext(
        user=user,
        partner=partner,
        pair_cycle=f"{user.personal_year}/{partner.personal_year}",
        friction=detect_friction(user, partner),
        date=today.isoformat(),
    )
