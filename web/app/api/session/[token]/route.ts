import { NextResponse } from "next/server";
import { BackendError, getSession } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const session = await getSession(token);
    if (!session) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (e) {
    if (e instanceof BackendError) {
      console.error("[backend] error reading session:", e.status, e.bodyText.slice(0, 200));
    } else {
      console.error("[backend] unreachable on GET /session:", e);
    }
    return NextResponse.json({ error: "backend_unavailable" }, { status: 503 });
  }
}
