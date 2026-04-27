import Link from "next/link";

// Hero — PRD §6.1, лендинг-копирайт по позиционированию §2.3 и triggers §3.2.5.
// Тон сдержанный: без обещаний, без восклицаний, без «откройте судьбу».

export default function Home() {
  return (
    <div className="container-prose py-16 sm:py-24">
      <p className="text-sm uppercase tracking-widest text-ink-faint mb-6">
        Узор
      </p>
      <h1 className="font-serif text-display text-balance">
        Почему у вас снова тот же разговор.
      </h1>
      <p className="mt-6 text-lead text-ink-muted max-w-prose">
        Узор — это язык, на котором можно описать, что повторяется в паре.
        Нумерология здесь не предсказание, а структурированный способ
        наблюдать за собой и за тем, что происходит между двумя людьми.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link href="/start" className="btn-primary">
          Попробовать — 90 секунд
        </Link>
        <Link href="/about" className="btn-secondary">
          Что это вообще такое
        </Link>
      </div>

      <hr className="border-line/60 my-16" />

      <section className="grid gap-10 sm:grid-cols-3">
        <Three
          title="Не предсказание"
          body="Никаких «звёзд», «судьбы» и «энергий». Узор пишет на языке, который выдерживает скептический взгляд."
        />
        <Three
          title="Не для одного"
          body="Архитектура продукта — про двоих. Можно начать одному; партнёр подключается, когда сам захочет."
        />
        <Three
          title="Архив, не лента"
          body="Раз в неделю — Узор недели. Паттерн, который сложно заметить в моменте, но видно, если смотреть подряд."
        />
      </section>

      <hr className="border-line/60 my-16" />

      <section className="grid gap-8 sm:grid-cols-2 items-start">
        <div>
          <h2 className="font-serif text-subdisplay">Как устроено</h2>
          <p className="mt-4 text-body text-ink-muted">
            На лендинге достаточно двух дат рождения — твоей и партнёра.
            На основе этих дат мы соберём короткий разбор: про вашу
            динамику, про типичную зону трения и про сильную сторону.
          </p>
          <p className="mt-4 text-body text-ink-muted">
            Это не диагноз и не совет. Это попытка дать паре язык, на котором
            повторяющиеся сюжеты становится проще обсуждать без обвинений.
          </p>
        </div>
        <div className="rounded-md border border-line/80 p-6 bg-canvas/40">
          <p className="text-sm text-ink-faint mb-2">Пример наблюдения</p>
          <p className="font-serif text-lead">
            «Ты любишь начинать; партнёр — доделывать. Часто кажется, что
            вы на одном поле, но на самом деле на разных его концах.»
          </p>
        </div>
      </section>
    </div>
  );
}

function Three({ title, body }: { title: string; body: string }) {
  return (
    <article>
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="mt-3 text-body text-ink-muted">{body}</p>
    </article>
  );
}
