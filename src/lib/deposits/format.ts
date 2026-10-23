import bs58 from "bs58";
import { isAddress } from "viem";

import type { DepositAsset, DepositOptions, DepositStatus, DepositView } from "@/lib/api/deposits";
import type { BackendChain } from "@/lib/api/wallets";
import { formatBrl } from "@/lib/pix/format";

/*
 * Helpers puros do depósito via Pix (validação, valores, rótulos e a linha do
 * tempo do status). Sem React — testados em `format.test.ts`.
 */

export const CHAIN_LABEL: Record<BackendChain, string> = {
  SOLANA: "Solana",
  ETHEREUM: "Ethereum",
  BASE: "Base",
  ARBITRUM: "Arbitrum",
  OPTIMISM: "Optimism",
  POLYGON: "Polygon",
  BSC: "BNB Chain",
};

/** Tudo que não é Solana é EVM (mesmo formato de endereço em toda rede EVM). */
export function isEvm(chain: BackendChain): boolean {
  return chain !== "SOLANA";
}

/**
 * Destino fora da Solana passa por ponte (deBridge): a linha do tempo ganha a
 * etapa "Bridging", e há `orderUrl` para acompanhar.
 */
export function isCrossChain(chain: BackendChain): boolean {
  return chain !== "SOLANA";
}

// ---------------------------------------------------------------------------
// Endereço de destino
// ---------------------------------------------------------------------------

const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;

/**
 * Erro do endereço de destino para a rede escolhida (null = válido).
 *
 * Mais estrito que o cadastro de carteira de propósito: o envio on-chain é
 * irreversível. Por isso NÃO extrai endereço de URL colada (o usuário precisa
 * ver exatamente o que vai receber), a Solana decodifica para conferir os 32
 * bytes e, na EVM, endereço com maiúsculas/minúsculas misturadas precisa bater
 * o checksum EIP-55 (pega erro de digitação). O backend valida de novo.
 */
export function addressError(chain: BackendChain, raw: string): string | null {
  const a = raw.trim();
  if (!a) return "Enter the destination address.";
  if (isEvm(chain)) {
    if (EVM_ADDR.test(a)) {
      return isAddress(a, { strict: true }) ? null : "Checksum mismatch — check the address.";
    }
    if (SOLANA_ADDR.test(a)) return `This is a Solana address — ${CHAIN_LABEL[chain]} needs a 0x address.`;
    return `Not a valid ${CHAIN_LABEL[chain]} address (0x + 40 hex characters).`;
  }
  if (EVM_ADDR.test(a)) return "This is an EVM (0x) address — Solana needs a base58 address.";
  if (!SOLANA_ADDR.test(a)) return "Not a valid Solana address.";
  try {
    if (bs58.decode(a).length !== 32) return "Not a valid Solana address.";
  } catch {
    return "Not a valid Solana address.";
  }
  return null;
}

/** 7xKXtg…AJ9M — encurta para linhas e chips. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}

// ---------------------------------------------------------------------------
// Valor em reais
// ---------------------------------------------------------------------------

/**
 * Texto digitado → centavos (null = não é um valor). Aceita o jeito brasileiro
 * ("1.000,50", "R$ 600") e o com ponto decimal ("1000.50"). Ponto seguido de
 * grupos de 3 dígitos é milhar ("2.500" = 2500); vírgula é sempre decimal.
 */
export function parseBrlInput(text: string): number | null {
  let s = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

const BRL_INPUT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 100000 → "1.000" (o que o atalho escreve no campo). */
export function formatBrlInput(cents: number): string {
  return BRL_INPUT.format(cents / 100);
}

/** Valor redondo sem centavos ("R$ 1.000"); com centavos, o formato completo. */
export function formatBrlShort(cents: number): string {
  return cents % 100 === 0 ? formatBrl(cents).replace(/,00$/, "") : formatBrl(cents);
}

/** Teto efetivo: o menor entre o limite por depósito e o que resta hoje. */
export function maxDepositBrlCents(o: Pick<DepositOptions, "maxBrlCents" | "dailyLeftBrlCents">): number {
  return Math.max(0, Math.min(o.maxBrlCents, o.dailyLeftBrlCents));
}

/** Mínimo exibido arredondado PARA CIMA ao real (R$ 518,37 → "R$ 519"). */
export function displayMinBrlCents(minBrlCents: number): number {
  return Math.ceil(minBrlCents / 100) * 100;
}

const PRESETS_BRL_CENTS = [60_000, 100_000, 250_000];

/** Atalhos de valor que cabem entre o mínimo e o teto de hoje. */
export function amountPresets(minBrlCents: number | null, maxBrlCents: number): number[] {
  return PRESETS_BRL_CENTS.filter((c) => c >= (minBrlCents ?? 0) && c <= maxBrlCents);
}

/** Erro do valor (null = ok). `null` em `cents` = texto que não é número. */
export function amountError(
  cents: number | null,
  minBrlCents: number | null,
  maxBrlCents: number,
  limitedByDaily: boolean,
): string | null {
  if (cents === null) return "Enter an amount in BRL.";
  if (minBrlCents !== null && cents < minBrlCents) {
    return `Minimum is ${formatBrlShort(displayMinBrlCents(minBrlCents))}.`;
  }
  if (cents > maxBrlCents) {
    return `Maximum is ${formatBrlShort(maxBrlCents)}${limitedByDaily ? " today" : ""}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Moedas e cotação
// ---------------------------------------------------------------------------

/** Chave do item no seletor ("SOLANA:USDC") — rede + símbolo identificam a moeda. */
export function assetKey(a: Pick<DepositAsset, "chain" | "symbol">): string {
  return `${a.chain}:${a.symbol}`;
}

/** Moedas agrupadas por rede, na ordem em que o servidor mandou. */
export function groupAssets(assets: DepositAsset[]): { chain: BackendChain; assets: DepositAsset[] }[] {
  const groups = new Map<BackendChain, DepositAsset[]>();
  for (const a of assets) {
    const list = groups.get(a.chain);
    if (list) list.push(a);
    else groups.set(a.chain, [a]);
  }
  return [...groups].map(([chain, list]) => ({ chain, assets: list }));
}

/** Moeda inicial de uma rede: a nativa, senão a primeira. */
export function defaultAssetFor(assets: DepositAsset[], chain?: BackendChain): DepositAsset | undefined {
  const pool = chain ? assets.filter((a) => a.chain === chain) : assets;
  return pool.find((a) => a.native) ?? pool[0] ?? (chain ? defaultAssetFor(assets) : undefined);
}

const STABLE = new Set(["USDC", "USDT"]);

/** "0.421337" + SOL → "0.4213 SOL"; stablecoin com 2 casas ("100.00 USDC"). */
export function formatTokenAmount(amount: string, symbol: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${symbol}`;
  const opts: Intl.NumberFormatOptions = STABLE.has(symbol)
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : n >= 1
      ? { maximumFractionDigits: 4 }
      : { maximumSignificantDigits: 4 };
  return `${new Intl.NumberFormat("en-US", opts).format(n)} ${symbol}`;
}

/** Segundos → "≈ 3 min" / "under a minute". */
export function formatEta(seconds: number): string {
  if (seconds < 60) return "under a minute";
  return `≈ ${Math.round(seconds / 60)} min`;
}

/** 150 bps → "1.5%". */
export function formatFee(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/** Milissegundos restantes → "14:05" (nunca negativo). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Só segue link http(s) vindo do servidor — nunca `javascript:` ou afins. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Etapas do pagamento em que o modal mostra a linha do tempo (Pix já caiu). */
export function isAfterPayment(status: DepositStatus): boolean {
  return status === "PAID" || status === "SENDING" || status === "SENT" || status === "DELIVERED" || status === "FAILED";
}

export function isTerminal(status: DepositStatus): boolean {
  return status === "DELIVERED" || status === "FAILED" || status === "EXPIRED";
}

/** Ritmo da consulta: rápido esperando o Pix, mais lento entregando, parado no fim. */
export function pollInterval(status: DepositStatus | undefined): number | false {
  if (!status) return false;
  if (status === "PENDING") return 3_000;
  return isTerminal(status) ? false : 5_000;
}

export type StatusTone = "waiting" | "progress" | "success" | "danger" | "muted";

/** Rótulo curto do status (chip da lista de depósitos). */
export function statusLabel(d: Pick<DepositView, "status" | "chain">): { label: string; tone: StatusTone } {
  switch (d.status) {
    case "PENDING":
      return { label: "Awaiting Pix", tone: "waiting" };
    case "PAID":
      return { label: "Pix received", tone: "progress" };
    case "SENDING":
      return { label: "Sending", tone: "progress" };
    case "SENT":
      return { label: isCrossChain(d.chain) ? "Bridging" : "Sending", tone: "progress" };
    case "DELIVERED":
      return { label: "Delivered", tone: "success" };
    case "FAILED":
      return { label: "Failed", tone: "danger" };
    case "EXPIRED":
      return { label: "Expired", tone: "muted" };
  }
}

export type StepState = "done" | "current" | "upcoming" | "failed";

export interface TimelineStep {
  id: "received" | "sending" | "bridging" | "delivered";
  label: string;
  state: StepState;
  /** Link de acompanhamento da etapa (já filtrado por `safeExternalUrl`). */
  link?: { href: string; label: string };
}

/**
 * Status → linha do tempo: Pix received → Sending → (só cross-chain) Bridging
 * to <rede> → Delivered. Em FAILED, a etapa que falhou é deduzida do que já
 * existe: ordem cross-chain criada → falhou na ponte; Pix caiu → falhou no
 * envio; senão, no recebimento.
 */
export function timelineSteps(
  d: Pick<DepositView, "status" | "chain" | "symbol" | "paidAt" | "txUrl" | "orderUrl" | "deliveredAmount">,
): TimelineStep[] {
  const cross = isCrossChain(d.chain);
  const tx = safeExternalUrl(d.txUrl);
  const order = safeExternalUrl(d.orderUrl);

  const steps: Omit<TimelineStep, "state">[] = [
    { id: "received", label: "Pix received" },
    {
      id: "sending",
      label: cross ? "Sending" : `Sending ${d.symbol}`,
      ...(tx ? { link: { href: tx, label: "View transaction" } } : {}),
    },
  ];
  if (cross) {
    steps.push({
      id: "bridging",
      label: `Bridging to ${CHAIN_LABEL[d.chain]}`,
      ...(order ? { link: { href: order, label: "Track transfer" } } : {}),
    });
  }
  steps.push({
    id: "delivered",
    label: d.deliveredAmount ? `Delivered · ${formatTokenAmount(d.deliveredAmount, d.symbol)}` : "Delivered",
  });

  // Índice da etapa em andamento (todas antes dela estão feitas).
  const last = steps.length - 1;
  let current: number;
  switch (d.status) {
    case "PENDING":
    case "EXPIRED":
      current = 0;
      break;
    case "PAID":
    case "SENDING":
      current = 1;
      break;
    case "SENT":
      current = cross ? 2 : last;
      break;
    case "DELIVERED":
      current = steps.length;
      break;
    case "FAILED":
      current = cross && order ? 2 : d.paidAt || tx ? 1 : 0;
      break;
  }

  return steps.map((s, i) => ({
    ...s,
    state:
      i < current ? "done" : i > current ? "upcoming" : d.status === "FAILED" ? "failed" : "current",
  }));
}
