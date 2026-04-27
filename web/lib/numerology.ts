// Детерминированный нумерологический движок (PRD §10.4).
// LLM не используется: расчёт чисто числовой, повторяемый.
// В v1.5 этот же движок переедет в Python backend как источник истины.

import type { ISODate, NumerologyContext, PairContext, FrictionZone } from "@/types";

/**
 * Свести число к одной цифре. Master numbers (11/22/33) сохраняются,
 * только когда `preserveMasters=true` (используется для life path).
 */
export function reduce(n: number, preserveMasters = false): number {
  let value = Math.abs(Math.floor(n));
  while (value > 9) {
    if (preserveMasters && (value === 11 || value === 22 || value === 33)) {
      return value;
    }
    let sum = 0;
    while (value > 0) {
      sum += value % 10;
      value = Math.floor(value / 10);
    }
    value = sum;
  }
  return value;
}

function parseISODate(d: ISODate): { y: number; m: number; d: number } {
  const [y, m, day] = d.split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
    throw new Error(`invalid_date: ${d}`);
  }
  return { y, m, d: day };
}

export function lifePath(birth: ISODate): number {
  const { y, m, d } = parseISODate(birth);
  return reduce(reduce(y) + reduce(m) + reduce(d), true);
}

export function personalYear(birth: ISODate, year: number): number {
  const { m, d } = parseISODate(birth);
  return reduce(reduce(m) + reduce(d) + reduce(year));
}

export function personalMonth(py: number, month: number): number {
  return reduce(py + month);
}

export function personalDay(pm: number, day: number): number {
  return reduce(pm + day);
}

export function computeContext(birth: ISODate, today: Date): NumerologyContext {
  const py = personalYear(birth, today.getUTCFullYear());
  const pm = personalMonth(py, today.getUTCMonth() + 1);
  const pd = personalDay(pm, today.getUTCDate());
  return {
    lifePath: lifePath(birth),
    personalYear: py,
    personalMonth: pm,
    personalDay: pd,
  };
}

/**
 * Эвристика «зоны трения» (PRD §10.4). Это не предсказание, а описание
 * вероятной точки рассогласования. В v1 — 6 категорий; контентная команда
 * может расширить до 15–20 правил без изменения интерфейса.
 */
export function detectFriction(
  user: NumerologyContext,
  partner: NumerologyContext,
): FrictionZone {
  const fast = new Set([1, 3, 5]);
  const slow = new Set([4, 7]);

  const u = user.personalDay;
  const p = partner.personalDay;

  if ((fast.has(u) && slow.has(p)) || (fast.has(p) && slow.has(u))) {
    return "timing_mismatch";
  }
  if ((u === 9 && p === 1) || (u === 1 && p === 9)) {
    return "phase_mismatch";
  }
  if ((u === 5 && p === 2) || (u === 2 && p === 5)) {
    return "energy_mismatch";
  }
  if ((u === 7 && p === 3) || (u === 3 && p === 7)) {
    return "depth_mismatch";
  }
  if (u === p) {
    return "rhythm_match";
  }
  // Числа из дополняющих троек: (1,2), (4,8), (3,6) и зеркальные — мягкая комплементарность.
  return "complementary_pair";
}

export function pairContextOf(
  birthDateUser: ISODate,
  birthDatePartner: ISODate,
  today: Date = new Date(),
): PairContext {
  const user = computeContext(birthDateUser, today);
  const partner = computeContext(birthDatePartner, today);
  return {
    user,
    partner,
    pairCycle: `${user.personalYear}/${partner.personalYear}`,
    friction: detectFriction(user, partner),
    date: today.toISOString().slice(0, 10),
  };
}
