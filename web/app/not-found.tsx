import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-narrow py-24 text-center">
      <h1 className="font-serif text-subdisplay">Страница не найдена</h1>
      <p className="mt-3 text-body text-ink-muted">
        Возможно, ссылка устарела — анонимная сессия живёт семь дней.
      </p>
      <Link href="/" className="btn-primary mt-8 inline-flex">
        На главную
      </Link>
    </div>
  );
}
