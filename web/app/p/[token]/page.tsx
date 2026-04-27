import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/backend";
import { ObservationCard } from "@/components/ObservationCard";
import { TransparencyStrip } from "@/components/TransparencyStrip";
import { ShareActions } from "./share-actions";

// Shared compatibility page (PRD §6.3, §3.3).
// Главное правило: партнёр, открывший ссылку, видит сразу разбор —
// никаких «установите приложение» сверху. Иначе вкладка закрывается.
// Та же редакторская подача, что и на /start: kicker → display-serif →
// transparency strip, чтобы партнёр получил ровно тот же артефакт,
// что отправил основной пользователь.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  // Если backend недоступен на этапе пререндера — отдаём пустые meta,
  // основной flow всё равно покажет 404 ниже в SharedPairPage.
  const session = await getSession(token).catch(() => null);
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
  const session = await getSession(token);
  if (!session) {
    notFound();
  }

  return (
    <div className="container-prose py-16 sm:py-24">
      <div className="motion-settle delay-0 mb-6 flex items-center gap-3 text-rose">
        <span aria-hidden className="ornament-line" />
        <span className="kicker">Разбор пары · Узор</span>
      </div>

      <h1 className="motion-settle delay-80 font-serif text-subdisplay">
        Что заметила нумерология о&nbsp;вас <em>двоих</em>
      </h1>

      <p className="motion-settle delay-160 mt-4 text-body text-ink-muted max-w-prose">
        Это не предсказание и не диагноз. Это короткое наблюдение,
        собранное по&nbsp;двум датам рождения.
      </p>

      <div className="mt-12">
        {session.observations.map((o, i) => (
          <ObservationCard
            key={o.kind}
            observation={o}
            index={i}
            isLast={i === session.observations.length - 1}
          />
        ))}
      </div>

      <TransparencyStrip context={session.context} />

      <hr className="border-line/60 my-16" />

      <div className="grid gap-8 sm:grid-cols-5 items-start">
        <div className="sm:col-span-3">
          <p className="kicker text-sage mb-3">Дальше</p>
          <h2 className="font-serif text-lg">
            Хочешь посмотреть со&nbsp;своей стороны?
          </h2>
          <p className="mt-3 text-body text-ink-muted">
            В&nbsp;приложении у&nbsp;каждого появляется собственный угол
            зрения. Никаких уведомлений партнёру без согласия.
          </p>
        </div>
        <div className="sm:col-span-2 flex flex-col gap-3">
          <a href="/pricing" className="btn-primary">
            Установить приложение
          </a>
          <ShareActions token={session.token} />
        </div>
      </div>
    </div>
  );
}
