"use client";

import { useMemo, useState } from "react";

import type { CopyKolDetail, CopyTokenRow } from "@/lib/api/copyTrade";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { holdLabel, multipleLabel, pnlTone, signedSol, sol } from "@/lib/copyTrade/format";
import { useCopiers } from "@/lib/copyTrade/useCopies";
import { compactUsd, initials, tokenLabel } from "@/lib/tracker/format";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { KpiCell, Pagination } from "@/components/copyTrade/controls";
import { Dot, TagButton } from "@/components/copyTrade/parts";

const PAGE = 10;

/** % com sinal tipográfico: "+38%" / "−6%". */
function pct(v: number | null | undefined): string {
  if (v == null) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}%`;
}

function Summary3({ cells }: { cells: Array<{ label: string; value: string; tone?: string }> }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-gray-6">
      {cells.map((c, i) => (
        <KpiCell
          key={c.label}
          display
          label={c.label}
          value={c.value}
          tone={c.tone}
          className={cn(i < cells.length - 1 && "border-r border-gray-6")}
        />
      ))}
    </div>
  );
}

// ───────────────────────────── Tokens ─────────────────────────────

type TokenFilter = "all" | "open" | "closed";

/**
 * Aba "Tokens" (Figma 1615:61147): tokens do KOL em 30 dias — resumo
 * (quantos, com lucro, melhor múltiplo), filtros Todos/Abertos/Fechados e a
 * lista com entrada (MC), tempo segurando e resultado. Paginação no cliente
 * (o detalhe já traz os 50 mais recentes).
 */
export function TokensTab({ detail, loading }: { detail: CopyKolDetail | undefined; loading: boolean }) {
  const [filter, setFilter] = useState<TokenFilter>("all");
  const [page, setPage] = useState(1);
  const all = useMemo(() => detail?.tokens ?? [], [detail]);
  const rows = useMemo(
    () => all.filter((t) => (filter === "all" ? true : filter === "open" ? t.open : !t.open)),
    [all, filter],
  );

  if (loading) {
    return (
      <SkeletonGroup label="Loading tokens" className="flex flex-col gap-4 px-4">
        <Skeleton className="h-[59px] rounded-lg" />
        <Skeleton className="h-6 w-56" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </SkeletonGroup>
    );
  }
  const s = detail?.tokenSummary;
  if (!s || !s.total) return <p className="px-4 text-sm text-gray-11">No SOL trades in the last 30 days.</p>;
  const open = all.filter((t) => t.open).length;

  return (
    <div className="flex flex-col gap-4 px-4">
      <Summary3
        cells={[
          { label: "Tokens 30d", value: String(s.total) },
          { label: "With profit", value: `${s.profitable} of ${s.total}`, tone: s.profitable ? "text-green-11" : "text-gray-12" },
          { label: "Best", value: s.bestMultiple != null ? multipleLabel(s.bestMultiple) : "—", tone: "text-green-11" },
        ]}
      />
      <div role="group" aria-label="Filter tokens" className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All", all.length],
            ["open", "Open", open],
            ["closed", "Closed", all.length - open],
          ] as const
        ).map(([id, label, n]) => (
          <TagButton
            key={id}
            selected={filter === id}
            onClick={() => {
              setFilter(id);
              setPage(1);
            }}
          >
            {label} <span className="ml-1 opacity-70">{n}</span>
          </TagButton>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-5 bg-gray-2">
        <div className="flex justify-between border-b border-gray-5 px-3 py-3 text-xs leading-[1.3] text-gray-11">
          <span>Token</span>
          <span>Result</span>
        </div>
        <ul>
          {rows.slice((page - 1) * PAGE, page * PAGE).map((t, i) => (
            <li key={t.mint}>
              <TokenRow token={t} zebra={i % 2 === 1} />
            </li>
          ))}
        </ul>
        {rows.length > PAGE && <Pagination page={page} pageSize={PAGE} total={rows.length} noun="tokens" onPage={setPage} />}
      </div>
    </div>
  );
}

function TokenRow({ token: t, zebra }: { token: CopyTokenRow; zebra: boolean }) {
  const label = tokenLabel(t);
  const m = t.multiple;
  const tone = t.open ? "text-principal-11" : m == null ? "text-gray-12" : m >= 1 ? "text-green-11" : "text-vermelho-11";
  return (
    <div className={cn("flex items-center gap-3 p-3", zebra && "bg-gray-3")}>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-6 bg-gray-3 text-xs leading-[1.3] font-semibold text-gray-12"
      >
        {initials(label.replace(/^\$/, ""))}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm leading-[1.3] font-semibold text-gray-12">{label}</p>
          <span
            className={cn(
              "shrink-0 rounded-[32px] border px-3 py-1 text-xs leading-[1.3] font-medium",
              t.open ? "border-principal-6 bg-principal-3 text-principal-11" : "border-gray-6 bg-gray-3 text-gray-11",
            )}
          >
            {t.open ? "Open" : "Closed"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs leading-[1.3] whitespace-nowrap text-gray-11">
          <span>Entered at {t.entryMcUsd != null ? compactUsd(t.entryMcUsd) : "—"}</span>
          <Dot />
          <span>
            {t.open ? "Holding for" : "Held"} {holdLabel(t.holdMs)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 text-right whitespace-nowrap">
        <span className={cn("text-sm leading-[1.1] font-semibold tabular-nums", tone)}>{m != null ? multipleLabel(m) : "—"}</span>
        <span className="text-xs leading-[1.3] text-gray-11">{signedSol(t.pnlSol)}</span>
      </div>
    </div>
  );
}

// ───────────────────────────── Quem copia ─────────────────────────────

/**
 * Aba "Quem copia" (Figma 1615:61947), ANÔNIMA (decisão 2026-10-20): resumo,
 * barra lucro × prejuízo, dica do Deep Score e ranking de quem mais ganhou —
 * a sua linha fica fixa no topo; os outros só com iniciais pseudônimas e %.
 */
export function CopiersTab({ kolId, kolLabel, enabled }: { kolId: string; kolLabel: string; enabled: boolean }) {
  const [page, setPage] = useState(1);
  const q = useCopiers(kolId, page, enabled);
  const b = q.data;

  if (q.isError && !b) return <p className="px-4 text-sm text-vermelho-11">{getApiErrorMessage(q.error)}</p>;
  if (!b) {
    return (
      <SkeletonGroup label="Loading copiers" className="flex flex-col gap-4 px-4">
        <Skeleton className="h-[59px] rounded-lg" />
        <Skeleton className="h-6 w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[52px] rounded-lg" />
        ))}
      </SkeletonGroup>
    );
  }
  if (!b.count) return <p className="px-4 text-sm text-gray-11">Nobody copies {kolLabel} yet.</p>;

  const profitPct = b.count ? Math.round((b.profitable / b.count) * 100) : 0;
  const bar = b.profitable + b.losing;
  return (
    <div className="flex flex-col gap-4 px-4">
      <Summary3
        cells={[
          { label: "Copying now", value: b.count.toLocaleString("en-US") },
          { label: "Avg. result", value: pct(b.avgResultPct), tone: pnlTone(b.avgResultPct) },
          { label: "With profit", value: `${profitPct}%`, tone: profitPct >= 50 ? "text-green-11" : "text-vermelho-11" },
        ]}
      />
      {bar > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex h-2 gap-0.5" aria-hidden>
            <span className="h-2 rounded-full bg-green-9" style={{ width: `${(b.profitable / bar) * 100}%` }} />
            <span className="h-2 flex-1 rounded-full bg-vermelho-9" />
          </div>
          <div className="flex justify-between text-xs leading-[1.3] font-semibold">
            <span className="text-green-11">{b.profitable} in profit</span>
            <span className="text-vermelho-11">{b.losing} at a loss</span>
          </div>
        </div>
      )}
      {b.tip && b.tip.deltaPct > 0 && (
        <p className="rounded-lg border border-[#5a4a0a] bg-[#30280b] p-3 text-xs leading-[1.3] text-principal-11">
          Copiers using Deep Score {b.tip.minDeepScore}+ on {kolLabel} did {b.tip.deltaPct}% better.
        </p>
      )}
      <div className="flex items-center justify-between">
        <h4 className="text-sm leading-[1.1] font-semibold text-gray-12">Who made the most copying</h4>
        <span className="text-xs leading-[1.3] text-gray-11">30 days</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-5 bg-gray-2">
        <div className="flex justify-between border-b border-gray-5 px-3 py-3 text-xs leading-[1.3] text-gray-11">
          <span>Copier</span>
          <span>Result</span>
        </div>
        <ol className={cn(q.isPlaceholderData && "opacity-60")}>
          {b.me && (
            <li className="flex items-center gap-3 bg-[linear-gradient(90deg,var(--color-principal-3),var(--color-principal-1))] px-3 py-2">
              <span className="w-4 shrink-0 text-center text-xs leading-[1.3] font-semibold text-gray-11">{b.me.rank}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-principal-9 text-xs leading-[1.3] font-semibold text-gray-1">
                YO
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-sm leading-[1.3] font-semibold text-principal-11">You</span>
                <span className="flex items-center gap-2 text-xs leading-[1.3] text-gray-11">
                  <span>{days(b.me.sinceDays)}</span>
                  <Dot />
                  <span>
                    {sol(b.me.amountSol)} {b.me.buyMode === "fixed" ? "per buy" : "cap per buy"}
                  </span>
                </span>
              </span>
              <span className={cn("flex shrink-0 flex-col items-end gap-2 text-right leading-[1.3] whitespace-nowrap", pnlTone(b.me.resultSol))}>
                <span className="text-sm font-semibold">{b.me.resultSol == null ? "—" : signedSol(b.me.resultSol)}</span>
                <span className="text-xs">{pct(b.me.resultPct)}</span>
              </span>
            </li>
          )}
          {b.rows
            .filter((r) => !r.mine)
            .map((r, i) => (
              <li key={r.rank} className={cn("flex items-center gap-3 px-3 py-2", i % 2 === 0 && "bg-gray-3")}>
                <span className="w-4 shrink-0 text-center text-xs leading-[1.3] font-semibold text-gray-11">{r.rank}</span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-gray-6 bg-gray-4 text-xs leading-[1.3] font-semibold text-gray-12">
                  {r.alias}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-sm leading-[1.3] font-semibold text-gray-12">Copier</span>
                  <span className="text-xs leading-[1.3] text-gray-11">{days(r.sinceDays)}</span>
                </span>
                <span className={cn("shrink-0 text-sm leading-[1.3] font-semibold tabular-nums", pnlTone(r.resultPct))}>
                  {pct(r.resultPct)}
                </span>
              </li>
            ))}
        </ol>
        {b.count > PAGE && <Pagination page={page} pageSize={PAGE} total={b.count} noun="copiers" onPage={setPage} />}
      </div>
    </div>
  );
}

const days = (n: number) => (n === 0 ? "Today" : `${n} ${n === 1 ? "day" : "days"} ago`);
