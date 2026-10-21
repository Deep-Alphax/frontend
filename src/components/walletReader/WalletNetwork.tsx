"use client";

import { cn } from "@/lib/cn";
import {
  WALLET_CHAIN_LABEL,
  WALLET_CHAIN_SHORT,
  chainCounts,
  chainsForAddress,
  type WalletChain,
  type WalletChainFilter,
} from "@/lib/walletReader/chains";
import type { WalletRef } from "@/lib/walletReader/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

/*
 * Selo da rede ("badge - rede", Figma 1371:32284): círculo na cor da rede com
 * borda gray-1 e o ícone no meio. Dois tamanhos usados aqui: 16 (botões do
 * filtro, ícone 12) e 24 (linha da carteira, ícone 15).
 */
const BADGE_BG: Record<WalletChain, string> = {
  SOLANA: "bg-gray-1",
  ETHEREUM: "bg-[#627eea]",
  BASE: "bg-[#0052ff]",
  BSC: "bg-gray-1",
  ROBINHOOD: "bg-[#00c805]",
};

const ICON_FILE: Record<WalletChain, string> = {
  SOLANA: "solana",
  ETHEREUM: "ethereum",
  BASE: "base",
  BSC: "bsc",
  ROBINHOOD: "robinhood",
};

export function NetworkBadge({
  chain,
  size = 24,
  decorative = false,
}: {
  chain: WalletChain | null;
  size?: 16 | 24;
  /** Ao lado de um texto que já diz a rede (filtro, seletor): sem nome acessível. */
  decorative?: boolean;
}) {
  const a11y = decorative ? { "aria-hidden": true } : { role: "img" };
  const box = size === 24 ? "size-6 border-2" : "size-4 border-[1.5px]";
  if (!chain) {
    // Carteira EVM antiga sem rede: selo vazio, tracejado — a edição define.
    return (
      <span
        title="Wallet without a network — edit the KOL to set it"
        {...a11y}
        aria-label={decorative ? undefined : "No network"}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-dashed border-gray-8 text-[11px] font-semibold text-gray-11",
          box,
        )}
      >
        ?
      </span>
    );
  }
  const icon = size === 24 ? 15 : 12;
  return (
    <span
      {...a11y}
      aria-label={decorative ? undefined : WALLET_CHAIN_LABEL[chain]}
      className={cn("flex shrink-0 items-center justify-center rounded-xl border-gray-1", box, BADGE_BG[chain])}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
      <img src={`/wallet-reader/networks/${ICON_FILE[chain]}-${icon}.svg`} alt="" width={icon} height={icon} />
    </span>
  );
}

/**
 * Seletor da rede. As opções seguem o formato do endereço digitado: base58 só
 * oferece Solana; 0x oferece as EVM. Sem endereço, todas.
 */
export function NetworkSelect({
  value,
  onChange,
  address,
  size = "default",
  label = "Wallet network",
  className,
}: {
  value: WalletChain | null;
  onChange: (chain: WalletChain) => void;
  address: string;
  size?: "sm" | "default";
  label?: string;
  className?: string;
}) {
  const options = chainsForAddress(address);
  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v as WalletChain)}>
      <SelectTrigger size={size} aria-label={label} className={cn("w-[170px] shrink-0", className)}>
        <SelectValue placeholder="Network" />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c} value={c}>
            <span className="flex items-center gap-2">
              <NetworkBadge chain={c} size={16} decorative />
              {WALLET_CHAIN_LABEL[c]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * "Filtro de redes" (Figma 1488:47853): botões no padrão Button-tag — neutro
 * gray 3/6/11 (hover 4/8/12) e selecionado em destaque principal 5/8/12. Só
 * aparecem as redes que o KOL tem.
 */
export function NetworkFilter({
  wallets,
  value,
  onChange,
}: {
  wallets: WalletRef[];
  value: WalletChainFilter;
  onChange: (f: WalletChainFilter) => void;
}) {
  const counts = chainCounts(wallets);
  const tag = (id: WalletChainFilter, label: string, count: number, chain?: WalletChain | null) => {
    const on = value === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={on}
        onClick={() => onChange(id)}
        className={cn(
          "flex h-8 items-center justify-center gap-1.5 rounded border p-2 text-sm leading-[1.3] whitespace-nowrap transition-colors",
          on
            ? "border-principal-8 bg-principal-5 text-gray-12"
            : "border-gray-6 bg-gray-3 text-gray-11 hover:border-gray-8 hover:bg-gray-4 hover:text-gray-12",
        )}
      >
        {chain !== undefined && <NetworkBadge chain={chain} size={16} decorative />}
        {label}
        <span className={cn("tabular-nums", on ? "opacity-70" : "text-gray-10")}>{count}</span>
      </button>
    );
  };
  return (
    <div role="group" aria-label="Filter wallets by network" className="flex flex-wrap gap-1.5">
      {tag("all", "All", wallets.length)}
      {counts.map(({ id, count }) =>
        id === "unknown" ? tag("unknown", "No network", count, null) : tag(id, WALLET_CHAIN_SHORT[id], count, id),
      )}
    </div>
  );
}
