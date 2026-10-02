"use client";

import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";

import type { TrackerChain } from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { CHAIN_BADGE, CHAIN_LABEL, buyUrl } from "@/lib/tracker/format";
import { useBuyTerminal } from "@/lib/tracker/useBuyTerminal";
import { hashStr, tierFor } from "@/lib/walletReader/types";

/*
 * Peças do Tracker (Figma 1311:47443). Classes LITERAIS (o Tailwind v4 só
 * emite o que é estático) e tokens do DS — nada de hex solto, exceto os
 * poucos que o próprio Figma deixou fora da escala (chip de rede, contador).
 */

// ─────────────────────────────── Painel ───────────────────────────────

/** Moldura dos painéis: borda gray-6, raio 8, título 44px em gray-2. */
export function Panel({
  title,
  right,
  className,
  children,
}: {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-1",
        className,
      )}
    >
      <header className="flex min-h-11 shrink-0 items-center gap-2 border-b border-gray-6 bg-gray-2 px-3 py-1.5">
        <h2 className="flex-1 truncate text-base font-semibold leading-[1.3] text-gray-12">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

/** Segmentado (filter-date-finance): "7D | 15D", "Activity | Multi Buys | Net Flows". */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex h-8 shrink-0 items-center rounded-lg border border-gray-6 bg-gray-1 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-full items-center rounded-md px-2 text-xs font-medium leading-[1.3] transition-colors",
              active ? "bg-gray-4 text-gray-12" : "text-gray-11 hover:text-gray-12",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────── Rank ───────────────────────────────

/**
 * Status-tag · Categoria=Rank (Figma 655:19174): pílula 30px com emblema.
 * Cores "fundo 7→3, borda 9, texto 12" da escala de cada nível.
 */
const RANK_SKIN: Record<string, string> = {
  wood: "border-gray-7 from-gray-4 to-gray-2 text-gray-11",
  silver: "border-gray-9 from-gray-7 to-gray-3 text-gray-12",
  platinum: "border-menta-9 from-menta-7 to-menta-3 text-menta-12",
  diamond: "border-secundaria-9 from-secundaria-7 to-secundaria-3 text-secundaria-12",
  alpha: "border-violeta-9 from-violeta-7 to-violeta-3 text-violeta-12",
  gold: "border-principal-9 from-principal-7 to-principal-3 text-principal-12",
  "super-alpha": "border-vermelho-9 from-vermelho-7 to-vermelho-3 text-vermelho-12",
};

export function RankTag({ relevance }: { relevance: number }) {
  const tier = tierFor(relevance);
  return (
    <span
      className={cn(
        "inline-flex h-[30px] shrink-0 items-center gap-2 rounded-full border bg-gradient-to-r px-2 text-sm font-medium leading-[1.3]",
        RANK_SKIN[tier.id] ?? RANK_SKIN.wood,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- emblema estático pequeno */}
      <img src={tier.emblem} alt="" className="size-5 object-contain" />
      {tier.label}
    </span>
  );
}

// ─────────────────────────────── Token ───────────────────────────────

/** Cores dos ícones de letra (token sem imagem) — determinísticas pelo mint. */
const TOKEN_SKINS = [
  "bg-violeta-11 text-gray-1",
  "bg-green-11 text-gray-1",
  "bg-menta-11 text-gray-1",
  "bg-secundaria-11 text-gray-1",
  "bg-principal-11 text-gray-1",
  "bg-laranja-11 text-gray-1",
  "bg-vermelho-11 text-gray-1",
];

/** Só exibimos imagem de token destes CDNs (os mesmos liberados na CSP). */
const IMAGE_HOSTS =
  /^https:\/\/((dd|cdn)\.dexscreener\.com|cdn\.helius-rpc\.com|logo\.moralis\.io)\//;

/**
 * Ícone do token: imagem do DexScreener ou letra colorida, com o selo da rede
 * no canto (badge - rede 1371:32284). Tamanhos do Figma: 24 (card), 20
 * (Discovery), 18 (linha compacta).
 */
export function TokenIcon({
  chain,
  mint,
  symbol,
  imageUrl,
  size = 24,
  badge = true,
}: {
  chain: TrackerChain;
  mint: string;
  symbol: string | null;
  imageUrl?: string | null;
  size?: 18 | 20 | 24;
  badge?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const letter = (symbol ?? "?").replace(/^\$/, "").charAt(0).toUpperCase() || "?";
  const skin = TOKEN_SKINS[hashStr(mint) % TOKEN_SKINS.length];
  const img = imageUrl && IMAGE_HOSTS.test(imageUrl) && !broken ? imageUrl : null;
  const badgeSrc = CHAIN_BADGE[chain];
  const dims = size === 24 ? "size-6" : size === 20 ? "size-5" : "size-[18px]";
  const text = size === 24 ? "text-[13.333px]" : size === 20 ? "text-[11px]" : "text-[10px]";
  // Selo de 12px ancorado no canto inferior direito (24 → 16/16; 18 → 10/10).
  const badgePos = size === 24 ? "left-4 top-4" : size === 20 ? "left-[11px] top-[11px]" : "left-2.5 top-2.5";

  return (
    <span className={cn("relative inline-flex shrink-0", dims)}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN externo, tamanho fixo pequeno
        <img
          src={img}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className={cn("rounded-full object-cover", dims)}
        />
      ) : (
        <span
          className={cn(
            "flex items-center justify-center rounded-full font-bold leading-none",
            dims,
            text,
            skin,
          )}
        >
          {letter}
        </span>
      )}
      {badge && badgeSrc && (
        <span className={cn("absolute size-3", badgePos)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- selo SVG do Figma */}
          <img src={badgeSrc} alt="" className="absolute -inset-[12.5%] block size-[150%] max-w-none" />
        </span>
      )}
    </span>
  );
}

/** chip - rede (1371:32311): selo + sigla. */
export function ChainChip({ chain }: { chain: TrackerChain }) {
  const badgeSrc = CHAIN_BADGE[chain];
  return (
    <span className="inline-flex shrink-0 items-center gap-[5px] rounded-md border border-[#3d3f4a] bg-[#26272f] py-[3px] pl-[5px] pr-[7px]">
      {badgeSrc && (
        <span className="relative size-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- selo SVG do Figma */}
          <img src={badgeSrc} alt="" className="absolute -inset-[12.5%] block size-[150%] max-w-none" />
        </span>
      )}
      <span className="text-[11px] font-semibold text-gray-11">{CHAIN_LABEL[chain]}</span>
    </span>
  );
}

// ─────────────────────────────── Ações ───────────────────────────────

/** Copia o contrato do token (com toast). `boxed` = quadrado com borda (card). */
export function CopyButton({
  value,
  boxed = true,
  size = 24,
}: {
  value: string;
  boxed?: boolean;
  size?: 20 | 22 | 24;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Contract copied");
    } catch {
      toast.error("Couldn't copy the contract");
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy contract address"
      title="Copy contract address"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded transition-colors hover:border-gray-8",
        boxed && "border border-gray-6",
        boxed && size === 24 && "bg-gray-1",
        size === 24 ? "size-6" : size === 22 ? "size-[22px]" : "size-5",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
      <img src={size === 20 ? "/tracker/copy-20.svg" : "/tracker/copy-16.svg"} alt="" className={size === 20 ? "size-5" : "size-4"} />
    </button>
  );
}

/**
 * buy-button: abre o token no terminal externo (Axiom no Solana; GMGN no EVM)
 * em nova aba — zero custódia, nenhuma chave passa pelo app.
 */
export function BuyButton({
  chain,
  mint,
  small = false,
}: {
  chain: TrackerChain;
  mint: string;
  small?: boolean;
}) {
  const [terminal] = useBuyTerminal();
  return (
    <a
      href={buyUrl(chain, mint, terminal)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg bg-principal-11 font-semibold leading-[1.1] text-gray-1 transition-colors hover:bg-principal-10",
        small ? "h-7 p-2 text-xs" : "h-8 px-3 py-2 text-sm",
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-gray-1">
        <span className="relative size-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- marca SVG do Figma */}
          <img src="/tracker/buy-mark.svg" alt="" className="absolute left-[3.09px] top-0 h-4 w-[9.824px]" />
        </span>
      </span>
      Buy
    </a>
  );
}

/** Selo "Live" (verde, ponto 6px). */
export function LiveChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-green-6 bg-green-3 p-1.5 text-xs leading-[1.3] text-green-11">
      {/* eslint-disable-next-line @next/next/no-img-element -- ponto SVG do Figma */}
      <img src="/tracker/live-dot.svg" alt="" className="size-1.5" />
      Live
    </span>
  );
}

/** Pílula cinza de dado ("MC $1.34M", "4 min"). */
export function DataChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-gray-6 bg-gray-4 p-1.5 text-xs leading-[1.3] text-gray-11">
      {children}
    </span>
  );
}

/** Mensagem de painel vazio. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm leading-[1.4] text-gray-11">{children}</p>;
}
