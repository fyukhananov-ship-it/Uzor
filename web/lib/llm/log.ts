// AIGenerationLog stub (PRD §10.7 / §14.6).
//
// Каждая генерация (LLM или fallback) логируется со всем контекстом и
// метаинформацией. На лендинге пишем в stderr; в production это уйдёт
// в backend → Postgres-таблицу AIGenerationLog (см. PRD §9.1).
//
// Reaction-данные подключатся с feedback widgets в приложении (PRD §14.4).
// Совокупный набор {context, output, reaction} — calibration dataset
// для Knowledge Layer v1.5.

import type { Observation, PairContext } from "@/types";
import type { ClaudeGenerationMeta } from "./claude";

export type GenerationSource = "claude" | "template_primary" | "template_fallback";

export type GenerationLogEntry = {
  generationId: string;
  generationType: "wow_screen";
  source: GenerationSource;
  birthDateUser: string;
  birthDatePartner: string;
  context: PairContext;
  observations: Observation[];
  claudeMeta?: ClaudeGenerationMeta;
  errorMessage?: string;
  occurredAt: string;
};

export function logGeneration(entry: Omit<GenerationLogEntry, "generationId" | "occurredAt">): GenerationLogEntry {
  const full: GenerationLogEntry = {
    ...entry,
    generationId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
  };

  // Компактный stderr-лог: легко грепать по `[ai-gen]`.
  const summary = {
    id: full.generationId,
    src: full.source,
    friction: full.context.friction,
    err: full.errorMessage,
    tokens: full.claudeMeta
      ? `in=${full.claudeMeta.inputTokens}+cache_r=${full.claudeMeta.cacheReadInputTokens} out=${full.claudeMeta.outputTokens} ${full.claudeMeta.latencyMs}ms`
      : undefined,
  };
  console.info("[ai-gen]", JSON.stringify(summary));

  return full;
}
