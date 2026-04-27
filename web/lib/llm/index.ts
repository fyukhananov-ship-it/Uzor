// Unified LLM-интерфейс с graceful fallback.
//
// Стратегия:
//   1. Если ANTHROPIC_API_KEY задан — пробуем Claude.
//   2. На любую ошибку (сеть, тон-валидация, парсинг, тайм-аут, лимит)
//      падаем на детерминированный шаблонный генератор.
//   3. Без ключа — сразу шаблоны, без сетевых попыток.
//
// Это критично для UX wow-экрана: PRD §6.1 фиксирует загрузку ≤4 сек.
// Шаблонный fallback — за единицы миллисекунд; Claude — обычно 1.5–4 сек
// с adaptive thinking, в худшем случае таймаут. Любой сценарий не должен
// приводить к 500 на лендинге.

import type { Observation, PairContext } from "@/types";
import { buildObservations as buildFromTemplates } from "@/lib/observations";
import { generateObservationsWithClaude } from "./claude";
import { logGeneration } from "./log";

const CLAUDE_TIMEOUT_MS = 8_000;

export type LlmProviderResult = {
  observations: Observation[];
  source: "claude" | "template_primary" | "template_fallback";
};

export async function generateObservations(
  birthDateUser: string,
  birthDatePartner: string,
  context: PairContext,
): Promise<LlmProviderResult> {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (!hasApiKey) {
    const observations = buildFromTemplates(birthDateUser, birthDatePartner, context);
    logGeneration({
      generationType: "wow_screen",
      source: "template_primary",
      birthDateUser,
      birthDatePartner,
      context,
      observations,
    });
    return { observations, source: "template_primary" };
  }

  try {
    const { observations, meta } = await withTimeout(
      generateObservationsWithClaude(birthDateUser, birthDatePartner, context),
      CLAUDE_TIMEOUT_MS,
    );
    const result: Observation[] = [
      { kind: "dynamic", text: observations.dynamic },
      { kind: "friction", text: observations.friction },
      { kind: "strength", text: observations.strength },
    ];
    logGeneration({
      generationType: "wow_screen",
      source: "claude",
      birthDateUser,
      birthDatePartner,
      context,
      observations: result,
      claudeMeta: meta,
    });
    return { observations: result, source: "claude" };
  } catch (e) {
    const fallback = buildFromTemplates(birthDateUser, birthDatePartner, context);
    logGeneration({
      generationType: "wow_screen",
      source: "template_fallback",
      birthDateUser,
      birthDatePartner,
      context,
      observations: fallback,
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    return { observations: fallback, source: "template_fallback" };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("llm_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}
