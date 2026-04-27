// Anthropic-клиент для генерации наблюдений wow-экрана.
//
// Архитектура (соответствует PRD §10.3 и §13.2):
//   — системный промпт стабилен между запросами и кэшируется через
//     `cache_control: ephemeral` (≈90% скидки на повторных вызовах);
//   — пользовательский промпт несёт нумерологический контекст пары;
//   — выход — структурированный JSON через `output_config.format` + Zod;
//   — модель `claude-opus-4-7` по умолчанию, переопределяется через
//     UZOR_LLM_MODEL для cost-sensitive сценариев;
//   — adaptive thinking + effort=high — тон-критичная задача, экономить
//     на качестве здесь нельзя.
//
// PRD §13.2 предполагает, что в production это вызывается из backend
// через OpenRouter (так как Anthropic блокирует РФ-IP). На лендинге для
// разработки и для нероссийских деплоев лендинг ходит в Anthropic напрямую.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { PairContext } from "@/types";

// Намеренно НЕ используем `zodOutputFormat` из SDK helpers/zod: его types
// объявлены против Zod v3, а runtime — против Zod v4 API (`z.toJSONSchema`).
// На объёме «3 строковых поля» проще описать JSON-Schema руками и
// валидировать ответ через Zod уже после parse — клиент остаётся типобезопасным
// и не зависит от внутреннего bug-а SDK helper-а.

// Системный промпт — стабильная часть, попадает в кэш.
// Формулировки из PRD §10.1 и §10.3.
const SYSTEM_PROMPT = `Ты — внутренний голос продукта Узор. Узор использует нумерологию и астрологию как структурированный язык для самонаблюдения, не как систему веры.

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

Опираешься на нумерологический контекст пары, который тебе передан, но никогда не упоминаешь конкретные числа в тексте — переводи их в наблюдения о поведении.`;

const ObservationsSchema = z.object({
  dynamic: z.string().min(20).max(180),
  friction: z.string().min(20).max(180),
  strength: z.string().min(20).max(180),
});

export type ClaudeObservations = z.infer<typeof ObservationsSchema>;

// JSON-Schema для output_config.format — то же, что валидирует Zod выше.
const OBSERVATIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    dynamic: {
      type: "string",
      description:
        "Одно предложение об общей динамике пары. Не длиннее 140 символов.",
    },
    friction: {
      type: "string",
      description:
        "Одно предложение о вероятной зоне трения. Не длиннее 140 символов.",
    },
    strength: {
      type: "string",
      description:
        "Одно предложение о сильной стороне пары. Не длиннее 140 символов.",
    },
  },
  required: ["dynamic", "friction", "strength"],
  additionalProperties: false,
} as const;

const FRICTION_HINT: Record<PairContext["friction"], string> = {
  timing_mismatch: "разная скорость / темп",
  phase_mismatch: "несовпадение фаз (завершения и начинания)",
  energy_mismatch: "разная социальная нагрузка",
  depth_mismatch: "разный масштаб внимания (детали vs общая картина)",
  rhythm_match: "совпадающий ритм",
  complementary_pair: "взаимодополняющая пара",
};

function buildUserPrompt(
  birthDateUser: string,
  birthDatePartner: string,
  context: PairContext,
): string {
  return [
    `Дата сегодня: ${context.date}.`,
    "",
    "Контекст пары (только для тебя, в тексте на это не ссылайся):",
    `— У тебя personal_day=${context.user.personalDay}, personal_year=${context.user.personalYear}, life_path=${context.user.lifePath}.`,
    `— У партнёра personal_day=${context.partner.personalDay}, personal_year=${context.partner.personalYear}, life_path=${context.partner.lifePath}.`,
    `— Pair cycle: ${context.pairCycle}.`,
    `— Вероятная зона трения по нумерологическим правилам: ${context.friction} (${FRICTION_HINT[context.friction]}).`,
    `— Даты рождения: ${birthDateUser} и ${birthDatePartner}.`,
    "",
    "Сгенерируй три наблюдения (dynamic, friction, strength) в указанном тоне.",
    "Не упоминай в тексте числа, нумерологию, астрологию явно — пиши о паттернах поведения.",
  ].join("\n");
}

export type ClaudeGenerationMeta = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  latencyMs: number;
};

export type ClaudeGenerationResult = {
  observations: ClaudeObservations;
  meta: ClaudeGenerationMeta;
};

export async function generateObservationsWithClaude(
  birthDateUser: string,
  birthDatePartner: string,
  context: PairContext,
): Promise<ClaudeGenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const model = process.env.UZOR_LLM_MODEL ?? "claude-opus-4-7";
  const client = new Anthropic({ apiKey });

  const startedAt = Date.now();
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    // Adaptive thinking — модель сама решает, сколько думать. На Opus 4.7
    // это единственный поддерживаемый режим: budget_tokens вернёт 400.
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Кэш системного промпта: первая генерация платит ~1.25× за запись,
        // последующие — ~0.1× за чтение. На объёме wow-экрана окупается
        // буквально с второго запроса (см. PRD §13.10 cost optimization).
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: OBSERVATIONS_JSON_SCHEMA,
      },
      // Тон-критичная задача (под-персона B особенно чувствительна к качеству
      // текста, PRD §3.2.8). Effort=high балансирует качество и токены —
      // имеет смысл повышать до xhigh/max только после A/B-тестирования.
      effort: "high",
    },
    messages: [
      {
        role: "user",
        content: buildUserPrompt(birthDateUser, birthDatePartner, context),
      },
    ],
  });

  // С `output_config.format=json_schema` первый text-блок гарантированно
  // содержит валидный JSON (PRD §13.2). Парсим и пропускаем через Zod —
  // получаем типобезопасный объект и информативные ошибки при дрейфе схемы.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("no_text_block_in_response");
  }
  const json = JSON.parse(textBlock.text);
  const validated = ObservationsSchema.safeParse(json);
  if (!validated.success) {
    throw new Error(
      `schema_validation_failed: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const parsed = validated.data;

  // Дополнительная линия защиты тона: ловим запрещённые слова и знаки
  // в случаях, когда модель прошла schema-валидацию, но «соскользнула»
  // в гороскопный регистр.
  validateTone(parsed);

  return {
    observations: parsed,
    meta: {
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    },
  };
}

const FORBIDDEN = [
  /звёзд/i,
  /судьб/i,
  /карм/i,
  /вселенн/i,
  /эзотерич/i,
  /гороскоп/i,
];

function validateTone(o: ClaudeObservations) {
  for (const [key, text] of Object.entries(o)) {
    if (text.includes("!") || /[\u{1F300}-\u{1FAFF}]/u.test(text)) {
      throw new Error(`tone_violation_punctuation:${key}`);
    }
    for (const re of FORBIDDEN) {
      if (re.test(text)) {
        throw new Error(`tone_violation_word:${key}`);
      }
    }
  }
}
