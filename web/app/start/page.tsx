"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BirthDateInput } from "@/components/BirthDateInput";
import { LoadingSequence } from "@/components/LoadingSequence";
import { ObservationCard } from "@/components/ObservationCard";
import { sessionRequestSchema } from "@/lib/validation";
import type { SessionPayload } from "@/types";

// Многошаговый онбординг (PRD §6.1).
// Шаги: твоя дата → дата партнёра → загрузка → результат.

type Step = "user" | "partner" | "loading" | "result";

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("user");
  const [birthDateUser, setBirthDateUser] = useState("");
  const [birthDatePartner, setBirthDatePartner] = useState("");
  const [errors, setErrors] = useState<{ user?: string; partner?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);

  function goToPartner() {
    const r = sessionRequestSchema.shape.birthDateUser.safeParse(birthDateUser);
    if (!r.success) {
      setErrors({ user: r.error.issues[0]?.message ?? "Неверная дата" });
      return;
    }
    setErrors({});
    setStep("partner");
  }

  async function submit() {
    const r = sessionRequestSchema.safeParse({ birthDateUser, birthDatePartner });
    if (!r.success) {
      const flat = r.error.flatten().fieldErrors;
      setErrors({
        user: flat.birthDateUser?.[0],
        partner: flat.birthDatePartner?.[0],
      });
      return;
    }
    setErrors({});
    setStep("loading");
    setServerError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(r.data),
      });
      if (!res.ok) {
        throw new Error(`http_${res.status}`);
      }
      const payload = (await res.json()) as SessionPayload;
      // Минимальная пауза, чтобы LoadingSequence успел отыграть честно.
      await new Promise((r) => setTimeout(r, 300));
      setSession(payload);
      setStep("result");
    } catch {
      setServerError(
        "Не удалось собрать разбор. Попробуй ещё раз через минуту.",
      );
      setStep("partner");
    }
  }

  return (
    <div className="container-narrow py-16 sm:py-24">
      {step === "user" && (
        <section>
          <p className="text-sm text-ink-faint mb-4">Шаг 1 из 2</p>
          <h1 className="font-serif text-subdisplay">Твоя дата рождения</h1>
          <p className="mt-3 text-body text-ink-muted">
            Этого хватит, чтобы посчитать твою сторону. Имя не нужно.
          </p>
          <div className="mt-8">
            <BirthDateInput
              id="birth-user"
              label="Дата рождения"
              value={birthDateUser}
              onChange={setBirthDateUser}
              error={errors.user}
              autoFocus
            />
          </div>
          <button onClick={goToPartner} className="btn-primary mt-8 w-full">
            Дальше
          </button>
        </section>
      )}

      {step === "partner" && (
        <section>
          <p className="text-sm text-ink-faint mb-4">Шаг 2 из 2</p>
          <h1 className="font-serif text-subdisplay">Дата рождения партнёра</h1>
          <p className="mt-3 text-body text-ink-muted">
            Партнёр пока не узнает об этом. Мы используем дату только
            для собственного разбора.
          </p>
          <div className="mt-8">
            <BirthDateInput
              id="birth-partner"
              label="Дата рождения"
              value={birthDatePartner}
              onChange={setBirthDatePartner}
              error={errors.partner}
              autoFocus
            />
          </div>
          {serverError ? (
            <p role="alert" className="mt-4 text-sm text-rose">
              {serverError}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button onClick={() => setStep("user")} className="btn-secondary">
              Назад
            </button>
            <button onClick={submit} className="btn-primary flex-1">
              Собрать разбор
            </button>
          </div>
        </section>
      )}

      {step === "loading" && (
        <section className="py-12">
          <h1 className="font-serif text-subdisplay">Собираем наблюдение</h1>
          <p className="mt-3 text-body text-ink-muted">
            Это займёт несколько секунд.
          </p>
          <div className="mt-10">
            <LoadingSequence />
          </div>
        </section>
      )}

      {step === "result" && session ? (
        <ResultView session={session} onShare={() => router.push(`/p/${session.token}`)} />
      ) : null}
    </div>
  );
}

function ResultView({
  session,
  onShare,
}: {
  session: SessionPayload;
  onShare: () => void;
}) {
  return (
    <section>
      <p className="text-sm text-ink-faint mb-4">Готово</p>
      <h1 className="font-serif text-subdisplay">Три коротких наблюдения</h1>
      <p className="mt-3 text-body text-ink-muted">
        Это рамка для разговора, не диагноз. Каждое наблюдение — повод
        присмотреться, не повод что-то менять.
      </p>

      <div className="mt-8 grid gap-4">
        {session.observations.map((o) => (
          <ObservationCard key={o.kind} observation={o} />
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-3">
        {/* PRD §6.1: первичная CTA — установка приложения через RuStore deep-link.
            До запуска приложения это плейсхолдер на /pricing. */}
        <a href="/pricing" className="btn-primary">
          Продолжить 7 дней бесплатно — установить приложение
        </a>
        <button onClick={onShare} className="btn-secondary">
          Отправить ей или ему
        </button>
      </div>

      <p className="mt-8 text-sm text-ink-faint">
        Расчёт построен на двух датах, которые ты ввёл. Никаких имён,
        никаких уведомлений партнёру.
      </p>
    </section>
  );
}
