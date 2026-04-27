import { NextResponse } from "next/server";
import { sessionRequestSchema } from "@/lib/validation";
import { pairContextOf } from "@/lib/numerology";
import { buildObservations } from "@/lib/observations";
import { createSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
  const observations = buildObservations(birthDateUser, birthDatePartner, context);

  const session = createSession({
    birthDateUser,
    birthDatePartner,
    observations,
    context,
  });

  return NextResponse.json(session, { status: 201 });
}
