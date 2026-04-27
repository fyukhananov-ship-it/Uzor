import { NextResponse } from "next/server";
import { waitlistRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

// [ОТКРЫТО]: интеграция с email-провайдером (Unisender / SendPulse).
// PRD §13.1: deliverability magic-link на yandex/mail.ru/gmail должен быть
// проверен до фиксации провайдера. Пока — лог в консоль, чтобы данные
// не терялись в dev и можно было увидеть конверсию.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = waitlistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  console.info("[waitlist] new entry:", parsed.data.email);
  return NextResponse.json({ ok: true });
}
