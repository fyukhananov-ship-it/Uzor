import type { Observation } from "@/types";

const KIND_LABELS: Record<Observation["kind"], string> = {
  dynamic: "Про вашу динамику",
  friction: "Про типичную зону трения",
  strength: "Про сильную сторону",
};

export function ObservationCard({ observation }: { observation: Observation }) {
  return (
    <article className="rounded-md border border-line/80 p-6 bg-canvas/40">
      <p className="text-sm text-ink-faint mb-3">
        {KIND_LABELS[observation.kind]}
      </p>
      <p className="font-serif text-lead text-balance">{observation.text}</p>
    </article>
  );
}
