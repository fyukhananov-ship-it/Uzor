"use client";

import { useEffect, useState } from "react";

// Loading-последовательность wow-экрана (Приложение Б).
// Три шага по ~700 мс — общая «честная» длительность ≈2.1 сек,
// чтобы не выглядело мгновенно, но и не дольше реального ответа API.

const STEPS = [
  "Читаем твою карту",
  "Читаем карту партнёра",
  "Ищем совпадения",
] as const;

export function LoadingSequence({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <ol className="space-y-4" aria-live="polite">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "active" : "pending";
        return (
          <li
            key={label}
            className={
              "flex items-baseline gap-4 transition-opacity duration-200 ease-out-soft " +
              (state === "pending" ? "opacity-25" : "opacity-100")
            }
          >
            <span className="kicker tabular-nums text-ink-faint w-6">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              aria-hidden
              className={
                "block h-px transition-all duration-200 ease-out-soft " +
                (state === "done"
                  ? "w-10 bg-ink"
                  : state === "active"
                  ? "w-10 bg-sage animate-pulse"
                  : "w-6 bg-line")
              }
            />
            <span
              className={
                "font-serif text-lead " +
                (state === "done" ? "text-ink" : "text-ink-muted")
              }
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
