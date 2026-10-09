"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import toast from "react-hot-toast";

import { ALERT_RULES_KEY, createAlertRule } from "@/lib/api/alerts";
import type { TokenDetail, TokenRef } from "@/lib/api/tracker";
import { toastApiError } from "@/lib/billing/planErrors";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import {
  CHAIN_BADGE,
  age,
  buyUrl,
  compactUsd,
  signedPct,
  tokenLabel,
} from "@/lib/tracker/format";
import { contractLabel, explorerName } from "@/lib/tracker/tokenDetail";
import { useBuyTerminal } from "@/lib/tracker/useBuyTerminal";
import { useTokenDetail } from "@/lib/tracker/useTracker";
import { ChainChip, TokenIcon } from "@/components/tracker/parts";
import {
  CallsSection,
  ChartSection,
  ConfluenceSection,
  DrawerBodySkeleton,
  ExitBanner,
  HoldersSection,
  SemanticTag,
  WalletsSection,
} from "@/components/tracker/TokenDrawerSections";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Drawer do token (Figma "drawer - token" 1408:34790): abre ao clicar num
 * token do Tracker. Cabeçalho, resumo e rodapé fixos; o corpo rola. Estados
 * do Figma: Padrão, Carregando (corpo em skeleton, resumo já com o que o
 * clique sabia), Risco (banner + "Buy anyway") e Rugado (banner tracejado,
 * negociação indisponível).
 *
 * Portal em document.body (como o LinksModal): Esc / clique no scrim fecham,
 * scroll do body travado e foco devolvido a quem abriu.
 */
export function TokenDrawer({
  token,
  onClose,
}: {
  token: TokenRef | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const open = !!token;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {token && (
        <DrawerLayer
          key="token-drawer"
          token={token}
          onClose={onClose}
          reduce={!!reduce}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Camada do drawer. Durante a animação de SAÍDA ela ainda está na tela, mas
 * não pode receber clique: senão o scrim que está sumindo engole o clique no
 * próximo token (e, numa aba em segundo plano, o rAF pausa e a saída nunca
 * termina — o scrim invisível bloquearia a tela inteira).
 */
function DrawerLayer({
  token,
  onClose,
  reduce,
}: {
  token: TokenRef;
  onClose: () => void;
  reduce: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      className={cn("fixed inset-0 z-50", !present && "pointer-events-none")}
      aria-hidden={!present || undefined}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE.standard }}
    >
      {/* bg-modal (Figma): gray-1 a 80% */}
      <button
        type="button"
        aria-label="Close token details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-gray-1/80"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="token-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-gray-6 bg-gray-2 shadow-[-30px_0_80px_0_rgba(0,0,0,0.55)] sm:w-[580px]"
        initial={reduce ? false : { x: "100%" }}
        animate={{ x: 0 }}
        exit={reduce ? { opacity: 0 } : { x: "100%" }}
        transition={{ duration: DURATION.emphasis, ease: EASE.out }}
      >
        {/* key: trocar de token remonta o conteúdo (filtros e rolagem zerados). */}
        <DrawerContent
          key={`${token.chain}:${token.mint}`}
          token={token}
          onClose={onClose}
        />
      </motion.div>
    </motion.div>
  );
}

function DrawerContent({
  token,
  onClose,
}: {
  token: TokenRef;
  onClose: () => void;
}) {
  const q = useTokenDetail(token);
  const detail = q.data ?? null;

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-gray-6 bg-gray-2 px-4 py-3">
        <h2
          id="token-drawer-title"
          className="text-lg font-semibold leading-[1.1] text-gray-12"
        >
          Token details
        </h2>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          aria-label="Close"
          className="flex size-6 items-center justify-center rounded text-gray-12 transition-colors hover:bg-gray-4"
        >
          {/* Huge-icon/interface/outline/remove (path do Figma, cor pelo tema) */}
          <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
            <path
              d="M16.2427 7.75739L7.75739 16.2427M16.2427 16.2426L7.75739 7.75733"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <Summary token={token} detail={detail} />

      <ScrollArea
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName="min-h-0 flex-1"
      >
        {detail ? (
          <div className="flex flex-col">
            <ExitBanner detail={detail} />
            <ConfluenceSection detail={detail} />
            <ChartSection detail={detail} />
            <HoldersSection detail={detail} />
            <WalletsSection detail={detail} />
            <CallsSection detail={detail} />
          </div>
        ) : q.isError ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-sm leading-[1.4] text-gray-11">
              Couldn&apos;t load this token right now.
            </p>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="rounded border border-gray-6 bg-gray-3 px-3 py-2 text-sm text-gray-12 transition-colors hover:border-gray-8 hover:bg-gray-4"
            >
              Try again
            </button>
          </div>
        ) : (
          <DrawerBodySkeleton />
        )}
      </ScrollArea>

      <Footer token={token} detail={detail} />
    </>
  );
}

// ─────────────────────────────── Resumo (fixo) ───────────────────────────────

function Summary({
  token,
  detail,
}: {
  token: TokenRef;
  detail: TokenDetail | null;
}) {
  const t = detail?.token ?? token;
  const rug = detail?.status === "rugged";
  const k = detail?.kpis;
  const change = k?.change24h ?? null;
  return (
    <div className="relative flex shrink-0 flex-col gap-4 overflow-hidden border-b border-gray-6 px-4 py-5">
      {/* Luz de fundo (asset do Figma; cinza quando rugou) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[110px] -top-[90px] h-[200px] w-[456px]"
      >
        {/* O SVG traz a margem do blur (1056×800): a caixa de 456×200 cresce 150%/65.79% para fora. */}
        <div className="absolute inset-[-150%_-65.79%]">
          {/* eslint-disable-next-line @next/next/no-img-element -- decoração SVG do Figma */}
          <img
            src={
              rug ? "/tracker/drawer-glow-rug.svg" : "/tracker/drawer-glow.svg"
            }
            alt=""
            className="block size-full max-w-none"
          />
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <TokenIcon
          chain={t.chain}
          mint={t.mint}
          symbol={t.symbol}
          imageUrl={t.imageUrl}
          size={48}
          muted={rug}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate font-display text-xl font-semibold leading-[1.1] tracking-[1px] text-gray-12">
            {tokenLabel(t)}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ChainChip chain={t.chain} size="md" />
            {detail ? (
              (detail.launchpad || detail.launchedAt) && (
                <span className="text-xs leading-[1.3] text-gray-11">
                  {[
                    detail.launchpad,
                    detail.launchedAt &&
                      `launched ${age(detail.launchedAt)} ago`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )
            ) : (
              <Skeleton className="h-3 w-36" />
            )}
            {rug ? (
              <SemanticTag tone="red">Rugged</SemanticTag>
            ) : (
              detail?.live && <SemanticTag tone="green">Live</SemanticTag>
            )}
          </div>
        </div>
      </div>

      <dl className="relative grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label="Market cap"
          value={
            detail
              ? compactUsd(k!.mcUsd)
              : t.mcUsd != null
                ? compactUsd(t.mcUsd)
                : null
          }
        >
          {change != null && (
            <span
              className={cn(
                "text-xs font-semibold leading-[1.3]",
                change >= 0 ? "text-green-11" : "text-vermelho-11",
              )}
            >
              {signedPct(change)}
            </span>
          )}
        </Kpi>
        <Kpi
          label="Liquidity"
          value={detail ? compactUsd(k!.liquidityUsd) : null}
        />
        <Kpi
          label="Volume 24h"
          value={detail ? compactUsd(k!.volume24hUsd) : null}
        />
        <Kpi
          label="Holders"
          value={
            detail
              ? k!.holders != null
                ? k!.holders.toLocaleString("en-US")
                : "—"
              : null
          }
        />
      </dl>

      <div className="relative flex flex-wrap items-center gap-1.5">
        <LinkChip as="copy" value={t.mint} title="Copy contract address">
          {contractLabel(t.mint)}
        </LinkChip>
        {detail ? (
          <>
            {detail.links.twitter && (
              <LinkChip href={detail.links.twitter}>X</LinkChip>
            )}
            {detail.links.telegram && (
              <LinkChip href={detail.links.telegram}>TG</LinkChip>
            )}
            {detail.links.website && (
              <LinkChip href={detail.links.website}>Site</LinkChip>
            )}
            {detail.links.dexPaid && (
              <LinkChip
                href={detail.links.dexUrl}
                highlight
                title="DexScreener profile is paid"
              >
                DS paid
              </LinkChip>
            )}
            <LinkChip href={detail.links.explorer}>
              {explorerName(t.chain)}
            </LinkChip>
          </>
        ) : (
          <Skeleton className="h-[25px] w-40" />
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  children,
}: {
  label: string;
  value: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-gray-6 bg-gray-1 px-3 py-2">
      <dt className="text-xs leading-[1.3] text-gray-11">{label}</dt>
      {/* O valor nunca trunca ("$3.…"): com variação longa (+2512%) ela desce de linha. */}
      <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap">
        {value == null ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          <span className="font-display text-base font-semibold leading-[1.1] tracking-[1px] text-gray-12">
            {value}
          </span>
        )}
        {children}
      </dd>
    </div>
  );
}

/** Button-tag (17:1579): Neutro 3/6/11 (hover 4/8/12); Destaque = principal. */
function LinkChip({
  href,
  as,
  value,
  highlight = false,
  title,
  children,
}: {
  href?: string | null;
  as?: "copy";
  value?: string;
  highlight?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const cls = cn(
    "inline-flex h-[25px] items-center rounded border px-2 text-sm leading-none transition-colors",
    highlight
      ? "border-principal-6 bg-principal-3 text-principal-11 hover:border-principal-8 hover:bg-principal-4"
      : "border-gray-6 bg-gray-3 text-gray-11 hover:border-gray-8 hover:bg-gray-4 hover:text-gray-12",
  );
  if (as === "copy") {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(value ?? "");
        toast.success("Contract copied");
      } catch {
        toast.error("Couldn't copy the contract");
      }
    };
    return (
      <button type="button" onClick={copy} title={title} className={cls}>
        {children}
      </button>
    );
  }
  if (!href) return <span className={cls}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={cls}
    >
      {children}
    </a>
  );
}

// ─────────────────────────────── Rodapé (fixo) ───────────────────────────────

function Footer({
  token,
  detail,
}: {
  token: TokenRef;
  detail: TokenDetail | null;
}) {
  const [terminal] = useBuyTerminal();
  const qc = useQueryClient();
  const label = tokenLabel(detail?.token ?? token);
  const alert = useMutation({
    // KEYWORD com o contrato: avisa quando qualquer grupo monitorado chamar o token.
    mutationFn: () =>
      createAlertRule({
        kind: "KEYWORD",
        value: token.mint,
        label: `${label} calls`,
      }),
    onSuccess: () => {
      toast.success(
        `Alert on — you'll be notified when a group calls ${label}`,
      );
      void qc.invalidateQueries({ queryKey: ALERT_RULES_KEY });
    },
    onError: (e) => {
      if (e instanceof AxiosError && e.response?.status === 409) {
        toast("You already have an alert for this token");
        return;
      }
      toastApiError(e, "Couldn't create the alert");
    },
  });
  const status = detail?.status ?? "normal";
  const badge = CHAIN_BADGE[token.chain];

  return (
    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-6 bg-gray-2 p-5">
      <button
        type="button"
        onClick={() => alert.mutate()}
        disabled={alert.isPending}
        aria-label={`Alert me when a group calls ${label}`}
        title="Alert me when a group calls this token"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-gray-7 bg-gray-3 text-gray-11 transition-colors hover:border-gray-8 hover:bg-gray-4 hover:text-gray-12 disabled:opacity-60"
      >
        {/* Ícone de sino do Figma (path exato, cor pelo tema) */}
        <svg viewBox="0 0 20 20" fill="none" className="size-5" aria-hidden>
          <path
            d="M8.33333 16.6667C8.33333 17.1087 8.50893 17.5326 8.82149 17.8452C9.13405 18.1577 9.55797 18.3333 10 18.3333C10.442 18.3333 10.866 18.1577 11.1785 17.8452C11.4911 17.5326 11.6667 17.1087 11.6667 16.6667M5 13.3333V9.16667C5 7.84058 5.52678 6.56881 6.46447 5.63113C7.40215 4.69345 8.67392 4.16667 10 4.16667C11.3261 4.16667 12.5979 4.69345 13.5355 5.63113C14.4732 6.56881 15 7.84058 15 9.16667V13.3333L16.25 15H3.75L5 13.3333Z"
            stroke="currentColor"
            strokeWidth={1.35}
            strokeLinecap="round"
          />
        </svg>
      </button>

      {status === "rugged" ? (
        <span
          aria-disabled="true"
          className="flex h-11 items-center justify-center rounded-lg border border-gray-5 bg-gray-2 px-6 text-base font-semibold leading-[1.1] text-gray-9"
        >
          Trading unavailable
        </span>
      ) : (
        <a
          href={buyUrl(token.chain, token.mint, terminal)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-principal-9 px-6 text-base font-semibold leading-[1.1] text-gray-1 transition-colors hover:bg-principal-10"
        >
          {badge && (
            <span className="relative size-5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- selo SVG do Figma */}
              <img
                src={badge}
                alt=""
                className="absolute inset-0 block size-full max-w-none"
              />
            </span>
          )}
          {status === "risk" ? "Buy anyway" : "Buy"}
        </a>
      )}
    </footer>
  );
}
