import Link from "next/link";

// Hero — редакторский разворот в духе референсов PRD §12 (Reminder /
// The Blueprint / Day One). Display-serif с одним italic-акцентом,
// kicker с ornament-линией, узкая текстовая колонка. Без бомбастики.

export default function Home() {
  return (
    <>
      <section className="container-prose pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="motion-settle delay-0 mb-8 flex items-center gap-3 text-rose">
          <span aria-hidden className="ornament-line" />
          <span className="kicker">Для пар 28–38 — не предсказание</span>
        </div>

        <h1 className="motion-settle delay-80 font-serif text-display-large text-balance">
          Почему у вас <em>снова</em> тот же разговор.
        </h1>

        <p className="motion-settle delay-160 mt-10 text-deck text-ink-muted max-w-prose">
          Узор — это язык, на котором можно описать, что повторяется в&nbsp;паре.
          Нумерология здесь не предсказание, а структурированный способ
          наблюдать за&nbsp;собой и за&nbsp;тем, что происходит между двумя
          людьми.
        </p>

        <div className="motion-settle delay-240 mt-12 flex flex-col sm:flex-row gap-3">
          <Link href="/start" className="btn-primary">
            Попробовать — 90 секунд
          </Link>
          <Link href="/about" className="btn-secondary">
            Что это вообще такое
          </Link>
        </div>
      </section>

      <section className="container-prose">
        <hr className="border-line/60" />
      </section>

      <section className="container-prose py-16">
        <p className="kicker text-ink-faint mb-8">Три принципа</p>
        <div className="grid gap-12 sm:grid-cols-3">
          <Principle
            numeral="01"
            title="Не предсказание"
            body="Никаких «звёзд», «судьбы» и «энергий». Узор пишет на языке, который выдерживает скептический взгляд."
          />
          <Principle
            numeral="02"
            title="Не для одного"
            body="Архитектура продукта — про двоих. Можно начать одному; партнёр подключается, когда сам захочет."
          />
          <Principle
            numeral="03"
            title="Архив, не лента"
            body="Раз в неделю — Узор недели. Паттерн, который сложно заметить в моменте, но видно, если смотреть подряд."
          />
        </div>
      </section>

      <section className="container-prose">
        <hr className="border-line/60" />
      </section>

      <section className="container-prose py-16">
        <div className="grid gap-10 sm:grid-cols-5 items-start">
          <div className="sm:col-span-2">
            <p className="kicker text-sage mb-4">Как устроено</p>
            <h2 className="font-serif text-subdisplay">Две даты, три наблюдения</h2>
          </div>
          <div className="sm:col-span-3 space-y-5 text-body text-ink-muted">
            <p>
              На лендинге достаточно двух дат рождения — твоей и&nbsp;партнёра.
              На основе этих дат мы соберём короткий разбор: про вашу динамику,
              про&nbsp;типичную зону трения и про сильную сторону.
            </p>
            <p>
              Это не диагноз и не совет. Это попытка дать паре язык, на&nbsp;котором
              повторяющиеся сюжеты становится проще обсуждать без обвинений.
            </p>
          </div>
        </div>
      </section>

      <section className="container-prose pb-20">
        <figure className="border-l-2 border-rose pl-6 py-2">
          <blockquote className="font-serif text-deck text-balance">
            «Ты любишь начинать; партнёр — доделывать. Часто кажется, что
            вы&nbsp;на&nbsp;одном поле, но на самом деле на&nbsp;разных
            его&nbsp;концах.»
          </blockquote>
          <figcaption className="kicker text-ink-faint mt-4">
            Пример наблюдения · Узор
          </figcaption>
        </figure>
      </section>
    </>
  );
}

function Principle({
  numeral,
  title,
  body,
}: {
  numeral: string;
  title: string;
  body: string;
}) {
  return (
    <article>
      <span className="kicker text-ink-faint tabular-nums">{numeral}</span>
      <h3 className="font-serif text-lg mt-3 mb-3">{title}</h3>
      <p className="text-body text-ink-muted">{body}</p>
    </article>
  );
}
