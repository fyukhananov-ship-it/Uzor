import type { PairContext, FrictionZone } from "@/types";

// «Как это получено» (PRD Приложение Б, §11 принцип 6).
// Скептической аудитории важно увидеть механику расчёта — без этого
// тон текста читается как «опять гадание». Раскрывается по клику,
// не отъедает место в основном спреде.

const FRICTION_LABELS: Record<FrictionZone, string> = {
  timing_mismatch: "разная скорость",
  phase_mismatch: "несовпадение фаз — завершения и начинания",
  energy_mismatch: "разная социальная нагрузка",
  depth_mismatch: "разный масштаб внимания — детали против общей картины",
  rhythm_match: "совпадающий ритм",
  complementary_pair: "взаимодополняющая комбинация",
};

export function TransparencyStrip({ context }: { context: PairContext }) {
  return (
    <details className="motion-settle delay-320 mt-10 group">
      <summary className="kicker text-ink-faint cursor-pointer select-none list-none flex items-center gap-3 hover:text-ink-muted transition-colors">
        <span aria-hidden className="ornament-line opacity-40" />
        <span>На чём это построено</span>
        <span aria-hidden className="ml-auto text-ink-faint group-open:rotate-90 transition-transform inline-block">
          ›
        </span>
      </summary>
      <div className="mt-6 pl-2 sm:pl-4 border-l border-line/60 text-sm text-ink-muted space-y-3 leading-relaxed">
        <p>
          Сегодня <span className="tabular-nums text-ink">{context.date}</span>.
          У&nbsp;тебя personal&nbsp;day{" "}
          <span className="tabular-nums font-medium text-ink">
            {context.user.personalDay}
          </span>
          , у&nbsp;партнёра&nbsp;—{" "}
          <span className="tabular-nums font-medium text-ink">
            {context.partner.personalDay}
          </span>
          . Pair&nbsp;cycle:{" "}
          <span className="tabular-nums font-medium text-ink">
            {context.pairCycle}
          </span>
          .
        </p>
        <p>
          По нумерологическим правилам это сочетание чаще всего проявляется
          как <em className="text-ink not-italic font-serif italic">{FRICTION_LABELS[context.friction]}</em>.
        </p>
        <p className="text-ink-faint">
          Это рамка для разговора, не диагноз. Числа — детерминированный
          расчёт, наблюдения — литературная интерпретация на этом числовом
          контексте.
        </p>
      </div>
    </details>
  );
}
