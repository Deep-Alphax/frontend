"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { CopySmallIcon, DevSnipeIcon } from "@/components/copyTrade/icons";

export type CopyType = "wallet" | "snipe";

/** Nota à direita da barra, conforme o tipo ativo. */
const NOTE: Record<CopyType, string> = {
  wallet: "Copies a wallet's buys and sells",
  snipe: "Buys the next token a dev launches",
};

/**
 * Barra abaixo da topbar (Figma 1638:33749 — "barra - tipo de copy"; 1638:34036
 * com Dev Snipe ativo): título, abas Wallet Copy / Dev Snipe e a nota do tipo
 * ativo. Contagens: copies ativos e snipes aguardando — somem enquanto zero.
 */
export function CopyTypeBar({
  type = "wallet",
  onChange,
  copies = 0,
  snipes = 0,
}: {
  type?: CopyType;
  onChange?: (t: CopyType) => void;
  copies?: number;
  snipes?: number;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 border-b border-gray-5 bg-gray-2 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-6">
        <h1 className="hidden font-display text-base leading-[1.1] font-semibold tracking-[1px] whitespace-nowrap text-gray-12 sm:block">
          Copy Trade
        </h1>
        <div role="tablist" aria-label="Copy type" className="flex items-center gap-1">
          <Tab active={type === "wallet"} onClick={() => onChange?.("wallet")} icon={<CopySmallIcon className="size-3.5" />} count={copies}>
            Wallet Copy
          </Tab>
          <Tab active={type === "snipe"} onClick={() => onChange?.("snipe")} icon={<DevSnipeIcon className="size-3.5" />} count={snipes}>
            Dev Snipe
          </Tab>
        </div>
      </div>
      <p className="hidden items-center gap-2 text-xs leading-[1.3] whitespace-nowrap text-gray-11 md:flex">
        <span aria-hidden className="size-2 rounded-full bg-green-9 shadow-[0_0_0_4px_rgba(113,208,131,0.25)]" />
        {NOTE[type]}
      </p>
    </div>
  );
}

/** "aba - tipo de copy" (Figma 1630:33363): ativa em principal, inativa em cinza. */
function Tab({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  count: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-[52px] items-center gap-2 border-b-2 px-3 transition-colors sm:w-40",
        active ? "border-principal-9" : "border-transparent hover:bg-gray-3",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border",
          active ? "border-principal-6 bg-principal-3 text-principal-11" : "border-gray-5 bg-gray-3 text-gray-11",
        )}
      >
        {icon}
      </span>
      <span className={cn("text-sm leading-[1.3] whitespace-nowrap", active ? "font-semibold text-gray-12" : "font-medium text-gray-11")}>
        {children}
      </span>
      {count > 0 && (
        <span
          className={cn(
            "flex min-w-5 items-center justify-center rounded-full px-1 py-0.5 text-xs leading-[1.3] font-semibold",
            active ? "bg-principal-3 text-principal-11" : "bg-gray-4 text-gray-11",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
