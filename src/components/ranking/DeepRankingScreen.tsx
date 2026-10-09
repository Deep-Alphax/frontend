"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { getApiErrorMessage, isUnauthorizedError } from "@/lib/api/client";
import { useRankingOverview, useRankingStandings } from "@/lib/ranking/useRanking";
import { Topbar } from "@/components/home/Topbar";
import { KolsTabs } from "@/components/walletReader/KolsTabs";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { Podium } from "@/components/ranking/Podium";
import { HowItWorksButton, SeasonCountdown } from "@/components/ranking/SeasonHeader";
import { StandingsTable } from "@/components/ranking/StandingsTable";

/** Degradê do título "Deep Ranking" (Figma 1463:13478). */
const TITLE_GRADIENT =
  "linear-gradient(90deg, #ffffff 0%, var(--color-principal-12) 45%, var(--color-principal-9) 75%, #e5772e 100%)";

/** Faixa "Connect X" (Figma 1464:13528): violeta → azul sobre gray-2. */
const CONNECT_X_BG =
  "linear-gradient(90deg, rgba(110,86,207,0.18) 0%, rgba(110,86,207,0) 40%, rgba(60,146,221,0.14) 100%), linear-gradient(90deg, var(--color-gray-2) 0%, var(--color-gray-2) 100%)";

function PodiumSkeleton() {
  return (
    <SkeletonGroup label="Loading podium" className="flex w-full max-w-[1060px] items-end gap-2.5 max-sm:flex-col max-sm:items-center">
      {[262, 310, 228].map((h, i) => (
        <div key={i} className="flex w-full max-w-[370px] flex-1 flex-col items-center gap-5">
          <Skeleton className="size-24 rounded-[28px]" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="w-full rounded-t-xl" style={{ height: h }} />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * Deep Ranking (Figma 1463:13409): aba da área de KOLs. Hero com luzes,
 * contador da temporada e pódio do top 3; abaixo, a faixa "Connect X" e a
 * classificação paginada com busca.
 *
 * Rolagem de PÁGINA nativa (decisão 2026-09-22: ScrollArea só em painéis).
 */
export function DeepRankingScreen() {
  const overview = useRankingOverview();
  const season = overview.data?.season ?? null;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().replace(/^@/, "")), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const standings = useRankingStandings(search, !!season);
  const rows = useMemo(
    () => standings.data?.pages.flatMap((p) => p.rows) ?? [],
    [standings.data],
  );

  const empty = search
    ? `No KOL matches "@${search}".`
    : !season
      ? "No season yet."
      : season.status === "upcoming"
        ? "The season hasn't started yet."
        : (overview.data?.total ?? 0) <= 3
          ? "Positions from 4th onwards show up here."
          : "No scored calls yet.";

  return (
    <div className="min-h-dvh bg-gray-1">
      <Topbar />

      {/* ── Hero ── */}
      {/* O degradê de base do fundo SVG (#14151c → gray-1) cobre a largura
          toda: acima de 1440px a borda do SVG não aparece como emenda. */}
      <section className="relative overflow-clip bg-[linear-gradient(180deg,#14151c_0px,var(--color-gray-1)_850px)] px-4 pt-8 pb-8">
        {/* Fundo (luz dourada + 2 feixes) e o feixe laranja, centrados no 1440 do Figma. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- fundo SVG do Figma */}
        <img
          src="/ranking/fundo.svg"
          alt=""
          width={1440}
          height={1000}
          className="pointer-events-none absolute top-0 left-1/2 max-w-none -translate-x-1/2"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-[calc(50%+252px)] h-[785px] w-[220px] bg-gradient-to-b from-[rgba(229,119,46,0.16)] to-[rgba(229,119,46,0)] to-70% opacity-60 blur-[16px]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- bolhas SVG do Figma */}
        <img
          src="/ranking/bolhas.svg"
          alt=""
          width={1060}
          height={600}
          className="pointer-events-none absolute top-[324px] left-1/2 max-w-none -translate-x-1/2"
        />

        <div className="relative mx-auto flex w-full max-w-[1060px] flex-col items-center">
          {/* Cabeçalho (Figma 1475:14612) */}
          <header className="flex w-full flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col justify-between gap-10 self-stretch">
              <KolsTabs />
              <h1
                className="bg-clip-text font-display text-[32px] font-semibold leading-[1.1] tracking-[1px] whitespace-nowrap text-transparent"
                style={{ backgroundImage: TITLE_GRADIENT }}
              >
                Deep Ranking
              </h1>
            </div>
            <div className="flex flex-col items-end gap-5 max-sm:items-start">
              {season && <SeasonCountdown season={season} />}
              <HowItWorksButton />
            </div>
          </header>

          {overview.isLoading ? (
            <div className="mt-16 w-full">
              <PodiumSkeleton />
            </div>
          ) : overview.isError ? (
            <div className="mt-16 flex flex-col items-center gap-3 rounded-lg border border-gray-6 bg-gray-2 px-6 py-10 text-center">
              {isUnauthorizedError(overview.error) ? (
                <>
                  <p className="text-sm text-gray-11">Your session has expired.</p>
                  <Link
                    href="/login"
                    className="rounded-lg bg-principal-9 px-4 py-2 text-sm font-semibold text-gray-1 hover:bg-principal-10"
                  >
                    Sign in again
                  </Link>
                </>
              ) : (
                <>
                <p className="text-sm text-gray-11">
                  {getApiErrorMessage(overview.error, "Could not load the ranking.")}
                </p>
                <button
                  type="button"
                  onClick={() => void overview.refetch()}
                  className="rounded-lg border border-gray-6 bg-gray-3 px-4 py-2 text-sm font-semibold text-gray-12 hover:border-gray-8"
                >
                  Try again
                </button>
                </>
              )}
            </div>
          ) : !season ? (
            <div className="mt-16 mb-24 flex max-w-md flex-col items-center gap-2 rounded-lg border border-gray-6 bg-gray-2/80 px-6 py-10 text-center backdrop-blur">
              <p className="text-base font-semibold text-gray-12">The first season is coming</p>
              <p className="text-sm text-gray-11">
                The countdown and the podium show up here as soon as a season is scheduled.
              </p>
            </div>
          ) : (
            // Avatar do 1º a 29px do cabeçalho: espaço exato da coroa (−30px),
            // que encosta no fim do cabeçalho como no Figma (140 vs. 141).
            <div className="mt-12 flex w-full justify-center sm:mt-[29px]">
              <Podium rows={overview.data?.podium ?? []} />
            </div>
          )}
        </div>
      </section>

      {/* ── Connect X + classificação (Figma 1466:13574) ── */}
      <section className="flex flex-col items-center gap-10 px-4 pb-[52px] lg:px-20">
        <div
          className="flex w-full max-w-[820px] flex-wrap items-center gap-4 rounded-2xl border border-violeta-7 py-3 pr-4 pl-3"
          style={{ backgroundImage: CONNECT_X_BG }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- X do Figma */}
            <img src="/ranking/x-16.svg" alt="" width={16} height={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm leading-[1.3]">
            <p className="font-semibold text-gray-12">Connect your X to join the ranking.</p>
            <p className="text-gray-11">Your calls and posts will start earning points from then on.</p>
          </div>
          {/* Integração com o X fica para depois (decisão 2026-10-09): hoje o
              ranking é dos KOLs do índice. */}
          <button
            type="button"
            disabled
            className="flex h-11 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-8 text-base font-semibold text-gray-11"
          >
            Coming soon
          </button>
        </div>

        <div className="flex w-full max-w-[1280px] flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-semibold leading-[1.1] tracking-[1px] text-gray-12">
              Standings
            </h2>
            <div className="min-w-px flex-1" />
            <label className="flex w-full items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 p-3 focus-within:border-secundaria-11/60 sm:w-[260px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- lupa do Figma */}
              <img src="/ranking/lupa.svg" alt="" width={16} height={16} />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search @user"
                aria-label="Search KOL in the ranking"
                maxLength={40}
                className="min-w-0 flex-1 bg-transparent text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11"
              />
            </label>
          </div>

          <StandingsTable
            rows={rows}
            loading={overview.isLoading || (!!season && standings.isLoading)}
            empty={empty}
            hasMore={!!standings.hasNextPage}
            loadingMore={standings.isFetchingNextPage}
            onLoadMore={() => void standings.fetchNextPage()}
          />
        </div>
      </section>
    </div>
  );
}
