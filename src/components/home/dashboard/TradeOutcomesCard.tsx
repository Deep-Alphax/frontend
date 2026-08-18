import type { OutcomeBucket, OutcomeKey } from "@/lib/api/analytics";
import { cn } from "@/lib/cn";

/** Rótulo + cor da barra por desfecho (espelha o Figma: vermelho/menta/violeta/azul/verde). */
const OUTCOME_META: Record<OutcomeKey, { label: string; bar: string }> = {
  rugpull: { label: "Rugpull", bar: "bg-danger-10" },
  stop_loss: { label: "Stop loss", bar: "bg-mint-10" },
  x1_2: { label: "1x a 2x", bar: "bg-purple-10" },
  x2_5: { label: "2x a 5x", bar: "bg-blue-10" },
  x5_plus: { label: "Acima de 5x", bar: "bg-green-10" },
};

const ORDER: OutcomeKey[] = ["rugpull", "stop_loss", "x1_2", "x2_5", "x5_plus"];

interface TradeOutcomesCardProps {
  outcomes: OutcomeBucket[];
}

/**
 * "Como seus trades terminaram" (Figma 51:2272) — lista de ponta a ponta com
 * divisórias: por desfecho, rótulo + % das posições, barra de progresso e a
 * contagem. Largura da barra ∝ contagem do bucket (dados reais). Contagem POR
 * TOKEN (um token conta 1×, como na Axiom) — o total é a soma dos buckets.
 */
export function TradeOutcomesCard({ outcomes }: TradeOutcomesCardProps) {
  const byKey = new Map(outcomes.map((o) => [o.bucket, o]));
  const maxCount = Math.max(1, ...outcomes.map((o) => o.count));
  const totalClosed = outcomes.reduce((n, o) => n + o.count, 0);

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2">
      <div className="flex items-center justify-between border-b border-gray-6 p-4">
        <h3 className="text-lg font-semibold text-gray-12">Como seus trades terminaram</h3>
        <span className="text-base text-gray-11">{totalClosed} operações</span>
      </div>

      <ul>
        {ORDER.map((key) => {
          const bucket = byKey.get(key);
          const count = bucket?.count ?? 0;
          const pct = bucket?.pctOfClosed ?? 0;
          const meta = OUTCOME_META[key];
          return (
            <li
              key={key}
              className="flex items-center gap-8 border-b border-gray-6 px-4 py-3 last:border-b-0"
            >
              <div className="flex w-28 shrink-0 flex-col gap-2">
                <p className="text-sm font-semibold text-gray-12">{meta.label}</p>
                <p className="text-sm text-gray-11">
                  {pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% dos trades
                </p>
              </div>

              <div className="h-4 flex-1 overflow-hidden rounded-full bg-gray-5">
                <div
                  className={cn("h-full rounded-full", meta.bar)}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>

              <span className="shrink-0 text-sm font-semibold text-gray-12">{count}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
