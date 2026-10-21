"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import type { CopyEventRef, CopyKol, CopyKolDetail, CopyView, ExecMode } from "@/lib/api/copyTrade";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  decisionLabel,
  describeBuy,
  describeSell,
  statusSince,
  type DecisionTone,
} from "@/lib/copyTrade/config";
import {
  callPlace,
  chartGeometry,
  hitLabel,
  holdLabel,
  kolHandle,
  kolRole,
  multipleLabel,
  pnlTone,
  signedSol,
  sol,
  timelineEvents,
  tradesLabel,
  windowFraction,
  type TimelineEvent,
} from "@/lib/copyTrade/format";
import { useCopyMutations, useKolCopy } from "@/lib/copyTrade/useCopies";
import { useCopyKol } from "@/lib/copyTrade/useCopyTrade";
import { age, compactUsd, quoteAmount } from "@/lib/tracker/format";
import { useTrackerFeed } from "@/lib/tracker/useTracker";
import { tierFor } from "@/lib/walletReader/types";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import {
  ChatIcon,
  CopyOutlineIcon,
  MinusIcon,
  PauseIcon,
  PlusIcon,
  RemoveIcon,
} from "@/components/copyTrade/icons";
import { CopiersTab, TokensTab } from "@/components/copyTrade/DetailTabs";
import { Dot, KolAvatar, RankTag, tierVars } from "@/components/copyTrade/parts";
import type { DrawerTarget } from "@/components/copyTrade/CopyConfigDrawer";

type Tab = "actions" | "tokens" | "copiers";

interface Props {
  /** O KOL clicado — já pinta o topo enquanto o detalhe carrega. */
  kol: CopyKol;
  enabled: boolean;
  /** Saldo da W1 (linha "Parado: a W1 tem X SOL…"). */
  balanceSol: number | null;
  onClose: () => void;
  onConfigure: (t: DrawerTarget) => void;
  onDeposit: () => void;
}

const CHIP: Record<DecisionTone, string> = {
  green: "border-green-6 bg-green-3 text-green-11",
  red: "border-vermelho-6 bg-vermelho-3 text-vermelho-11",
  gray: "border-gray-6 bg-gray-3 text-gray-11",
  yellow: "border-principal-6 bg-principal-3 text-principal-11",
};

/**
 * 3ª coluna do Copy Trade ("painel - detalhe carteira", node 1575:22870 e
 * estados Copy ativo / parado / pausado / encerrado): perfil, "Seu copy" (se
 * houver), KPIs de 30d, resultado acumulado com o marcador "Você copia",
 * abas Últimas ações / Tokens / Quem copia e o rodapé conforme o estado.
 */
export function KolDetailPanel({ kol, enabled, balanceSol, onClose, onConfigure, onDeposit }: Props) {
  const detail = useCopyKol(kol.id, enabled);
  const mine = useKolCopy(kol.id, enabled);
  const shown = detail.data?.kol ?? kol;
  const tier = tierFor(shown.relevance);
  const role = kolRole(shown.types);
  const s = shown.stats;
  const copy = mine.data?.copy ?? null;
  const mode: ExecMode = mine.data?.mode ?? "off";
  const [tab, setTab] = useState<Tab>("actions");

  const feed = useTrackerFeed({ kols: [kol.id] }, enabled);
  const events = useMemo(() => timelineEvents(feed.data?.pages.flatMap((p) => p.items) ?? []), [feed.data]);
  const youBySource = useMemo(() => {
    const m = new Map<string, CopyEventRef>();
    for (const e of mine.data?.events ?? []) m.set(e.sourceId, e);
    return m;
  }, [mine.data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc fecha só a camada de cima: com o drawer (ou outro modal) aberto, é ele que fecha.
      if (e.key !== "Escape" || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ref ={ id: shown.id, label: kolHandle(shown), relevance: shown.relevance, avatarUrl: shown.avatarUrl };

  return (
    <aside
      aria-label={`${kolHandle(shown)} profile`}
      style={tierVars(tier)}
      className="relative flex h-full min-h-0 flex-col border-l border-gray-5 bg-gray-2 shadow-[-24px_0_60px_0_rgba(0,0,0,0.45)]"
    >
      <span aria-hidden className="pointer-events-none absolute top-0 -left-px right-0 z-20 h-0.5 bg-[linear-gradient(90deg,var(--tier-11),transparent)]" />

      <header className="relative z-20 flex items-center gap-2 border-b border-gray-6 bg-gray-2 px-4 py-2">
        <h2 className="flex-1 text-base leading-[1.1] font-semibold text-gray-12">Profile details</h2>
        <button type="button" onClick={onClose} aria-label="Close profile" className="flex items-center justify-center rounded text-gray-12 transition-colors hover:bg-gray-4">
          <RemoveIcon className="size-6" />
        </button>
      </header>

      <ScrollArea className="relative z-0 flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
        <div className="relative isolate flex flex-col gap-3.5 overflow-hidden bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tier-9)_55%,transparent)_0%,color-mix(in_srgb,var(--tier-9)_12%,transparent)_55%,transparent_100%)] px-4 pt-2 pb-4">
          <div aria-hidden className="pointer-events-none absolute -top-9 -right-2.5 -z-10 size-[220px] [mask-image:radial-gradient(closest-side,#000_20%,transparent_100%)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tier.emblem} alt="" width={220} height={220} className="size-full object-cover opacity-45" />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <KolAvatar kol={shown} tier={tier} className="size-11 drop-shadow-[0_0_12px_color-mix(in_srgb,var(--tier-11)_55%,transparent)]" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-display text-base leading-[1.1] font-semibold tracking-[1px] text-gray-12">{kolHandle(shown)}</p>
                <RankTag tier={tier} size="md" />
              </div>
              <div className="flex min-w-0 items-center gap-2 text-xs leading-[1.3] text-gray-11">
                {role && (
                  <span className="shrink-0 rounded-[32px] border border-principal-9 bg-linear-to-r from-principal-7 to-principal-3 px-1.5 py-1 font-medium text-principal-12">
                    {role}
                  </span>
                )}
                {shown.handle && shown.name !== shown.handle && (
                  <>
                    <span className="truncate">{shown.name}</span>
                    <Dot />
                  </>
                )}
                <span className="shrink-0">{tradesLabel(shown)}</span>
              </div>
            </div>
          </div>

          {copy && <YourCopy copy={copy} mode={mode} balanceSol={balanceSol} />}

          <dl className="relative z-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-5 bg-gray-5">
            <Kpi label="Hit rate 30d" value={hitLabel(s?.hitRate)} />
            <Kpi label="Result 30d" value={s ? signedSol(s.pnlSol) : "—"} tone={pnlTone(s?.pnlSol)} />
            <Kpi label="Avg. bet" value={sol(s?.avgBetSol)} />
            <Kpi label="Holds for" value={holdLabel(s?.avgHoldMs)} />
          </dl>

          <ResultChart detail={detail.data} loading={!detail.data && !detail.isError} copiedAt={copy?.createdAt ?? null} />
        </div>

        <div className="flex flex-col pt-2 pb-6">
          <div role="tablist" aria-label="Activity" className="mb-4 flex border-b border-gray-5">
            <TabButton active={tab === "actions"} onClick={() => setTab("actions")} label="Latest actions" count={events.length} />
            <TabButton active={tab === "tokens"} onClick={() => setTab("tokens")} label="Tokens" count={detail.data?.tokenSummary.total ?? s?.tokens ?? 0} />
            <TabButton active={tab === "copiers"} onClick={() => setTab("copiers")} label="Who copies" count={shown.copiers ?? 0} />
          </div>

          {tab === "actions" &&
            (feed.isError && !feed.data ? (
              <p className="px-4 text-sm text-vermelho-11">{getApiErrorMessage(feed.error)}</p>
            ) : !feed.data ? (
              <TimelineSkeleton />
            ) : events.length ? (
              <ol className="flex flex-col">
                {events.map((e, i) => (
                  <TimelineRow
                    key={e.id}
                    event={e}
                    you={e.kind === "call" ? undefined : youBySource.get(e.id)}
                    last={i === events.length - 1}
                  />
                ))}
              </ol>
            ) : (
              <p className="px-4 text-sm text-gray-11">No trades or calls tracked for this wallet yet.</p>
            ))}
          {tab === "tokens" && <TokensTab detail={detail.data} loading={!detail.data && !detail.isError} />}
          {tab === "copiers" && <CopiersTab kolId={shown.id} kolLabel={kolHandle(shown)} enabled={enabled} />}
        </div>
      </ScrollArea>

      <Footer
        copy={copy}
        label={kolHandle(shown)}
        loading={mine.isLoading}
        onCopy={() => onConfigure({ kol: ref })}
        onAdjust={(c) => onConfigure({ kol: ref, copy: c })}
        onDeposit={onDeposit}
      />
    </aside>
  );
}

// ───────────────────────────── Seu copy ─────────────────────────────

/** "seu copy - resumo" (node 1574:22251), tingido pelo status. */
function YourCopy({ copy: c, mode, balanceSol }: { copy: CopyView; mode: ExecMode; balanceSol: number | null }) {
  const tone =
    c.status === "ACTIVE"
      ? "border-green-6 bg-[linear-gradient(160deg,rgba(113,208,131,0.22)_0%,rgba(113,208,131,0.02)_71%),linear-gradient(var(--color-gray-2),var(--color-gray-2))]"
      : c.status === "STOPPED"
        ? "border-vermelho-6 bg-[linear-gradient(160deg,rgba(229,72,77,0.22)_0%,rgba(229,72,77,0.02)_71%),linear-gradient(var(--color-gray-2),var(--color-gray-2))]"
        : "border-gray-6 bg-gray-2";
  const needed = c.config.buy.amountSol;
  return (
    <section aria-label="Your copy" className={cn("relative z-10 flex flex-col gap-3 rounded-[14px] border p-4", tone)}>
      <div className="flex items-center gap-2 text-xs leading-[1.3] text-gray-11">
        <span>Your copy</span>
        <Dot />
        <span>{statusSince(c.status, c.statusAt, c.createdAt)}</span>
        {mode === "shadow" && <span className="ml-auto rounded border border-principal-6 bg-principal-3 px-1.5 py-0.5 text-principal-11">Simulated</span>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-2">
        <p className={cn("font-display text-xl leading-[1.1] font-semibold tracking-[1px] tabular-nums", pnlTone(c.resultSol))}>
          {c.resultSol == null ? "—" : signedSol(c.resultSol)}
        </p>
        {c.resultPct != null && (
          <p className={cn("text-sm leading-[1.3] font-semibold", pnlTone(c.resultPct))}>
            {c.resultPct > 0 ? "+" : c.resultPct < 0 ? "−" : ""}
            {Math.abs(Math.round(c.resultPct))}%
          </p>
        )}
        <p className="flex items-center gap-2 text-xs leading-[1.3] text-gray-11">
          <span>{c.trades} trades</span>
          <Dot />
          <span>{c.open} open</span>
        </p>
      </div>
      <div className="flex flex-col gap-3 text-xs leading-[1.3] text-gray-11">
        <p>
          Buy: <span className="text-gray-12">{describeBuy(c.config)}</span>
        </p>
        <p>
          Sell: <span className="text-gray-12">{describeSell(c.config)}</span>
        </p>
        {c.status === "STOPPED" && (
          <p className="text-vermelho-11">
            {c.stopReason === "LOSS_LIMIT"
              ? `Stopped: lost ${c.config.protection.pauseOnLossPct24h ?? 20}% in 24 h. Resume when you're ready.`
              : `Stopped: your W1 has ${sol(balanceSol)} and each buy needs ${sol(needed)}.`}
          </p>
        )}
      </div>
    </section>
  );
}

function Footer({
  copy: c,
  label,
  loading,
  onCopy,
  onAdjust,
  onDeposit,
}: {
  copy: CopyView | null;
  label: string;
  loading: boolean;
  onCopy: () => void;
  onAdjust: (c: CopyView) => void;
  onDeposit: () => void;
}) {
  const { action } = useCopyMutations();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const run = (a: "pause" | "resume" | "end") =>
    action.mutate(
      { copyId: c!.id, action: a },
      {
        onSuccess: () => toast.success(a === "pause" ? "Copy paused." : a === "resume" ? "Copy resumed." : "You stopped copying."),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  const primary =
    "flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-principal-9 px-6 text-base leading-[1.1] font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:opacity-50";
  const secondary =
    "flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-6 bg-gray-3 px-6 text-base leading-[1.1] font-semibold text-gray-12 transition-colors hover:bg-gray-4 disabled:opacity-50";
  const danger =
    "flex h-11 flex-1 items-center justify-center rounded-lg bg-vermelho-9 px-6 text-base leading-[1.1] font-semibold text-gray-12 transition-colors hover:bg-vermelho-10 disabled:opacity-50";
  const busy = action.isPending;

  const endLink = c && (c.status === "ACTIVE" || c.status === "PAUSED") && (
    <button
      type="button"
      onClick={() => (confirmEnd ? run("end") : setConfirmEnd(true))}
      onBlur={() => setConfirmEnd(false)}
      className={cn("self-center text-xs leading-[1.3]", confirmEnd ? "font-semibold text-vermelho-11" : "text-gray-11 hover:text-gray-12")}
    >
      {confirmEnd ? "Click again to stop copying" : "Stop copying"}
    </button>
  );

  return (
    <footer className="relative z-20 flex flex-col gap-2 border-t border-gray-5 bg-gray-2 px-4 pt-3 pb-4">
      {loading ? (
        <Skeleton className="h-11 rounded-lg" />
      ) : !c || c.status === "ENDED" ? (
        <button type="button" onClick={c ? () => onAdjust(c) : onCopy} className={cn(primary, "w-full")}>
          <CopyOutlineIcon className="size-5" />
          <span className="truncate">{c ? "Copy again" : `Copy ${label}`}</span>
        </button>
      ) : c.status === "STOPPED" && c.stopReason === "LOW_BALANCE" ? (
        <>
          <button type="button" onClick={onDeposit} className={cn(primary, "w-full")}>
            Deposit to W1
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => onAdjust(c)} className={secondary}>
              Adjust copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirmEnd ? run("end") : setConfirmEnd(true))}
              onBlur={() => setConfirmEnd(false)}
              className={danger}
            >
              {confirmEnd ? "Confirm stop" : "Stop copying"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            {c.status === "ACTIVE" ? (
              <button type="button" disabled={busy} onClick={() => run("pause")} className={secondary}>
                <PauseIcon className="size-5" />
                Pause
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => run("resume")} className={secondary}>
                Resume
              </button>
            )}
            <button type="button" onClick={() => onAdjust(c)} className={cn(primary, "flex-1")}>
              Adjust copy
            </button>
          </div>
          {endLink}
        </>
      )}
    </footer>
  );
}

// ───────────────────────────── Peças ─────────────────────────────

function Kpi({ label, value, tone = "text-gray-12" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-2 bg-gray-2 p-3">
      <dt className="text-xs leading-[1.3] text-gray-11">{label}</dt>
      <dd className={cn("text-base leading-[1.1] font-semibold tabular-nums", tone)}>{value}</dd>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px flex h-9 flex-1 items-center justify-center gap-2 border-b-2 px-3 pt-1 pb-3 leading-[1.3] whitespace-nowrap",
        active ? "border-principal-9" : "border-transparent",
      )}
    >
      <span className={cn("text-sm", active ? "font-semibold text-gray-12" : "text-gray-11")}>{label}</span>
      <span className="text-xs text-gray-10">{count.toLocaleString("en-US")}</span>
    </button>
  );
}

/** "Resultado acumulado" 30d com o marcador "Você copia" (Figma "marcador-copy"). */
function ResultChart({
  detail,
  loading,
  copiedAt,
}: {
  detail: CopyKolDetail | undefined;
  loading: boolean;
  copiedAt: string | null;
}) {
  if (loading) {
    return (
      <SkeletonGroup label="Loading chart" className="relative z-10 flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-[150px] w-full" />
      </SkeletonGroup>
    );
  }
  const series = detail?.series ?? [];
  const g = chartGeometry(series);
  const total = series.at(-1) ?? 0;
  const positive = total >= 0;
  const color = positive ? "var(--color-green-11)" : "var(--color-vermelho-11)";
  // Onde o copy começou, se dentro da janela de 30 dias (fração do eixo X).
  const marker = copiedAt ? windowFraction(copiedAt) : null;

  return (
    <figure className="relative z-10 flex flex-col gap-2">
      <figcaption className="text-xs leading-[1.3] text-gray-11">Cumulative result</figcaption>
      <div className="relative">
        <svg viewBox="0 0 388 150" preserveAspectRatio="none" className="h-[150px] w-full overflow-visible" role="img" aria-label={`Cumulative result over 30 days: ${signedSol(total)}`}>
          <defs>
            <linearGradient id="copy-chart-area" x1="0" y1="26" x2="0" y2="144" gradientUnits="userSpaceOnUse">
              <stop stopColor={color} stopOpacity="0.38" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="copy-chart-line" x1="0" y1="0" x2="388" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor={color} stopOpacity="0.35" />
              <stop offset="1" stopColor={color} />
            </linearGradient>
          </defs>
          {g.grid.map((y) => (
            <path key={y} d={`M0 ${y}H388`} stroke="var(--color-gray-5)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`M0 ${g.zeroY}H388`} stroke="var(--color-gray-7)" vectorEffect="non-scaling-stroke" />
          {marker != null && (
            <>
              <rect x={marker * 388} y={12} width={388 - marker * 388} height={132} fill="rgba(249,210,64,0.08)" />
              <path d={`M${marker * 388} 12V144`} stroke="var(--color-principal-9)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            </>
          )}
          <path d={g.area} fill="url(#copy-chart-area)" />
          <path d={g.line} stroke="url(#copy-chart-line)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>
        {marker != null && (
          <span
            className="absolute top-3.5 rounded-md border border-principal-6 bg-principal-3 px-1.5 py-1 text-xs leading-[1.3] font-medium whitespace-nowrap text-principal-11"
            // Perto do fim da janela o valor final ocupa a direita: o rótulo vai para o outro lado da linha.
            style={marker < 0.6 ? { left: `calc(${marker * 100}% + 6px)` } : { right: `calc(${(1 - marker) * 100}% + 6px)` }}
          >
            You copy
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-2",
            positive ? "bg-green-11 shadow-[0_0_0_5px_rgba(113,208,131,0.18)]" : "bg-vermelho-11",
          )}
          style={{ left: `${(g.last.x / 388) * 100}%`, top: g.last.y }}
        />
        <span
          className={cn(
            "absolute right-4 rounded-md border px-2 py-1 text-xs leading-[1.3] font-medium tabular-nums",
            positive ? "border-green-6 bg-green-4 text-green-12" : "border-vermelho-6 bg-vermelho-4 text-vermelho-12",
          )}
          style={{ top: Math.max(0, Math.min(g.last.y - 34, 120)) }}
        >
          {signedSol(total)}
        </span>
      </div>
      <div className="flex justify-between text-xs leading-[1.3] text-gray-11">
        <span>30 days</span>
        <span>15 days</span>
        <span>today</span>
      </div>
    </figure>
  );
}

/** Ação na linha do tempo + o que aconteceu com você ("chip - você"). */
function TimelineRow({ event: e, you, last }: { event: TimelineEvent; you?: CopyEventRef; last: boolean }) {
  const icon =
    e.kind === "buy" ? (
      <span className="flex size-7 items-center justify-center rounded-full border border-green-6 bg-green-3 text-green-11">
        <PlusIcon className="size-3.5" />
      </span>
    ) : e.kind === "sell" ? (
      <span className="flex size-7 items-center justify-center rounded-full border border-vermelho-6 bg-vermelho-3 text-vermelho-11">
        <MinusIcon className="size-3.5" />
      </span>
    ) : (
      <span className="flex size-7 items-center justify-center rounded-full border border-principal-6 bg-principal-3 text-principal-11">
        <ChatIcon className="size-3.5" />
      </span>
    );
  const chip = you ? decisionLabel(you) : null;

  return (
    <li className="flex gap-3 px-4">
      <div className="flex shrink-0 flex-col items-center gap-1 self-stretch">
        {icon}
        {!last && <span aria-hidden className="w-0.5 flex-1 rounded-[1px] bg-gray-6" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-5">
        <div className="flex items-center justify-between gap-2 text-xs leading-[1.3]">
          <p className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            {e.kind === "call" ? (
              <span className="truncate font-semibold text-gray-12">
                Call in {callPlace(e)} {e.token}
              </span>
            ) : (
              <>
                <span className="font-semibold text-gray-12">{e.kind === "buy" ? "Bought" : "Sold"}</span>
                <span className="truncate font-semibold text-gray-12">{e.token}</span>
                <span className="text-gray-11">
                  {quoteAmount(e.quoteAmount)} {e.quoteSymbol}
                </span>
                {e.kind === "sell" && e.multiple != null && (
                  <span className={cn("font-semibold", e.multiple >= 1 ? "text-green-11" : "text-vermelho-11")}>{multipleLabel(e.multiple)}</span>
                )}
              </>
            )}
          </p>
          <time dateTime={e.at} className="shrink-0 text-right text-gray-11">
            {age(e.at)}
          </time>
        </div>
        {e.kind === "call" ? (
          <p className="line-clamp-3 rounded-[2px_10px_10px_10px] border border-gray-6 bg-gray-3 px-3 py-2 text-xs leading-[1.3] break-words text-gray-12">{e.text}</p>
        ) : (
          e.mcUsd != null && <p className="text-xs leading-[1.3] text-gray-11">MC {compactUsd(e.mcUsd)}</p>
        )}
        {chip && (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs leading-[1.3] font-medium",
              chip.dashed ? "border-dashed border-gray-6 text-gray-11" : CHIP[chip.tone],
            )}
          >
            {chip.text}
          </span>
        )}
      </div>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <SkeletonGroup label="Loading activity" className="flex flex-col gap-5 px-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
