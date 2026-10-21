"use client";

import type { CopyOverview, CopyView, KolRef } from "@/lib/api/copyTrade";
import { cn } from "@/lib/cn";
import { copyStatus, type StatusTone } from "@/lib/copyTrade/config";
import { daysAgo, pnlTone, signedSol } from "@/lib/copyTrade/format";
import { tierFor } from "@/lib/walletReader/types";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { PlusLargeIcon, WarningIcon } from "@/components/copyTrade/icons";
import { Dot, KolAvatar } from "@/components/copyTrade/parts";

/** Passo a passo do primeiro acesso ("como funciona - copy", node 1578:26190). */
const STEPS = [
  { title: "Pick a wallet", detail: "See everything it did before you decide." },
  { title: "Set an amount per buy", detail: "The preview shows what it would have made." },
  { title: "Done", detail: "Its buys go out from your W1, 24 h a day." },
];

interface Props {
  overview: CopyOverview | undefined;
  loading: boolean;
  selectedKolId: string | null;
  onCreate: () => void;
  onOpen: (kol: KolRef) => void;
}

/**
 * Coluna da esquerda (Figma 1578:26213 primeiro acesso / 1577:23722 com
 * copies): "Create copy" fixo no topo e, com copies, o resumo, o alerta de
 * copy parado por saldo e as listas Ativos / Histórico. Clicar num copy abre
 * a carteira na 3ª coluna (mesma interação do feed).
 */
export function MyCopiesColumn({ overview, loading, selectedKolId, onCreate, onOpen }: Props) {
  const has = !!overview && overview.active.length + overview.history.length > 0;
  const stopped = overview?.active.filter((c) => c.status === "STOPPED" && c.stopReason === "LOW_BALANCE") ?? [];

  return (
    <div className="flex flex-col gap-3 px-3 py-4">
      <section
        aria-labelledby="create-copy-title"
        className="flex flex-col gap-4 rounded-xl border border-principal-11 bg-[linear-gradient(118.25deg,var(--color-principal-3)_5.57%,var(--color-gray-2)_97.83%)] p-4"
      >
        <div className="flex flex-col gap-3">
          <h2 id="create-copy-title" className="text-lg leading-[1.1] font-semibold text-gray-12">
            Create copy
          </h2>
          <p className="text-sm leading-[1.3] text-gray-11">Paste an address or pick a KOL on the side</p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-principal-9 px-8 text-base leading-[1.1] font-semibold text-gray-1 transition-colors hover:bg-principal-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9"
        >
          <PlusLargeIcon className="size-5" />
          Create copy
        </button>
      </section>

      {loading ? (
        <SkeletonGroup label="Loading your copies" className="flex flex-col gap-3">
          <Skeleton className="h-[81px] rounded-lg" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[58px] rounded-xl" />
          ))}
        </SkeletonGroup>
      ) : has ? (
        <>
          <Summary overview={overview!} />
          {stopped.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border border-vermelho-6 bg-vermelho-3 px-3 py-2">
              <WarningIcon className="size-4 shrink-0 text-vermelho-11" />
              <p className="min-w-0 flex-1 truncate text-xs leading-[1.3] text-vermelho-11">
                {c.kol.label} stopped: low balance
              </p>
              <button
                type="button"
                onClick={() => onOpen(c.kol)}
                className="shrink-0 rounded border border-vermelho-7 bg-vermelho-3 px-2 py-1 text-xs leading-[1.3] font-medium text-vermelho-11 hover:bg-vermelho-4"
              >
                Resolve
              </button>
            </div>
          ))}
          <Group title="Active" hint="your result" items={overview!.active} selectedKolId={selectedKolId} onOpen={onOpen} />
          {overview!.history.length > 0 && (
            <Group title="History" hint="ended" items={overview!.history} selectedKolId={selectedKolId} onOpen={onOpen} />
          )}
        </>
      ) : (
        <section aria-labelledby="how-copy-works" className="flex flex-col gap-4 px-3 py-4">
          <h2 id="how-copy-works" className="text-base leading-[1.1] font-semibold text-gray-12">
            How it works
          </h2>
          <ol className="flex flex-col gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-principal-6 bg-principal-3 text-xs leading-[1.3] font-semibold text-principal-11">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-3 leading-[1.3]">
                  <p className="text-sm font-semibold text-gray-12">{s.title}</p>
                  <p className="text-xs text-gray-11">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/** "resumo - meus copies" (node 1572:22213): total, %, hoje e sparkline. */
function Summary({ overview }: { overview: CopyOverview }) {
  const s = overview.summary;
  return (
    <section aria-label="Your copies" className="flex items-end gap-3 rounded-lg border border-gray-4 bg-gray-2 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-xs leading-[1.3] text-gray-11">
          Your copies{overview.mode === "shadow" && <span className="text-principal-11"> · simulated</span>}
        </p>
        <p className={cn("text-xl leading-[1.1] font-semibold tabular-nums", pnlTone(s.resultSol))}>{signedSol(s.resultSol)}</p>
        <div className="flex items-center gap-1.5 text-xs leading-[1.3]">
          {s.resultPct != null && (
            <>
              <span className={cn("font-semibold", pnlTone(s.resultPct))}>
                {s.resultPct > 0 ? "+" : s.resultPct < 0 ? "−" : ""}
                {Math.abs(Math.round(s.resultPct))}%
              </span>
              <Dot />
            </>
          )}
          <span className="text-gray-11">today {signedSol(s.todaySol)}</span>
        </div>
      </div>
      <Sparkline values={s.spark} />
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 40;
  if (values.length < 2) return <span className="h-10 w-24 shrink-0" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)} ${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join("");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-24 shrink-0" aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--color-green-11)" : "var(--color-vermelho-11)"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DOT: Record<StatusTone, string> = {
  green: "bg-green-9 shadow-[0_0_0_3px_rgba(113,208,131,0.2)]",
  red: "bg-vermelho-9 shadow-[0_0_0_3px_rgba(229,72,77,0.2)]",
  orange: "bg-laranja-9 shadow-[0_0_0_3px_rgba(247,107,21,0.2)]",
  gray: "bg-gray-8",
};

function Group({
  title,
  hint,
  items,
  selectedKolId,
  onOpen,
}: {
  title: string;
  hint: string;
  items: CopyView[];
  selectedKolId: string | null;
  onOpen: (kol: KolRef) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm leading-[1.1] font-semibold text-gray-12">
          {title}
          <span className="flex min-w-5 items-center justify-center rounded-full border border-gray-6 bg-gray-3 px-1 py-0.5 text-xs leading-[1.3] font-medium text-gray-11">
            {items.length}
          </span>
        </h3>
        <span className="text-xs leading-[1.3] text-gray-9">{hint}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((c) => (
          <li key={c.id}>
            <CopyItem copy={c} selected={c.kol.id === selectedKolId} onOpen={() => onOpen(c.kol)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "item - meu copy" (node 1572:22193). */
function CopyItem({ copy: c, selected, onOpen }: { copy: CopyView; selected: boolean; onOpen: () => void }) {
  const tier = tierFor(c.kol.relevance);
  const st = copyStatus(c);
  const ended = c.status === "ENDED";
  const days = daysAgo(ended ? (c.endedAt ?? c.statusAt) : c.createdAt);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border bg-gray-2 px-3 py-2 text-left transition-colors",
        selected ? "border-principal-7" : "border-gray-6 hover:border-gray-8",
      )}
    >
      <KolAvatar kol={c.kol} tier={tier} ring="border" className="size-10" />
      <span className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm leading-[1.3] font-semibold text-gray-12">{c.kol.label}</span>
          {!ended && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[st.tone])} />}
        </span>
        <span className={cn("truncate text-xs leading-[1.3]", st.tone === "red" ? "text-vermelho-11" : "text-gray-11")}>
          {ended ? `Ended ${days} ${days === 1 ? "day" : "days"} ago` : st.label}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-3 text-right leading-[1.3] whitespace-nowrap">
        <span className={cn("text-sm font-semibold tabular-nums", pnlTone(c.resultSol))}>
          {c.resultSol == null ? "—" : signedSol(c.resultSol)}
        </span>
        <span className="text-xs text-gray-11">{ended ? "final" : `${days} ${days === 1 ? "day" : "days"} ago`}</span>
      </span>
    </button>
  );
}
