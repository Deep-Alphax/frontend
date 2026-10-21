"use client";

import type { CSSProperties, ReactNode } from "react";

import type { CopyKol } from "@/lib/api/copyTrade";
import { cn } from "@/lib/cn";
import { memeAvatarFor, type TierSpec } from "@/lib/walletReader/types";

/*
 * Peças do Copy Trade (Figma 1578:26210). O skin de cada KOL vem do NÍVEL
 * (`tierFor(relevance)`), como no Card-kols: aqui só o que o Card-kols não
 * tinha — a tag de rank "suave" (tag - rank · pequena, node 1591:30435) e a
 * família de cor que pinta o brilho da 3ª coluna.
 */

/** Família de cor do nível (tokens `--color-<família>-N`). */
const TIER_FAMILY: Record<string, string> = {
  wood: "gray",
  silver: "gray",
  gold: "principal",
  platinum: "menta",
  diamond: "secundaria",
  alpha: "violeta",
  "super-alpha": "vermelho",
};

/**
 * Variáveis CSS do nível para os brilhos em degradê (linha do topo, fundo do
 * perfil, halo do avatar) — `color-mix` precisa da cor em runtime, e classe
 * dinâmica o Tailwind v4 não emite.
 */
export function tierVars(tier: TierSpec): CSSProperties {
  const f = TIER_FAMILY[tier.id] ?? "gray";
  return {
    "--tier-9": `var(--color-${f}-9)`,
    "--tier-11": `var(--color-${f}-11)`,
  } as CSSProperties;
}

/**
 * Tag de rank suave: degradê 7 → 3, borda 9, texto 12 (Figma Rank=…, nodes
 * 1591:30420-30432). Classes LITERAIS por nível — o Tailwind só emite o estático.
 */
const SOFT_PILL: Record<string, { pill: string; text: string }> = {
  wood: { pill: "border-gray-9 from-gray-7 to-gray-3", text: "text-gray-12" },
  silver: { pill: "border-gray-9 from-gray-7 to-gray-3", text: "text-gray-12" },
  gold: { pill: "border-principal-9 from-principal-7 to-principal-3", text: "text-principal-12" },
  platinum: { pill: "border-menta-9 from-menta-7 to-menta-3", text: "text-menta-12" },
  diamond: { pill: "border-secundaria-9 from-secundaria-7 to-secundaria-2", text: "text-secundaria-12" },
  alpha: { pill: "border-violeta-9 from-violeta-7 to-violeta-3", text: "text-violeta-12" },
  "super-alpha": { pill: "border-vermelho-9 from-vermelho-7 to-vermelho-3", text: "text-vermelho-12" },
};

/**
 * Tag de rank. `strong` = a do rodapé do card grande (mesma pílula do
 * Card-kols, `tier.pill`); `soft` = trilhas e 3ª coluna.
 */
export function RankTag({
  tier,
  variant = "soft",
  size = "sm",
  className,
}: {
  tier: TierSpec;
  variant?: "soft" | "strong";
  size?: "sm" | "md";
  className?: string;
}) {
  const soft = SOFT_PILL[tier.id] ?? SOFT_PILL.wood;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[32px] border bg-linear-to-r",
        size === "sm" ? "gap-1 py-[3px] pr-2 pl-1.5" : "gap-1.5 px-2 py-1",
        variant === "strong" ? cn(tier.pill, "py-1") : soft.pill,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tier.emblem}
        alt=""
        width={size === "sm" ? 14 : 16}
        height={size === "sm" ? 14 : 16}
        className={cn("shrink-0 object-cover", size === "sm" ? "size-3.5" : "size-4")}
      />
      <span
        className={cn(
          "text-xs leading-[1.3] font-medium whitespace-nowrap",
          variant === "strong" ? tier.pillText : soft.text,
        )}
      >
        {tier.label}
      </span>
    </span>
  );
}

/** Avatar do KOL com o anel do nível ("avatar - kol", node 1570:21924). */
export function KolAvatar({
  kol,
  tier,
  className,
  ring = "border-2",
}: {
  kol: Pick<CopyKol, "id" | "avatarUrl">;
  tier: TierSpec;
  className?: string;
  ring?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={kol.avatarUrl ?? memeAvatarFor(kol.id)}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 rounded-full object-cover", ring, tier.ring, className)}
    />
  );
}

/** Divisor vertical de 10 px entre metadados ("divisor"). */
export function Dot() {
  return <span aria-hidden className="h-2.5 w-px shrink-0 bg-gray-6" />;
}

/** Título de seção: ícone, título 14, apoio 12 e "See all" opcional (node 1601:26221). */
export function SectionTitle({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-6 w-full items-center gap-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded border border-gray-6 bg-gray-3 text-gray-11">
        {icon}
      </span>
      <h3 className="shrink-0 text-sm leading-[1.3] font-semibold text-gray-12">{title}</h3>
      <Dot />
      <p className="min-w-0 flex-1 truncate text-xs leading-[1.3] text-gray-11">{hint}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 text-xs leading-[1.3] font-medium text-gray-11 transition-colors hover:text-gray-12"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}

/**
 * Button-tag (node 17:1579). Selecionado no Copy Trade = Destaque (principal
 * 3/6/11, como a instância "Para você" do Figma); neutro 3/6/11, hover 4/8/12.
 */
export function TagButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded border px-3 py-2 text-xs leading-[1.3] font-medium whitespace-nowrap transition-colors",
        selected
          ? "border-principal-6 bg-principal-3 text-principal-11"
          : "border-gray-6 bg-gray-3 text-gray-11 hover:border-gray-8 hover:bg-gray-4 hover:text-gray-12",
      )}
    >
      {children}
    </button>
  );
}
