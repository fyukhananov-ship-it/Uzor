import Link from "next/link";

// Тарифная сетка v1 (PRD §11.1). «Семья» — v1.5, помечен как скоро.

const TIERS = [
  {
    name: "Соло",
    audience: "Для одного",
    monthly: "249 ₽ / мес",
    yearly: "1 990 ₽ / год — два месяца в подарок",
    features: [
      "Якоря дня и утренние вопросы",
      "Журнал и тэги моментов",
      "Узор недели — раз в неделю",
    ],
    primary: false,
  },
  {
    name: "Дуо",
    audience: "Для пары",
    monthly: "549 ₽ / мес",
    yearly: "4 490 ₽ / год — два месяца в подарок",
    features: [
      "Всё из тарифа Соло — для обоих",
      "Связанный режим: общий взгляд при согласии обоих",
      "Узор недели на двоих с сохранённым архивом",
    ],
    primary: true,
  },
  {
    name: "Семья",
    audience: "С детьми",
    monthly: "890 ₽ / мес",
    yearly: "6 990 ₽ / год",
    features: [
      "Доступен в v1.5",
      "Профили детей и расширенные роли",
      "Узор семьи поверх индивидуальных",
    ],
    primary: false,
    soon: true,
  },
];

export default function PricingPage() {
  return (
    <div className="container-prose py-16 sm:py-24">
      <h1 className="font-serif text-subdisplay">Тарифы</h1>
      <p className="mt-3 text-body text-ink-muted">
        Первые 7 дней — полный доступ без обязательной карты. Дальше —
        подписка. Архив остаётся у тебя в любом случае.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {TIERS.map((t) => (
          <article
            key={t.name}
            className={
              "rounded-md border p-6 flex flex-col gap-4 " +
              (t.primary
                ? "border-ink bg-canvas/60"
                : "border-line/80 bg-canvas/30")
            }
          >
            <header>
              <p className="text-sm text-ink-faint">{t.audience}</p>
              <h2 className="font-serif text-lg mt-1">{t.name}</h2>
            </header>
            <div>
              <p className="font-serif text-lead">{t.monthly}</p>
              <p className="text-sm text-ink-muted mt-1">{t.yearly}</p>
            </div>
            <ul className="text-body text-ink-muted space-y-2">
              {t.features.map((f) => (
                <li key={f}>— {f}</li>
              ))}
            </ul>
            {t.soon ? (
              <span className="text-sm text-ink-faint mt-auto">
                Скоро, в v1.5
              </span>
            ) : (
              <Link
                href="/start"
                className={t.primary ? "btn-primary mt-auto" : "btn-secondary mt-auto"}
              >
                Попробовать 7 дней
              </Link>
            )}
          </article>
        ))}
      </div>

      <hr className="border-line/60 my-16" />

      <section className="grid gap-6 sm:grid-cols-2">
        <Faq
          q="Что произойдёт через 7 дней?"
          a="Появится мягкая стена оплаты. Если не оформишь подписку — архив останется доступен в режиме чтения. Никаких удалений."
        />
        <Faq
          q="Можно ли отменить в один тап?"
          a="Да. В настройках — без диалогов удержания, без капканов."
        />
        <Faq
          q="Откуда списания?"
          a="Из стора (RuStore) или через ЮKassa и СБП — зависит от того, как ты установил приложение."
        />
        <Faq
          q="Что с возвратами?"
          a="По правилам стора, через который оплачено. Архив никогда не блокируется."
        />
      </section>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <article>
      <h3 className="font-serif text-base">{q}</h3>
      <p className="mt-2 text-body text-ink-muted">{a}</p>
    </article>
  );
}
