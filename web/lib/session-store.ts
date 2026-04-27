// In-memory store анонимных сессий wow-экрана.
//
// PRD §13.2: на проде это Redis с TTL 7 дней. Здесь — заглушка, чтобы
// лендинг работал автономно. Перевести на Redis тривиально: один интерфейс
// `SessionStore`, две реализации.
//
// [ОТКРЫТО]: интеграция с backend FastAPI — endpoint POST /session создаст
// токен на стороне backend, лендинг будет дёргать его прокси-роутом.

import type { SessionPayload } from "@/types";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = {
  payload: SessionPayload;
  expiresAt: number;
};

// В Next.js dev сервер пересоздаётся при HMR. Прячем Map в globalThis,
// чтобы анонимные сессии переживали правки кода в dev-режиме.
const globalForStore = globalThis as unknown as {
  __uzor_sessions?: Map<string, Entry>;
};

const sessions: Map<string, Entry> =
  globalForStore.__uzor_sessions ?? new Map<string, Entry>();
globalForStore.__uzor_sessions = sessions;

function generateToken(): string {
  // crypto.randomUUID есть в Node 18+ и в современных браузерах.
  return crypto.randomUUID();
}

function sweepExpired(now: number) {
  for (const [token, entry] of sessions) {
    if (entry.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

export function createSession(
  payload: Omit<SessionPayload, "token" | "createdAt" | "expiresAt">,
): SessionPayload {
  const now = Date.now();
  sweepExpired(now);

  const token = generateToken();
  const full: SessionPayload = {
    ...payload,
    token,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  sessions.set(token, { payload: full, expiresAt: now + TTL_MS });
  return full;
}

export function getSession(token: string): SessionPayload | null {
  const entry = sessions.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return entry.payload;
}
