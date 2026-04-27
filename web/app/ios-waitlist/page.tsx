"use client";

import { useState } from "react";
import { waitlistRequestSchema } from "@/lib/validation";

// Лист ожидания iOS-версии (PRD §3.6, §16). v1 — только Android,
// iOS — v2 через 6–9 месяцев. Сбор email активен с момента запуска.

type Status = "idle" | "submitting" | "ok" | "error";

export default function IosWaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = waitlistRequestSchema.safeParse({ email });
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? "Неверный email");
      return;
    }
    setError(null);
    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(r.data),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="container-narrow py-16 sm:py-24">
      <h1 className="font-serif text-subdisplay">Лист ожидания iOS</h1>
      <p className="mt-3 text-body text-ink-muted">
        В первой версии Узор есть только для Android. iOS — следующая
        большая глава, ориентир — 6–9 месяцев. Оставь email — напишем,
        когда будет.
      </p>

      {status === "ok" ? (
        <div className="mt-10 rounded-md border border-line/80 p-6 bg-canvas/40">
          <p className="font-serif text-lead">Записал.</p>
          <p className="mt-2 text-body text-ink-muted">
            Не будем писать чаще, чем нужно. Только когда iOS-версия
            появится в TestFlight и потом в App Store.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 flex flex-col gap-4" noValidate>
          <label htmlFor="email" className="text-sm text-ink-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="ты@почта.ру"
            aria-invalid={Boolean(error)}
          />
          {error ? (
            <p role="alert" className="text-sm text-rose">
              {error}
            </p>
          ) : null}
          {status === "error" ? (
            <p role="alert" className="text-sm text-rose">
              Что-то не отправилось. Попробуй ещё раз.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="btn-primary"
          >
            {status === "submitting" ? "Отправляем" : "Записать в лист ожидания"}
          </button>
          <p className="text-sm text-ink-faint">
            Только email. Никаких уведомлений до iOS-версии.
          </p>
        </form>
      )}
    </div>
  );
}
