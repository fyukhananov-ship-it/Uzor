import type { Observation } from "@/types";

// Редакторский ритм по PRD §12: kicker → display-serif → разделительный рул.
// Каждый kind получает свой акцент-цвет — все три уже определены в палитре,
// но до этого нигде не использовались. Цвет ведёт глаз через спред,
// не превращая страницу в светофор.

const KIND_LABELS: Record<Observation["kind"], string> = {
  dynamic: "Динамика",
  friction: "Зона трения",
  strength: "Сила",
};

const KIND_NUMERAL: Record<Observation["kind"], string> = {
  dynamic: "I",
  friction: "II",
  strength: "III",
};

const KIND_ACCENT: Record<Observation["kind"], string> = {
  dynamic: "text-rose",
  friction: "text-sage",
  strength: "text-sky",
};

type Props = {
  observation: Observation;
  /** Стаггер появления, индекс позиции от 0 — для motion-settle delay. */
  index?: number;
  /** Скрыть нижний разделитель (для последнего блока в списке). */
  isLast?: boolean;
};

export function ObservationCard({ observation, index = 0, isLast = false }: Props) {
  const delayClass = ["delay-0", "delay-80", "delay-160", "delay-240"][index] ?? "delay-160";
  return (
    <article className={`motion-settle ${delayClass} py-6`}>
      <header className="flex items-baseline gap-4 mb-5">
        <span className={`kicker ${KIND_ACCENT[observation.kind]}`}>
          {KIND_LABELS[observation.kind]}
        </span>
        <span aria-hidden className="ornament-line opacity-30 text-ink-faint" />
        <span className="kicker text-ink-faint tabular-nums">
          {KIND_NUMERAL[observation.kind]}
        </span>
      </header>
      <p className="font-serif text-observation text-balance">
        {observation.text}
      </p>
      {!isLast ? <hr className="mt-8 border-line/50" /> : null}
    </article>
  );
}
