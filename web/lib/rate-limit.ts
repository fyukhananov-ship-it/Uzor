// Простой in-memory rate limiter per ключу (например, IP).
//
// PRD §13.2: «Rate limiting per user (защита от cost runaway)».
// LLM-вызов с adaptive thinking стоит реальных денег — без лимита один
// бот может прокрутить тысячи долларов за ночь.
//
// На production это переедет в Redis (там же, где session store) и
// получит fingerprint-ключ от backend (PRD §13.6 «Rate limiting public
// endpoints»). На лендинге — заглушка, которая работает в одном
// процессе Next.js. При горизонтальном масштабировании Map окажется
// per-instance, что в первой итерации продакшна не страшно (лимит просто
// размножится по числу инстансов).

const WINDOW_MS = 60 * 60 * 1000; // 1 час
const MAX_PER_WINDOW = 8; // лендинговая wow-генерация на один IP

type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as {
  __uzor_rate_buckets?: Map<string, Bucket>;
};
const buckets: Map<string, Bucket> =
  globalForRl.__uzor_rate_buckets ?? new Map<string, Bucket>();
globalForRl.__uzor_rate_buckets = buckets;

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function checkRateLimit(key: string): RateLimitDecision {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

/**
 * Извлечь ключ для rate-limit из заголовков запроса. На локалке это
 * фактически 127.0.0.1 для всех; в production за reverse proxy нужен
 * X-Forwarded-For (Vercel / Cloudflare ставят его автоматически).
 */
export function rateLimitKeyFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // X-Forwarded-For = «client, proxy1, proxy2». Берём первый.
    return xff.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
