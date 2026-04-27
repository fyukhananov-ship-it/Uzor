import { NextResponse } from "next/server";
import { sessionRequestSchema } from "@/lib/validation";
import { createSession, BackendError } from "@/lib/backend";
import { checkRateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit";

// PRD §13.1: лендинг — тонкий проксирующий слой над backend FastAPI.
// Этот route делает три вещи и больше ничего:
//   1. Edge rate-limit per-IP (защита от cost runaway на стороне backend).
//   2. Быстрая zod-валидация дат (короткое замыкание без сетевого вызова).
//   3. Проброс в backend POST /session, прозрачный возврат ответа.

export const runtime = "nodejs";
// Backend сам ограничен 8 сек на LLM + сеть; +4 сек запаса.
export const maxDuration = 30;

export async function POST(request: Request) {
  const rl = checkRateLimit(rateLimitKeyFromRequest(request));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.retryAfterSeconds },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = await createSession(parsed.data);
    return NextResponse.json(session, { status: 201 });
  } catch (e) {
    return handleBackendError(e);
  }
}

/** Локализованный fallback для типичных backend-ошибок. UI показывает
 *  обобщённое сообщение, в логе остаётся точная причина. */
function handleBackendError(e: unknown): Response {
  if (e instanceof BackendError) {
    if (e.status >= 400 && e.status < 500) {
      // Ретранслируем валидационные ошибки backend почти как есть.
      return new Response(e.bodyText || JSON.stringify({ error: "backend_rejected" }), {
        status: e.status,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("[backend] 5xx response:", e.status, e.bodyText.slice(0, 500));
  } else {
    console.error("[backend] unreachable or timed out:", e);
  }
  return NextResponse.json(
    { error: "backend_unavailable" },
    { status: 503 },
  );
}
