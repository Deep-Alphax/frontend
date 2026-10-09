"use client";

import { useMemo, useState, type ReactNode } from "react";

import type {
  SignalState,
  TokenDetail,
  TokenWalletActivity,
} from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import {
  ago,
  compactUsd,
  initials,
  quoteAmount,
  signedUsd,
} from "@/lib/tracker/format";
import {
  CHART_H,
  CHART_W,
  HOLDER_LABEL,
  MARKER_KINDS,
  TIER_LABEL,
  chartGeometry,
  exitBanner,
  holderBarWidth,
  holderPct,
  multipleLabel,
  ringStates,
  signalLabel,
  supplyLabel,
} from "@/lib/tracker/tokenDetail";
import { KOL_TIERS, tierFor } from "@/lib/walletReader/types";
import { RankTag } from "@/components/tracker/parts";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/*
 * Corpo do drawer do token (Figma 1411:34396 · Carregando 1443:37870 ·
 * Risco 1443:53408 · Rugado 1443:55543). Classes LITERAIS (Tailwind v4) e
 * tokens do DS; hex solto só onde o Figma saiu da escala (laranja #e5772e do
 * medidor e dos sinais em risco).
 */

/** Laranja fora da escala do DS (Figma: medidor, "em risco", alerta de holder). */
const ORANGE = "#e5772e";

// ─────────────────────────────── Moldura ───────────────────────────────

export function Section({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 border-t border-gray-6 p-5 first:border-t-0",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold leading-[1.1] text-gray-12">
          {title}
        </h3>
        <span className="flex-1" />
        {right && (
          <span className="text-xs leading-[1.3] text-gray-11">{right}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Box({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-gray-6 bg-gray-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Status-tag semântica (fundo 3, borda 6, texto 11) — Live, Strong, sold after… */
export function SemanticTag({
  tone,
  children,
  className,
}: {
  tone: "green" | "red" | "amber";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium leading-[1.1]",
        tone === "green" && "border-green-6 bg-green-3 text-green-11",
        tone === "red" && "border-vermelho-6 bg-vermelho-3 text-vermelho-11",
        tone === "amber" &&
          "border-principal-6 bg-principal-3 text-principal-11",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────── Aviso ───────────────────────────────

export function ExitBanner({ detail }: { detail: TokenDetail }) {
  const banner = exitBanner(detail);
  if (!banner) return null;
  const rug = detail.status === "rugged";
  return (
    <div className="p-5">
      <div
        role="alert"
        className={cn(
          "flex items-start gap-3 rounded-xl border border-vermelho-7 px-4 py-3",
          rug ? "border-dashed bg-vermelho-2" : "bg-vermelho-3",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
        <img
          src="/tracker/warning-18.svg"
          alt=""
          className="size-[18px] shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 leading-[1.3]">
          <p className="text-sm font-semibold text-vermelho-12">
            {banner.title}
          </p>
          <p className="text-xs text-vermelho-11">{banner.detail}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── Confluence ───────────────────────────────

/** Arcos do anel (asset "Anel" do Figma, viewBox 97.75, traço 9.78), a partir das 12h. */
const RING_ARCS = [
  "M52.335 4.87399C61.6254 5.60428 70.4464 9.25606 77.5344 15.3063",
  "M82.4404 20.2127C88.4906 27.3008 92.1424 36.1217 92.8727 45.4122",
  "M92.8727 52.3348C92.1424 61.6252 88.4906 70.4462 82.4404 77.5342",
  "M77.5344 82.4414C70.4464 88.4916 61.6254 92.1434 52.335 92.8737",
  "M45.4133 92.8735C36.1229 92.1432 27.3019 88.4915 20.2138 82.4412",
  "M15.3063 77.5342C9.25607 70.4462 5.60429 61.6252 4.874 52.3348",
  "M4.87385 45.4121C5.60414 36.1217 9.25593 27.3007 15.3061 20.2126",
  "M20.2138 15.3061C27.3019 9.25593 36.1229 5.60414 45.4133 4.87385",
];

/** Cor do ponto/segmento: bom = amarelo (laranja em risco), ruim = vermelho, resto = cinza. */
function stateColor(state: SignalState, risk: boolean): string {
  if (state === "good") return risk ? ORANGE : "var(--color-principal-9)";
  if (state === "bad") return "var(--color-vermelho-9)";
  return "var(--color-gray-7)";
}

/** Segmento do anel: apagado é gray-6 (o ponto apagado é gray-7, como no Figma). */
function ringColor(state: SignalState, risk: boolean): string {
  return state === "good" || state === "bad"
    ? stateColor(state, risk)
    : "var(--color-gray-6)";
}

function SignalRing({ detail }: { detail: TokenDetail }) {
  const good = detail.signals.filter((s) => s.state === "good").length;
  const rug = detail.status === "rugged";
  const risk = detail.status === "risk";
  const states = ringStates(detail.signals);
  return (
    <div
      className="relative flex size-[88px] shrink-0 items-center justify-center"
      role="img"
      aria-label={`${good} of ${detail.signals.length} signals`}
    >
      <span
        className={cn(
          "text-[44px] font-semibold leading-[1.1]",
          rug ? "text-gray-11" : "text-gray-12",
        )}
      >
        {good}
      </span>
      <svg
        viewBox="0 0 97.7465 97.7476"
        fill="none"
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[97.75px] max-w-none -translate-x-1/2 -translate-y-1/2"
      >
        {RING_ARCS.map((d, i) => (
          <path
            key={i}
            d={d}
            strokeWidth={9.77778}
            // Rug: o anel inteiro apaga (só os pontos guardam a cor).
            stroke={rug ? "var(--color-gray-6)" : ringColor(states[i], risk)}
          />
        ))}
      </svg>
    </div>
  );
}

const SCORE_TONE = {
  strong: { text: "text-green-11", tag: "green" },
  moderate: { text: "text-principal-11", tag: "amber" },
  danger: { text: "text-vermelho-11", tag: "red" },
} as const;

export function ConfluenceSection({ detail }: { detail: TokenDetail }) {
  const good = detail.signals.filter((s) => s.state === "good").length;
  const risk = detail.status === "risk";
  const { score, tier } = detail.deepScore;
  const tone = SCORE_TONE[tier];
  return (
    <Section
      title="Confluence"
      right={`${good} of ${detail.signals.length} signals`}
    >
      <Box>
        <div className="flex items-center gap-4 p-4">
          <SignalRing detail={detail} />
          <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {detail.signals.map((s) => (
              <li
                key={s.id}
                className="flex h-[18px] items-center gap-2"
                title={
                  s.state === "unknown"
                    ? "No data source for this signal yet"
                    : undefined
                }
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: stateColor(s.state, risk) }}
                />
                <span
                  className={cn(
                    "truncate text-xs leading-[1.3]",
                    s.state === "good" && "text-gray-12",
                    s.state === "bad" && "text-vermelho-11",
                    (s.state === "off" || s.state === "unknown") &&
                      "text-gray-11",
                  )}
                >
                  {signalLabel(s.id, s.state)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-6 px-4 py-3">
          <span
            className={cn(
              "w-10 font-display text-2xl font-semibold leading-[1.1] tracking-[1px]",
              tone.text,
            )}
          >
            {score}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center">
              <span className="flex-1 text-xs leading-[1.3] text-gray-11">
                Deep Score
              </span>
              <SemanticTag tone={tone.tag}>{TIER_LABEL[tier]}</SemanticTag>
            </div>
            <div
              className="relative h-2 w-full max-w-[400px] rounded bg-gradient-to-r from-vermelho-9 via-[#e5772e] via-45% to-green-9"
              role="meter"
              aria-label="Deep Score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
            >
              <span
                className="absolute -top-1 h-4 w-1 rounded-[2px] bg-gray-12"
                style={{ left: `calc(${score}% - ${(score / 100) * 4}px)` }}
              />
            </div>
          </div>
        </div>
      </Box>
    </Section>
  );
}

// ─────────────────────────────── Gráfico ───────────────────────────────

const MARKER_COLOR: Record<string, string> = {
  "super-alpha": "var(--color-vermelho-9)",
  alpha: "var(--color-violeta-9)",
  diamond: "var(--color-secundaria-9)",
  platinum: "var(--color-menta-9)",
  gold: "var(--color-principal-9)",
  silver: "var(--color-gray-11)",
  wood: "var(--color-gray-8)",
  sniper: ORANGE,
  call: "var(--color-gray-12)",
};

export function ChartSection({ detail }: { detail: TokenDetail }) {
  const geo = useMemo(() => chartGeometry(detail.chart), [detail.chart]);
  const kinds = new Set(geo?.markers.map((m) => m.kind));
  const legend = MARKER_KINDS.filter((k) => kinds.has(k.kind));
  const up = geo?.trend !== "down";
  const stroke = up ? "var(--color-green-9)" : "var(--color-vermelho-11)";
  return (
    <Section title="Chart" right="Market cap · 1h">
      <Box>
        <div className="relative h-[140px] w-full">
          {geo ? (
            <>
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                className="absolute inset-0 size-full"
                role="img"
                aria-label={`Market cap over the last hour: ${compactUsd(geo.first)} to ${compactUsd(geo.last)}`}
              >
                <defs>
                  <linearGradient
                    id="token-chart-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0" stopColor={stroke} stopOpacity={0.28} />
                    <stop offset="1" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={geo.area} fill="url(#token-chart-fill)" />
                <path
                  d={geo.line}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {/* Marcadores em HTML: o SVG estica (preserveAspectRatio none), o círculo não. */}
              {geo.markers.map((m, i) =>
                m.kind === "call" ? (
                  <span
                    key={i}
                    className="absolute h-[9px] w-3 -translate-x-1/2 -translate-y-[calc(100%+6px)] rounded-[2px] bg-gray-12"
                    style={{ left: `${m.left}%`, top: `${m.top}%` }}
                    title={`Group call · ${ago(m.t)}`}
                  />
                ) : (
                  <span
                    key={i}
                    className="absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-gray-1"
                    style={{
                      left: `${m.left}%`,
                      top: `${m.top}%`,
                      background: MARKER_COLOR[m.kind] ?? MARKER_COLOR.wood,
                    }}
                    title={`${MARKER_KINDS.find((k) => k.kind === m.kind)?.label ?? "KOL"} buy · ${ago(m.t)}`}
                  />
                ),
              )}
            </>
          ) : (
            <p className="flex size-full items-center justify-center px-6 text-center text-xs leading-[1.4] text-gray-11">
              The chart starts after a few minutes of live tracking.
            </p>
          )}
        </div>
        {legend.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-6 px-3 py-2">
            {legend.map((k) => (
              <span
                key={k.kind}
                className="inline-flex items-center gap-1 text-xs leading-[1.3] text-gray-11"
              >
                <span
                  className={cn(
                    "size-2 shrink-0",
                    k.kind === "call" ? "rounded-[2px]" : "rounded-full",
                  )}
                  style={{ background: MARKER_COLOR[k.kind] }}
                />
                {k.label}
              </span>
            ))}
          </div>
        )}
      </Box>
    </Section>
  );
}

// ─────────────────────────────── Holders ───────────────────────────────

const HOLDER_TONE = {
  good: { bar: "bg-green-9", text: "text-green-11" },
  bad: { bar: "bg-vermelho-9", text: "text-vermelho-11" },
  warn: { bar: "bg-[#e5772e]", text: "text-[#e5772e]" },
  none: { bar: "", text: "text-gray-11" },
} as const;

export function HoldersSection({ detail }: { detail: TokenDetail }) {
  const { rows, updatedAt } = detail.holders;
  return (
    <Section
      title="Holder health"
      right={updatedAt ? `Updated ${ago(updatedAt)}` : undefined}
    >
      <Box className="flex flex-col gap-3 px-4 py-3">
        {rows.map((r) => {
          const tone = HOLDER_TONE[r.tone];
          return (
            <div
              key={r.id}
              className="flex items-center gap-3"
              title={
                r.pct == null ? "No data source for this metric yet" : undefined
              }
            >
              <span className="w-[112px] shrink-0 text-xs leading-[1.3] text-gray-11">
                {HOLDER_LABEL[r.id]}
              </span>
              <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-gray-3">
                {r.pct != null && (
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded",
                      tone.bar,
                    )}
                    style={{ width: holderBarWidth(r.pct) }}
                  />
                )}
              </span>
              <span
                className={cn(
                  "w-[52px] shrink-0 text-right text-xs font-semibold leading-[1.3]",
                  tone.text,
                )}
              >
                {r.pct == null ? "—" : holderPct(r.pct)}
              </span>
            </div>
          );
        })}
      </Box>
    </Section>
  );
}

// ─────────────────────────────── Carteiras ───────────────────────────────

type WalletFilter = "all" | "diamond" | "sniper" | "insider" | "dev";

const DIAMOND_MIN = KOL_TIERS.find((t) => t.id === "diamond")?.min ?? 63;

const WALLET_FILTERS: Array<{
  id: WalletFilter;
  label: string;
  match: (w: TokenWalletActivity) => boolean;
}> = [
  { id: "all", label: "All", match: () => true },
  // "Diamond+" = do nível Diamond para cima (mesma régua de níveis do índice).
  {
    id: "diamond",
    label: "Diamond+",
    match: (w) => w.kol.relevance >= DIAMOND_MIN,
  },
  { id: "sniper", label: "Snipers", match: (w) => w.types.includes("sniper") },
  {
    id: "insider",
    label: "Insiders",
    match: (w) => w.types.includes("insider"),
  },
  { id: "dev", label: "Dev", match: (w) => w.types.includes("dev") },
];

/** Anel do avatar = cor do nível (Figma: Super alpha vermelho, Diamond azul…). */
const AVATAR_RING: Record<string, string> = {
  "super-alpha": "border-vermelho-9",
  alpha: "border-violeta-9",
  diamond: "border-secundaria-9",
  platinum: "border-menta-9",
  gold: "border-principal-9",
  silver: "border-gray-9",
  wood: "border-gray-7",
};

/** Tags de papel (Status-tag · Função): gradiente 7→3, borda 9, texto 12. */
const ROLE_TAG: Record<string, { label: string; cls: string }> = {
  callOwner: {
    label: "Call owner",
    cls: "border-principal-9 from-principal-7 to-principal-3 text-principal-12",
  },
  sniper: {
    label: "Sniper",
    cls: "border-laranja-9 from-laranja-7 to-laranja-3 text-laranja-12",
  },
  insider: {
    label: "Insider",
    cls: "border-violeta-9 from-violeta-7 to-violeta-3 text-violeta-12",
  },
  dev: {
    label: "Dev",
    cls: "border-secundaria-9 from-secundaria-7 to-secundaria-3 text-secundaria-12",
  },
};

function RoleTag({ role }: { role: keyof typeof ROLE_TAG }) {
  const t = ROLE_TAG[role];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border bg-gradient-to-r p-1.5 text-xs font-medium leading-none",
        t.cls,
      )}
    >
      {t.label}
    </span>
  );
}

function WalletRow({ w }: { w: TokenWalletActivity }) {
  const tier = tierFor(w.kol.relevance);
  const handle = w.kol.handle ? `@${w.kol.handle}` : w.kol.name;
  const buy = w.action === "BUY";
  const roles = (["sniper", "insider", "dev"] as const).filter((r) =>
    w.types.includes(r),
  );
  return (
    <li className="flex items-center gap-3 p-3">
      <span
        aria-hidden
        className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] bg-gray-3 text-xs font-semibold text-gray-12",
          AVATAR_RING[tier.id] ?? AVATAR_RING.wood,
        )}
      >
        {initials(w.kol.handle ?? w.kol.name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold leading-[1.3] text-gray-12">
            {handle}
          </span>
          <RankTag relevance={w.kol.relevance} size="sm" />
          {w.callOwner && <RoleTag role="callOwner" />}
          {roles.map((r) => (
            <RoleTag key={r} role={r} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs leading-[1.3] text-gray-11">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-1.5 font-medium leading-none",
              buy
                ? "border-green-6 bg-green-3 text-green-11"
                : "border-vermelho-6 bg-vermelho-3 text-vermelho-11",
            )}
          >
            {buy ? "BOUGHT" : "SOLD"}
          </span>
          <span>
            {w.quoteSymbol === "USD"
              ? compactUsd(w.quoteAmount)
              : `${quoteAmount(w.quoteAmount)} ${w.quoteSymbol}`}
          </span>
          {w.entryMcUsd != null && (
            <span>entry {compactUsd(w.entryMcUsd)}</span>
          )}
          {w.supplyPct != null && (
            <span>{supplyLabel(w.supplyPct)} of supply</span>
          )}
          <span>{ago(w.lastAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 leading-[1.3]">
        {w.pnlUsd != null && (
          <span
            className={cn(
              "text-sm font-semibold",
              w.pnlUsd >= 0 ? "text-green-11" : "text-vermelho-11",
            )}
          >
            {signedUsd(w.pnlUsd)}
          </span>
        )}
        <span className="text-[11px] text-gray-11">
          {w.exited
            ? "exited"
            : w.multiple != null
              ? multipleLabel(w.multiple)
              : ""}
        </span>
      </div>
    </li>
  );
}

export function WalletsSection({ detail }: { detail: TokenDetail }) {
  const [filter, setFilter] = useState<WalletFilter>("all");
  const { items, smartMoneyUsd } = detail.wallets;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        WALLET_FILTERS.map((f) => [f.id, items.filter(f.match).length]),
      ),
    [items],
  );
  const shown = items.filter(
    WALLET_FILTERS.find((f) => f.id === filter)!.match,
  );
  return (
    <Section
      title="Wallet activity"
      right={
        smartMoneyUsd > 0
          ? `Smart money ${compactUsd(smartMoneyUsd)}`
          : undefined
      }
    >
      <div
        role="tablist"
        aria-label="Filter wallets"
        className="flex flex-wrap items-center gap-1.5"
      >
        {WALLET_FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded border p-2 text-sm leading-none transition-colors",
                active
                  ? "border-gray-8 bg-gray-5 text-gray-12"
                  : "border-gray-6 bg-gray-3 text-gray-11 hover:border-gray-8 hover:bg-gray-4 hover:text-gray-12",
              )}
            >
              {f.label}
              <span className="text-[#838383]">{counts[f.id]}</span>
            </button>
          );
        })}
      </div>
      {shown.length ? (
        <Box>
          <ul aria-label="Wallets" className="divide-y divide-gray-6">
            {shown.map((w) => (
              <WalletRow key={w.kol.id} w={w} />
            ))}
          </ul>
        </Box>
      ) : (
        <Box>
          <p className="px-4 py-6 text-center text-xs leading-[1.4] text-gray-11">
            {items.length
              ? "No wallet in this filter."
              : "No tracked wallet traded this token yet."}
          </p>
        </Box>
      )}
    </Section>
  );
}

// ─────────────────────────────── Calls ───────────────────────────────

const RELATION: Record<
  NonNullable<TokenDetail["calls"][number]["relation"]>,
  { label: string; tone: "green" | "red" | "amber" }
> = {
  bought_before: { label: "bought before", tone: "green" },
  sold_after: { label: "sold after", tone: "red" },
  entered_after: { label: "entered after", tone: "amber" },
};

export function CallsSection({ detail }: { detail: TokenDetail }) {
  return (
    <Section title="Calls on this token">
      <Box>
        {detail.calls.length ? (
          <ul aria-label="Calls" className="divide-y divide-gray-6">
            {detail.calls.map((c) => {
              const rel = c.relation ? RELATION[c.relation] : null;
              return (
                <li key={c.id} className="flex items-start gap-3 p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-[1.3]">
                      <span className="font-semibold text-gray-12">
                        {c.author}
                      </span>
                      <span className="text-gray-11">
                        {c.group ? `on ${c.group}, ` : ""}
                        {ago(c.at)}
                      </span>
                      {rel && (
                        <SemanticTag tone={rel.tone}>{rel.label}</SemanticTag>
                      )}
                    </div>
                    <p className="line-clamp-3 w-fit max-w-full whitespace-pre-line break-words rounded-b-xl rounded-tl rounded-tr-xl bg-gray-3 px-3 py-2 text-xs leading-[1.3] text-gray-12">
                      {c.text}
                    </p>
                  </div>
                  {c.multiple != null && (
                    <div className="flex shrink-0 flex-col items-end gap-2 leading-[1.3]">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          c.multiple >= 1
                            ? "text-green-11"
                            : "text-vermelho-11",
                        )}
                      >
                        {multipleLabel(c.multiple)}
                      </span>
                      {c.mcAtCall != null && (
                        <span className="text-[11px] text-gray-11">
                          since {compactUsd(c.mcAtCall)}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-xs leading-[1.4] text-gray-11">
            No group called this token yet.
          </p>
        )}
      </Box>
    </Section>
  );
}

// ─────────────────────────────── Carregando ───────────────────────────────

/** Estado Carregando (1443:37870): blocos nas alturas do Figma, px 20 py 16, vão 12. */
export function DrawerBodySkeleton() {
  return (
    <SkeletonGroup
      label="Loading token details"
      className="flex flex-col gap-3 px-5 py-4"
    >
      {[64, 90, 22, 150, 120, 200].map((h, i) => (
        <Skeleton key={i} className="w-full rounded-lg" style={{ height: h }} />
      ))}
    </SkeletonGroup>
  );
}
