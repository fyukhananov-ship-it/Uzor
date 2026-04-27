import { NextResponse } from "next/server";
import { sessionRequestSchema } from "@/lib/validation";
import { pairContextOf } from "@/lib/numerology";
import { generateObservations } from "@/lib/llm";
import { createSession } from "@/lib/session-store";
import { checkRateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
// LLM-вызов с adaptive thinking может занять до ~6 сек (см. PRD §13.2).
// Просим Vercel/прод-окружение не убивать функцию преждевременно.
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

  const { birthDateUser, birthDatePartner } = parsed.data;
  const context = pairContextOf(birthDateUser, birthDatePartner);
  const { observations } = await generateObservations(
    birthDateUser,
    birthDatePartner,
    context,
  );

  const session = createSession({
    birthDateUser,
    birthDatePartner,
    observations,
    context,
  });

  return NextResponse.json(session, { status: 201 });
}
