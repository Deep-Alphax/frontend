"use client";

import type { CSSProperties } from "react";

import type { RankingRow } from "@/lib/api/ranking";
import { cn } from "@/lib/cn";
import { avatarSkin, fmtPoints, fmtPrize, initials } from "@/lib/ranking/rules";
import { RankTag } from "@/components/tracker/parts";

/*
 * Pódio do Deep Ranking (Figma 1463:13581 / 13617 / 13646). Cada coluna é:
 * pessoa (avatar + nome + rank) → tampo (SVG) → bloco (máscara SVG + degradês)
 * com pontos, prêmio, acerto e variação. As três alinham pela BASE (788px no
 * Figma), então a altura de cada bloco é o que dá o degrau.
 */

type Place = 1 | 2 | 3;

interface PlaceSkin {
  /** flex-grow proporcional à largura do Figma (335 / 370 / 335). */
  grow: string;
  order: string;
  blockH: string;
  /** Halo começa um pouco acima da pessoa (Figma: −1 / −7 / −11 px). */
  haloTop: string;
  avatar: string;
  avatarText: string;
  name: string;
  points: string;
  /** Linha de brilho no topo do tampo. */
  shine: string;
  prize: string;
  block: CSSProperties;
  inset: string;
}

const PLACES: Record<Place, PlaceSkin> = {
  1: {
    grow: "sm:flex-[370_1_0]",
    order: "max-sm:order-1 sm:order-2",
    blockH: "h-[200px] sm:h-[310px]",
    haloTop: "-top-px",
    avatar:
      "size-[116px] rounded-[34px] border-principal-9 drop-shadow-[0_18px_25px_rgba(249,210,64,0.35)]",
    avatarText: "text-[28px]",
    name: "text-2xl",
    points: "text-[28px]",
    shine: "via-principal-12",
    prize: "border-principal-6 bg-principal-3 text-principal-11",
    block: {
      backgroundImage:
        "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.45) 100%), linear-gradient(180deg, rgba(249,210,64,0.26) 0%, rgba(24,25,31,0) 38%), linear-gradient(90deg, #18191f 0%, #18191f 100%)",
    },
    inset: "shadow-[inset_0_1px_0_0_rgba(248,234,178,0.55)]",
  },
  2: {
    grow: "sm:flex-[335_1_0]",
    order: "max-sm:order-2 sm:order-1",
    blockH: "h-[180px] sm:h-[262px]",
    haloTop: "-top-[7px]",
    avatar:
      "size-24 rounded-[28px] border-gray-11 drop-shadow-[0_18px_25px_rgba(192,194,206,0.35)]",
    avatarText: "text-2xl",
    name: "text-xl",
    points: "text-2xl",
    shine: "via-gray-12",
    prize: "border-gray-6 bg-gray-3 text-gray-12",
    block: {
      backgroundImage:
        "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.45) 100%), linear-gradient(180deg, rgba(192,194,206,0.26) 0%, rgba(24,25,31,0) 38%), linear-gradient(90deg, #18191f 0%, #18191f 100%)",
    },
    inset: "shadow-[inset_0_1px_0_0_rgba(250,250,253,0.55)]",
  },
  3: {
    grow: "sm:flex-[335_1_0]",
    order: "order-3",
    blockH: "h-[170px] sm:h-[228px]",
    haloTop: "-top-[11px]",
    // Laranja do Figma (#e5772e / #ffb17d / #392314 / #6e3f20) fora da escala
    // `laranja-*` do DS — mesmo caso do drawer do token e do tier Platinum.
    avatar:
      "size-24 rounded-[28px] border-[#e5772e] drop-shadow-[0_18px_25px_rgba(229,119,46,0.35)]",
    avatarText: "text-2xl",
    name: "text-xl",
    points: "text-2xl",
    shine: "via-[#ffb17d]",
    prize: "border-[#6e3f20] bg-[#392314] text-[#ffb17d]",
    block: {
      backgroundImage:
        "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.45) 100%), linear-gradient(180deg, rgba(229,119,46,0.26) 0%, rgba(24,25,31,0) 38%), linear-gradient(90deg, #18191f 0%, #18191f 100%)",
    },
    inset: "shadow-[inset_0_1px_0_0_rgba(255,177,125,0.55)]",
  },
};

/** Ícones do Figma: o "Subiu" é o mesmo triângulo, verde e girado 180°. */
export function PositionChange({ change, size = "md" }: { change: number | null; size?: "sm" | "md" }) {
  if (!change) return null;
  const up = change > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-1 font-semibold whitespace-nowrap",
        size === "md" ? "text-base leading-[1.1]" : "text-sm leading-[1.3]",
        up ? "text-green-11" : "text-vermelho-11",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
      <img
        src={up ? "/ranking/subiu.svg" : "/ranking/caiu.svg"}
        alt=""
        width={16}
        height={16}
        className={cn("size-4", up && "rotate-180")}
      />
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {Math.abs(change)}
    </span>
  );
}

/** Avatar de iniciais (o preset guarda foto como data URL — pesado para listas). */
export function InitialsAvatar({
  row,
  className,
  textClassName,
}: {
  row: RankingRow;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br to-[71.4%] font-semibold text-gray-1",
        avatarSkin(row.kol.id),
        className,
      )}
    >
      <span className={textClassName}>{initials(row.kol.name)}</span>
    </span>
  );
}

function PodiumColumn({ place, row }: { place: Place; row: RankingRow | null }) {
  const skin = PLACES[place];
  return (
    <li
      aria-label={row ? `#${place} ${row.kol.name}` : `#${place} open`}
      className={cn(
        "relative flex w-full max-w-[370px] min-w-0 flex-col items-center sm:max-w-none",
        skin.grow,
        skin.order,
      )}
    >
      {/* Pessoa (com halo e, no 1º, sonar e coroa) */}
      <div className="relative flex w-full flex-col items-center gap-5 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- halo SVG do Figma */}
        <img
          src={`/ranking/halo-${place}.svg`}
          alt=""
          width={353.6}
          height={353.6}
          className={cn(
            "pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2 -translate-y-[72.8px]",
            skin.haloTop,
          )}
        />
        {place === 1 && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- sonar SVG do Figma */}
            <img src="/ranking/sonar-200.svg" alt="" width={200} height={200} className="pointer-events-none absolute left-1/2 top-0.5 max-w-none -translate-x-1/2" />
            {/* eslint-disable-next-line @next/next/no-img-element -- sonar SVG do Figma */}
            <img src="/ranking/sonar-160.svg" alt="" width={160} height={160} className="pointer-events-none absolute left-1/2 top-[22px] max-w-none -translate-x-1/2" />
          </>
        )}

        <div className="relative">
          {row ? (
            <InitialsAvatar
              row={row}
              className={cn("border-2", skin.avatar)}
              textClassName={cn("font-display leading-[1.1] tracking-[1px]", skin.avatarText)}
            />
          ) : (
            <span
              aria-hidden
              className={cn(
                "flex items-center justify-center border-2 border-dashed bg-gray-2 font-display text-gray-8",
                skin.avatar,
                skin.avatarText,
              )}
            >
              ?
            </span>
          )}
          {place === 1 && (
            // eslint-disable-next-line @next/next/no-img-element -- coroa SVG do Figma
            <img
              src="/ranking/coroa.svg"
              alt=""
              width={42}
              height={28}
              className="pointer-events-none absolute -top-[30px] left-[37px]"
            />
          )}
          {row?.kol.x && (
            <a
              href={`https://x.com/${row.kol.x}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${row.kol.name} on X`}
              className="absolute -right-2 -bottom-2 flex size-7 items-center justify-center rounded-[14px] border-[3px] border-gray-1 bg-black transition-transform hover:scale-110"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- X do Figma */}
              <img src="/ranking/x-14.svg" alt="" width={14} height={14} />
            </a>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-col items-center gap-3 text-gray-12">
          <p
            className={cn(
              "max-w-full truncate font-display font-semibold leading-[1.1] tracking-[1px]",
              skin.name,
            )}
            title={row?.kol.name}
          >
            {row ? row.kol.name : "Open spot"}
          </p>
          <p className="max-w-full truncate text-base leading-[1.3]">
            {row?.kol.handle ? `@${row.kol.handle}` : " "}
          </p>
        </div>
        {row ? <RankTag relevance={row.kol.relevance} size="lg" /> : <span className="h-[34px]" />}
      </div>

      {/* Tampo: 33px abaixo da pessoa (Figma), largura da coluna. */}
      <div className="relative mt-[33px] h-11 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- tampo SVG do Figma */}
        <img
          src={`/ranking/tampo-${place}.svg`}
          alt=""
          width={place === 1 ? 370 : 335}
          height={44}
          className="absolute inset-0 h-11 w-full"
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-[9%] top-0 h-px bg-gradient-to-r from-transparent to-transparent",
            skin.shine,
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- luz SVG do Figma */}
        <img
          src={`/ranking/luz-${place}.svg`}
          alt=""
          width={place === 1 ? 251.2 : place === 2 ? 229.4 : 231.6}
          height={place === 2 ? 63.8 : 66}
          className={cn(
            "pointer-events-none absolute left-1/2 max-w-none -translate-x-1/2",
            place === 2 ? "-top-[9px]" : "-top-2.5",
          )}
        />
      </div>

      {/* Bloco: máscara SVG do Figma esticada à largura da coluna. */}
      <div
        className={cn("relative flex w-full flex-col items-center overflow-clip pt-6", skin.blockH)}
        style={{
          ...skin.block,
          maskImage: `url("/ranking/bloco-${place}.svg")`,
          WebkitMaskImage: `url("/ranking/bloco-${place}.svg")`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      >
        {row && (
          <div className="relative flex flex-col items-center gap-3">
            <p
              className={cn(
                "font-display font-semibold leading-[1.1] tracking-[1px] whitespace-nowrap text-gray-12 tabular-nums",
                skin.points,
              )}
            >
              {fmtPoints(row.points)}
            </p>
            <p className="text-sm leading-[1.3] text-gray-12">points</p>
            {row.prize != null && (
              <span
                className={cn(
                  "rounded-[32px] border px-4 py-2.5 text-xl font-semibold leading-[1.1] whitespace-nowrap",
                  skin.prize,
                )}
              >
                {fmtPrize(row.prize)}
              </span>
            )}
            <div className="flex items-center gap-4">
              <span className="flex items-baseline gap-1 text-sm whitespace-nowrap">
                <span className="leading-[1.3] text-gray-11">Hit rate</span>
                <span className="font-semibold leading-[1.1] text-gray-12">
                  {row.accuracy}%
                </span>
              </span>
              <PositionChange change={row.change} />
            </div>
          </div>
        )}
        <span aria-hidden className={cn("pointer-events-none absolute inset-0", skin.inset)} />
      </div>
    </li>
  );
}

/** Top 3 em ordem de pódio (2º · 1º · 3º); vaga sem dono vira "Open spot". */
export function Podium({ rows }: { rows: RankingRow[] }) {
  const byPlace = (p: Place) => rows.find((r) => r.position === p) ?? null;
  return (
    <ol
      aria-label="Podium"
      className="relative flex w-full max-w-[1060px] flex-col items-center gap-12 sm:flex-row sm:items-end sm:gap-2.5"
    >
      <PodiumColumn place={2} row={byPlace(2)} />
      <PodiumColumn place={1} row={byPlace(1)} />
      <PodiumColumn place={3} row={byPlace(3)} />
    </ol>
  );
}
