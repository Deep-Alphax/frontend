"use client";

import { useState } from "react";

import type { DevCard as DevCardData, LaunchRow } from "@/lib/api/devSnipe";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { walletShort } from "@/lib/copyTrade/format";
import {
  bestLabel,
  devGradient,
  devHistoryLabel,
  devInitials,
  lastLaunchLabel,
  launchAgo,
  migratedOfLabel,
  migrationRateLabel,
  snipesChip,
} from "@/lib/devSnipe/config";
import { LAUNCHES_PAGE, useLaunches, useTrendingDevs } from "@/lib/devSnipe/useDevSnipe";
import { compactUsd, tokenLabel } from "@/lib/tracker/format";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { BoltIcon, DevSnipeIcon } from "@/components/copyTrade/icons";
import { Pagination } from "@/components/copyTrade/controls";
import { SectionTitle } from "@/components/copyTrade/parts";

/**
 * Coluna da direita do Dev Snipe (Figma 1633:33457): cabeçalho "Devs to
 * watch", grade "Trending devs" (1633:34138) e tabela "Recent launches"
 * (1633:34277 / 1655:45992). "Snipe" no card abre o drawer com o endereço.
 *
 * Divergência: sem "See all →" na tabela — a própria tabela já pagina tudo.
 */
export function DevSnipeHome({ enabled, onSnipe }: { enabled: boolean; onSnipe: (dev: string) => void }) {
  return (
    <div className="flex flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-base leading-[1.1] font-semibold tracking-[1px] text-gray-12">Devs to watch</h2>
        <p className="text-xs leading-[1.3] text-gray-11">
          Wallets that already launched tokens that migrated. Sniping buys their next launch.
        </p>
      </header>
      <TrendingDevs enabled={enabled} onSnipe={onSnipe} />
      <RecentLaunches enabled={enabled} />
    </div>
  );
}

function TrendingDevs({ enabled, onSnipe }: { enabled: boolean; onSnipe: (dev: string) => void }) {
  const devs = useTrendingDevs(enabled);
  const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={<DevSnipeIcon className="size-3" />} title="Trending devs" hint="highest migration rate in 30 days" />
      {devs.isError && !devs.data ? (
        <p className="text-sm text-vermelho-11">{getApiErrorMessage(devs.error)}</p>
      ) : devs.isPending ? (
        <SkeletonGroup label="Loading devs" className={grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <DevCardSkeleton key={i} />
          ))}
        </SkeletonGroup>
      ) : devs.data.length ? (
        <ul className={grid}>
          {devs.data.map((d) => (
            <li key={d.address} className="flex">
              <DevCard dev={d} onSnipe={() => onSnipe(d.address)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-gray-5 bg-gray-2 p-6 text-center text-sm text-gray-11">
          No dev to show yet. Devs show up here once their launches start migrating.
        </p>
      )}
    </section>
  );
}

/** Avatar do dev: degradê por endereço + selo de alvo (Figma "card - dev" 1630:33364). */
function DevAvatar({ address }: { address: string }) {
  return (
    <span
      style={{ backgroundImage: devGradient(address) }}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/12"
    >
      <span className="text-xs leading-[1.3] font-semibold text-white">{devInitials(address)}</span>
      <span className="absolute top-[29px] left-[29px] flex size-4 items-center justify-center rounded-full border border-gray-6 bg-gray-2 text-green-11">
        <DevSnipeIcon className="size-2.5" />
      </span>
    </span>
  );
}

/** "card - dev" (Figma 1630:33364). */
function DevCard({ dev, onSnipe }: { dev: DevCardData; onSnipe: () => void }) {
  const s = dev.stats;
  const short = walletShort(dev.address);
  return (
    <article className="relative isolate flex w-full flex-col overflow-hidden rounded-xl border border-gray-5 bg-gray-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/copy-trade/dev-card-glow.svg"
        alt=""
        aria-hidden
        width={220}
        height={160}
        className="pointer-events-none absolute -top-[91px] -right-[71px] -z-10 h-40 w-[220px] max-w-none"
      />
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <DevAvatar address={dev.address} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.3]">
          <p className="truncate text-sm font-semibold text-gray-12">{short}</p>
          <p className="truncate text-xs text-gray-11">{lastLaunchLabel(s)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 pt-1 pb-4">
        <div className="flex items-center justify-between leading-[1.3]">
          <p className="text-xs text-gray-11">Migration rate</p>
          <p className={cn("text-sm font-semibold tabular-nums", s.migrationRate ? "text-green-11" : "text-gray-11")}>
            {migrationRateLabel(s)}
          </p>
        </div>
        {/* Últimos lançamentos, do mais antigo ao mais novo: verde = migrou. */}
        <div className="flex h-2 gap-[3px]" aria-hidden>
          {(s.recent.length ? s.recent : [false]).map((m, i) => (
            <span key={i} className={cn("h-full min-w-px flex-1 rounded-[2px]", m ? "bg-green-9" : "bg-gray-5")} />
          ))}
        </div>
        <p className="text-xs leading-[1.3] text-gray-11">{migratedOfLabel(s)}</p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-gray-5 px-4 py-3">
        <div className="flex gap-4 leading-[1.3] whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-11">Tokens</p>
            <p className="text-sm font-semibold text-gray-12 tabular-nums">{s.tokens.toLocaleString("en-US")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-11">Best</p>
            <p className="text-sm font-semibold text-gray-12 tabular-nums">{bestLabel(s)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSnipe}
          aria-label={`Snipe ${short}`}
          className="flex items-center justify-center gap-1.5 rounded border border-principal-6 bg-principal-3 p-2 text-sm leading-[1.3] text-principal-11 transition-colors hover:border-principal-8 hover:bg-principal-4 hover:text-principal-12"
        >
          <DevSnipeIcon className="size-4" />
          Snipe
        </button>
      </div>
    </article>
  );
}

function DevCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-gray-5 bg-gray-2">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-2 w-full rounded-[2px]" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center justify-between border-t border-gray-5 px-4 py-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-20 rounded" />
      </div>
    </div>
  );
}

/** Colunas da tabela (larguras do Figma 1655:45992). */
const COLS = {
  dev: "w-[160px]",
  launched: "w-[120px]",
  mc: "w-[110px] text-right",
  history: "w-[160px]",
  snipes: "w-[120px] text-right",
};

function RecentLaunches({ enabled }: { enabled: boolean }) {
  const [page, setPage] = useState(1);
  const launches = useLaunches(page, enabled);
  const d = launches.data;
  const th = "h-11 px-0 py-3 text-left text-xs leading-[1.3] font-normal whitespace-nowrap text-gray-11";

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle icon={<BoltIcon className="size-3" />} title="Recent launches" hint="new tokens from devs being watched" />
      <div className="overflow-hidden rounded-xl border border-gray-5 bg-gray-2">
        {launches.isError && !d ? (
          <p className="p-4 text-sm text-vermelho-11">{getApiErrorMessage(launches.error)}</p>
        ) : !d ? (
          <SkeletonGroup label="Loading launches" className="flex flex-col">
            <div className="h-11 border-b border-gray-5" />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={cn("flex h-11 items-center gap-3 px-4", i % 2 === 1 && "bg-gray-3")}>
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
                <span className="flex-1" />
                <Skeleton className="hidden h-3 w-20 sm:block" />
                <Skeleton className="hidden h-3 w-16 md:block" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </SkeletonGroup>
        ) : d.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className={cn("w-full min-w-[760px] border-collapse", launches.isPlaceholderData && "opacity-60")}>
                <thead>
                  <tr className="border-b border-gray-5 [&>th:first-child]:pl-4 [&>th:last-child]:pr-4 [&>th+th]:pl-3">
                    <th scope="col" className={th}>Token</th>
                    <th scope="col" className={cn(th, COLS.dev)}>Dev</th>
                    <th scope="col" className={cn(th, COLS.launched)}>Launched</th>
                    <th scope="col" className={cn(th, COLS.mc)}>Market cap</th>
                    <th scope="col" className={cn(th, COLS.history)}>Dev history</th>
                    <th scope="col" className={cn(th, COLS.snipes)}>Snipes</th>
                  </tr>
                </thead>
                <tbody>
                  {d.items.map((r, i) => (
                    <LaunchTr key={r.mint} row={r} zebra={i % 2 === 1} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={d.page} pageSize={LAUNCHES_PAGE} total={d.total} noun="launches" onPage={setPage} />
          </>
        ) : (
          <p className="p-6 text-center text-sm text-gray-11">No launches yet. New tokens from the devs being watched show up here.</p>
        )}
      </div>
    </section>
  );
}

/** "linha - lançamento" (Figma 1630:33485). */
function LaunchTr({ row: r, zebra }: { row: LaunchRow; zebra: boolean }) {
  const chip = snipesChip(r);
  const td = "h-11 py-0 text-xs leading-[1.3] whitespace-nowrap text-gray-12";
  const label = tokenLabel(r);
  return (
    <tr className={cn("[&>td:first-child]:pl-4 [&>td:last-child]:pr-4 [&>td+td]:pl-3", zebra && "bg-gray-3")}>
      <td className={td}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-4 text-xs leading-[1.3] font-semibold text-gray-12">
            {(r.symbol ?? r.mint).replace(/^\$/, "").slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate text-sm font-semibold" title={r.name ?? undefined}>
            {label}
          </span>
        </span>
      </td>
      <td className={cn(td, COLS.dev)}>{r.devLabel}</td>
      <td className={cn(td, COLS.launched)}>
        <time dateTime={r.createdAt}>{launchAgo(r.createdAt)}</time>
      </td>
      <td className={cn(td, COLS.mc, "tabular-nums")}>{compactUsd(r.mcUsd)}</td>
      <td className={cn(td, COLS.history)}>{devHistoryLabel(r.devHistory)}</td>
      <td className={cn(td, COLS.snipes)}>
        {chip ? (
          <span
            className={cn(
              "inline-flex rounded px-2 py-0.5 font-medium",
              chip.tone === "green" ? "bg-green-3 text-green-11" : "bg-gray-4 text-gray-11",
            )}
          >
            {chip.text}
          </span>
        ) : (
          <span className="text-gray-11">—</span>
        )}
      </td>
    </tr>
  );
}
