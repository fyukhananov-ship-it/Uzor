import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/session-store";
import { ObservationCard } from "@/components/ObservationCard";
import { ShareActions } from "./share-actions";

// Shared compatibility page (PRD §6.3, §3.3).
// Главное правило: партнёр, открывший ссылку, видит сразу разбор —
// никаких «установите приложение» сверху. Иначе вкладка закрывается.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const session = getSession(token);
  if (!session) return {};
  const first = session.observations[0]?.text ?? "";
  return {
    title: "Разбор пары",
    description: first,
    openGraph: {
      title: "Разбор пары",
      description: first,
      type: "article",
    },
  };
}

export default async function SharedPairPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = getSession(token);
  if (!session) {
    notFound();
  }

  return (
    <div className="container-prose py-12 sm:py-16">
      <p className="text-sm text-ink-faint mb-3">Разбор пары</p>
      <h1 className="font-serif text-subdisplay">
        Что заметила нумерология о вас двоих
      </h1>
      <p className="mt-3 text-body text-ink-muted">
        Это не предсказание и не диагноз. Это короткое наблюдение,
        собранное по двум датам рождения.
      </p>

      <div className="mt-8 grid gap-4">
        {session.observations.map((o) => (
          <ObservationCard key={o.kind} observation={o} />
        ))}
      </div>

      <hr className="border-line/60 my-12" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="font-serif text-lg">Хочешь посмотреть со своей стороны?</h2>
          <p className="mt-3 text-body text-ink-muted">
            В приложении у каждого появляется собственный угол зрения.
            Никаких уведомлений партнёру без согласия.
          </p>
        </div>
        <div className="flex flex-col gap-3 self-end">
          <a href="/pricing" className="btn-primary">
            Установить приложение
          </a>
          <ShareActions token={session.token} />
        </div>
      </div>
    </div>
  );
}
