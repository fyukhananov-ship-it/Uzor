// HTTP-клиент к backend FastAPI.
//
// Лендинг — тонкий слой над backend (PRD §13.1): нумерологический движок,
// LLM-конвейер и AIGenerationLog живут на стороне Python-сервиса. Web
// API routes (`/api/session*`) проксируют запросы и отдают ответы как есть.
//
// Сетевые ошибки прозрачны для UI — пробрасываются как обычные исключения,
// route handler ловит их и возвращает 503 с локализованным сообщением.

import type { SessionPayload } from "@/types";

const BACKEND_URL = process.env.UZOR_BACKEND_URL ?? "http://localhost:8000";
const BACKEND_TIMEOUT_MS = 12_000; // backend сам ждёт LLM до 8 сек, +4 на сеть

export class BackendError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
    message?: string,
  ) {
    super(message ?? `backend_${status}`);
    this.name = "BackendError";
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? BACKEND_TIMEOUT_MS,
  );
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new BackendError(res.status, body);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/** POST /session — создать анонимную wow-сессию. */
export function createSession(input: {
  birthDateUser: string;
  birthDatePartner: string;
}): Promise<SessionPayload> {
  return call<SessionPayload>("/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /session/{token} — прочитать анонимную сессию (для shared-page и
 *  для resume-flow при установке Android через Install Referrer). */
export async function getSession(token: string): Promise<SessionPayload | null> {
  try {
    return await call<SessionPayload>(`/session/${encodeURIComponent(token)}`);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) {
      return null;
    }
    throw e;
  }
}
