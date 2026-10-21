"use client";

import { CopySmallIcon, DevSnipeIcon } from "@/components/copyTrade/icons";

/**
 * Barra abaixo da topbar (node 1638:33749 — "barra - tipo de copy"): título,
 * abas Wallet Copy / Dev Snipe e a nota do tipo ativo.
 *
 * Dev Snipe ainda não existe: a aba aparece (o produto anuncia o tipo) mas
 * desabilitada, com "Soon" no lugar da contagem. A contagem do Wallet Copy é
 * o nº de copies do usuário — some enquanto for zero (primeiro acesso).
 */
export function CopyTypeBar({ copies = 0 }: { copies?: number }) {
  return (
    <div className="flex w-full items-center justify-between gap-4 border-b border-gray-5 bg-gray-2 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-6">
        <h1 className="hidden font-display text-base leading-[1.1] font-semibold tracking-[1px] whitespace-nowrap text-gray-12 sm:block">
          Copy Trade
        </h1>
        <div role="tablist" aria-label="Copy type" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected
            className="flex h-[52px] items-center gap-2 border-b-2 border-principal-9 px-3 sm:w-40"
          >
            <span className="flex size-7 items-center justify-center rounded-lg border border-principal-6 bg-principal-3 text-principal-11">
              <CopySmallIcon className="size-3.5" />
            </span>
            <span className="text-sm leading-[1.3] font-semibold whitespace-nowrap text-gray-12">Wallet Copy</span>
            {copies > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-principal-3 px-1 py-0.5 text-xs leading-[1.3] font-semibold text-principal-11">
                {copies}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-disabled
            disabled
            title="Coming soon"
            className="flex h-[52px] cursor-not-allowed items-center gap-2 px-3 sm:w-40"
          >
            <span className="flex size-7 items-center justify-center rounded-lg border border-gray-5 bg-gray-3 text-gray-11">
              <DevSnipeIcon className="size-3.5" />
            </span>
            <span className="text-sm leading-[1.3] font-medium whitespace-nowrap text-gray-11">Dev Snipe</span>
            <span className="flex min-w-5 items-center justify-center rounded-full bg-gray-4 px-1 py-0.5 text-xs leading-[1.3] font-semibold text-gray-11">
              Soon
            </span>
          </button>
        </div>
      </div>
      <p className="hidden items-center gap-2 text-xs leading-[1.3] whitespace-nowrap text-gray-11 md:flex">
        <span aria-hidden className="size-2 rounded-full bg-green-9 shadow-[0_0_0_4px_rgba(113,208,131,0.25)]" />
        Copies a wallet&apos;s buys and sells
      </p>
    </div>
  );
}
