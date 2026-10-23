import type { DepositView } from "@/lib/api/deposits";
import type { BackendChain } from "@/lib/api/wallets";
import { cn } from "@/lib/cn";
import { CHAIN_LABEL, statusLabel, type StatusTone } from "@/lib/deposits/format";
import { NetworkBadge } from "@/components/walletReader/WalletNetwork";

/*
 * Peças visuais pequenas do depósito via Pix (selo da rede, chip de status).
 */

/**
 * Redes sem ícone no Figma (só Solana/Ethereum/Base/BNB têm SVG em
 * `public/wallet-reader/networks`): círculo na cor da marca com a sigla.
 */
const FALLBACK: Partial<Record<BackendChain, { bg: string; text: string }>> = {
  ARBITRUM: { bg: "bg-[#213147]", text: "A" },
  OPTIMISM: { bg: "bg-[#ff0420]", text: "OP" },
  POLYGON: { bg: "bg-[#8247e5]", text: "P" },
};

/** Selo da rede — reusa o `NetworkBadge` do Wallet Reader quando há ícone. */
export function ChainBadge({
  chain,
  size = 24,
  decorative = true,
}: {
  chain: BackendChain;
  size?: 16 | 24;
  decorative?: boolean;
}) {
  const fallback = FALLBACK[chain];
  if (!fallback) {
    return (
      <NetworkBadge
        chain={chain as "SOLANA" | "ETHEREUM" | "BASE" | "BSC"}
        size={size}
        decorative={decorative}
      />
    );
  }
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": CHAIN_LABEL[chain] })}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-gray-1 font-bold leading-none text-white",
        size === 24 ? "size-6 border-2 text-[9px]" : "size-4 border-[1.5px] text-[6px]",
        fallback.bg,
      )}
    >
      {fallback.text}
    </span>
  );
}

const TONE: Record<StatusTone, string> = {
  waiting: "border-principal-8 bg-principal-3 text-principal-11",
  progress: "border-secundaria-9/50 bg-secundaria-9/10 text-secundaria-11",
  success: "border-green-9/50 bg-green-9/10 text-green-11",
  danger: "border-danger-10/50 bg-danger-10/10 text-danger-11",
  muted: "border-gray-6 bg-gray-3 text-gray-11",
};

/** Chip de status (lista de depósitos recentes). */
export function StatusChip({ deposit }: { deposit: Pick<DepositView, "status" | "chain"> }) {
  const { label, tone } = statusLabel(deposit);
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-xs font-medium leading-none",
        TONE[tone],
      )}
    >
      {label}
    </span>
  );
}

/** "SOL on Solana" com o selo da rede. */
export function AssetLabel({
  chain,
  symbol,
  size = 16,
  className,
}: {
  chain: BackendChain;
  symbol: string;
  size?: 16 | 24;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ChainBadge chain={chain} size={size} />
      <span className="truncate">
        <span className="font-medium text-gray-12">{symbol}</span>
        <span className="text-gray-11"> on {CHAIN_LABEL[chain]}</span>
      </span>
    </span>
  );
}
