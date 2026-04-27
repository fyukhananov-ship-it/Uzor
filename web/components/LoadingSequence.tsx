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
    <ol className="space-y-3" aria-live="polite">
      {STEPS.map((label, i) => {
        const state =
          i < step ? "done" : i === step ? "active" : "pending";
        return (
          <li
            key={label}
            className={
              "flex items-center gap-3 text-body transition-opacity duration-200 " +
              (state === "pending" ? "opacity-30" : "opacity-100")
            }
          >
            <span
              aria-hidden
              className={
                "w-2 h-2 rounded-full transition-colors duration-200 " +
                (state === "done"
                  ? "bg-ink"
                  : state === "active"
                  ? "bg-sage animate-pulse"
                  : "bg-line")
              }
            />
            <span className={state === "done" ? "text-ink" : "text-ink-muted"}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
