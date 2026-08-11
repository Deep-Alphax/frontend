import type { RecommendationKey } from "@/lib/analytics/sources";
import { cn } from "@/lib/cn";

type Tone = "green" | "amber" | "red" | "blue" | "neutral";

interface RecMeta {
  label: string;
  tone: Tone;
}

/** Rótulo + cor de cada recomendação (ordem = a dos chips de filtro do design). */
export const RECOMMENDATIONS: { key: RecommendationKey; meta: RecMeta }[] = [
  { key: "usar_mais", meta: { label: "Usar mais", tone: "green" } },
  { key: "manter", meta: { label: "Manter", tone: "green" } },
  { key: "reduzir_size", meta: { label: "Reduzir size", tone: "amber" } },
  { key: "revisar_entrada", meta: { label: "Revisar entrada", tone: "amber" } },
  { key: "observar", meta: { label: "Observar", tone: "neutral" } },
  { key: "cortar", meta: { label: "Cortar", tone: "red" } },
  { key: "aposta_curta", meta: { label: "Aposta curta", tone: "blue" } },
];

export const RECOMMENDATION_META: Record<RecommendationKey, RecMeta> = Object.fromEntries(
  RECOMMENDATIONS.map((r) => [r.key, r.meta]),
) as Record<RecommendationKey, RecMeta>;

const TONE_CLASS: Record<Tone, string> = {
  green: "border-green-10/50 text-green-11",
  amber: "border-amber-10/50 text-amber-11",
  red: "border-danger-10/50 text-danger-11",
  blue: "border-blue-10/50 text-blue-10",
  neutral: "border-gray-6 text-gray-11",
};

export function RecommendationBadge({ value }: { value: RecommendationKey }) {
  const meta = RECOMMENDATION_META[value];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border bg-gray-2 px-2.5 py-1 text-sm font-medium",
        TONE_CLASS[meta.tone],
      )}
    >
      {meta.label}
    </span>
  );
}
