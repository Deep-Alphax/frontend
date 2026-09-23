"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import {
  getPayments,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PAYMENTS_KEY,
  syncPayments,
  type PaymentFilters,
  type PaymentItem,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/api/payments";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ScrollArea } from "@/components/ui/ScrollArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

/*
 * Todos os pagamentos da plataforma — cartão (Stripe) e USDC (on-chain) — numa
 * lista só, mais recentes primeiro, com os totais dos filtros aplicados.
 *
 * Mesmo desenho da tela de logs: filtros são RASCUNHO até o "Apply", lista
 * paginada por cursor. O "Sync" importa o histórico que ainda não está no
 * livro-caixa (idempotente — rodar de novo não duplica).
 */

/** Sentinela do Select: o Radix não aceita `value=""` num item. */
const ALL = "__all";

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  STRIPE: "Card",
  CRYPTO: "USDC",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

const STATUS_TONE: Record<PaymentStatus, string> = {
  PAID: "border-green-8 text-green-11",
  FAILED: "border-danger-11/40 text-danger-11",
  REFUNDED: "border-gray-6 text-gray-11",
  PARTIALLY_REFUNDED: "border-principal-8 text-principal-11",
};

const CHAIN_LABEL: Record<string, string> = {
  SOLANA: "Solana",
  ETHEREUM: "Ethereum",
  BASE: "Base",
  ARBITRUM: "Arbitrum",
  OPTIMISM: "Optimism",
  POLYGON: "Polygon",
  BSC: "BNB Chain",
};

interface Draft {
  provider: string;
  status: string;
  user: string;
  from: string;
  to: string;
}

const EMPTY_DRAFT: Draft = { provider: ALL, status: ALL, user: "", from: "", to: "" };

/** Rascunho da tela → filtros da API. Datas: dia inteiro, no fuso local. */
export function draftToFilters(d: Draft): PaymentFilters {
  const f: PaymentFilters = {};
  if (d.provider !== ALL) f.provider = d.provider as PaymentProvider;
  if (d.status !== ALL) f.status = d.status as PaymentStatus;
  if (d.user.trim()) f.user = d.user.trim();
  if (d.from) f.from = new Date(`${d.from}T00:00:00`).toISOString();
  if (d.to) f.to = new Date(`${d.to}T23:59:59.999`).toISOString();
  return f;
}

/** Centavos → moeda formatada ("$50.00", "R$ 279,00" vira "R$279.00" em en-US). */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    // Código de moeda desconhecido: não quebra a tela por isso.
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function isClientError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/** "0x1234…abcd" — o suficiente para reconhecer, sem ocupar a linha toda. */
function abbreviate(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

/** Só abre link HTTPS: o valor vem do backend, mas um `javascript:` nunca vira href. */
function safeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function PaymentsAdmin() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [filters, setFilters] = useState<PaymentFilters>({});

  const payments = useInfiniteQuery({
    queryKey: [...PAYMENTS_KEY, filters],
    queryFn: ({ pageParam }) => getPayments(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
    // 4xx (ex.: 403 sem papel de admin) não melhora tentando de novo — mostra o
    // erro na hora. Só falha de servidor/rede merece uma segunda tentativa.
    retry: (count, error) => count < 1 && !isClientError(error),
  });

  const sync = useMutation({
    mutationFn: syncPayments,
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.stripe.imported} card and ${r.crypto.imported} USDC payment${
          r.stripe.imported + r.crypto.imported === 1 ? "" : "s"
        }.`,
      );
      if (r.errors.length > 0) toast.error(`Some items failed: ${r.errors.join("; ")}`);
      void qc.invalidateQueries({ queryKey: PAYMENTS_KEY });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not sync payments.")),
  });

  const items = payments.data?.pages.flatMap((p) => p.items) ?? [];
  // O resumo é o mesmo em todas as páginas (mesmos filtros): vale o da primeira.
  const summary = payments.data?.pages[0]?.summary;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-12">Payments</h1>
          <p className="mt-1 text-sm text-gray-11">
            Every payment on the platform — card (Stripe) and USDC (on-chain) —
            with refunds and failures.
          </p>
        </div>
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="flex h-10 items-center gap-2 rounded-lg border border-gray-6 bg-gray-3 px-4 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8 disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4", sync.isPending && "animate-spin")} aria-hidden />
          {sync.isPending ? "Syncing…" : "Sync from Stripe & chain"}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Received"
            value={formatMoney(summary.receivedCents - summary.refundedCents, summary.currency)}
          />
          <StatTile label="Refunded" value={formatMoney(summary.refundedCents, summary.currency)} />
          <StatTile label="Payments" value={summary.paidCount.toLocaleString("en-US")} />
          <StatTile label="Failed" value={summary.failedCount.toLocaleString("en-US")} />
        </div>
      )}

      <form
        className="grid grid-cols-1 gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draftToFilters(draft));
        }}
      >
        <FilterSelect
          label="Method"
          value={draft.provider}
          onChange={(provider) => set({ provider })}
          options={PAYMENT_PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))}
        />
        <FilterSelect
          label="Status"
          value={draft.status}
          onChange={(status) => set({ status })}
          options={PAYMENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <TextField
          label="User (id or e-mail)"
          value={draft.user}
          onChange={(e) => set({ user: e.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
        <TextField
          label="From"
          type="date"
          value={draft.from}
          onChange={(e) => set({ from: e.target.value })}
        />
        <TextField
          label="To"
          type="date"
          value={draft.to}
          onChange={(e) => set({ to: e.target.value })}
        />
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-12 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setFilters({});
            }}
            className="h-12 rounded-lg border border-gray-6 bg-gray-3 px-5 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8"
          >
            Clear
          </button>
        </div>
      </form>

      {/* `isPending`, não `isLoading`: com a aba em segundo plano o React Query
          pausa a nova tentativa, e `isLoading` (pendente E buscando) dá false —
          a tela cairia no "vazio" com a API respondendo erro. */}
      {payments.isPending ? (
        <div className="flex h-40 items-center justify-center text-gray-11">
          <Loader2 className="size-5 animate-spin" aria-label="Loading" />
        </div>
      ) : payments.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-11/40 bg-gray-2 px-4 py-6 text-center text-sm text-danger-11"
        >
          {getApiErrorMessage(payments.error, "Could not load payments.")}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-gray-6 bg-gray-2 px-4 py-10 text-center text-sm text-gray-11">
          No payments for these filters.
        </p>
      ) : (
        <>
          <ScrollArea orientation="horizontal" className="rounded-xl border border-gray-6">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-3 text-left text-gray-11">
                  {["When", "User", "Method", "Amount", "Status", "Reference"].map((h) => (
                    <th key={h} scope="col" className="h-10 border-b border-gray-6 px-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <PaymentRow key={p.id} payment={p} />
                ))}
              </tbody>
            </table>
          </ScrollArea>

          {payments.hasNextPage && (
            <button
              type="button"
              onClick={() => payments.fetchNextPage()}
              disabled={payments.isFetchingNextPage}
              className="mx-auto h-10 rounded-lg border border-gray-6 bg-gray-3 px-6 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8 disabled:opacity-60"
            >
              {payments.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Um número de manchete (mesmo estilo dos tiles da aba de uso da mentoria). */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-gray-6 bg-gray-2 p-4">
      <span className="text-2xl font-semibold tabular-nums text-gray-12">{value}</span>
      <span className="text-xs text-gray-11">{label}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base text-gray-12">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-12">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function methodLabel(p: PaymentItem): string {
  if (p.provider === "STRIPE") return PROVIDER_LABEL.STRIPE;
  const chain = p.chain ? (CHAIN_LABEL[p.chain] ?? p.chain) : null;
  return chain ? `USDC · ${chain}` : "USDC";
}

function PaymentRow({ payment: p }: { payment: PaymentItem }) {
  const url = safeUrl(p.receiptUrl);
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap border-b border-gray-6 px-3 py-2 text-gray-11">
        {formatWhen(p.paidAt)}
      </td>
      <td className="border-b border-gray-6 px-3 py-2 text-gray-12">
        {p.user.email ?? p.user.id ?? "—"}
      </td>
      <td className="whitespace-nowrap border-b border-gray-6 px-3 py-2 text-gray-12">
        {methodLabel(p)}
      </td>
      <td className="whitespace-nowrap border-b border-gray-6 px-3 py-2">
        <span className="font-semibold tabular-nums text-gray-12">
          {formatMoney(p.amountCents, p.currency)}
        </span>
        {p.refundedCents > 0 && (
          <span className="block text-xs text-gray-11">
            −{formatMoney(p.refundedCents, p.currency)} refunded
          </span>
        )}
      </td>
      <td className="border-b border-gray-6 px-3 py-2">
        <span
          className={cn(
            "whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
            STATUS_TONE[p.status],
          )}
        >
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </td>
      <td className="border-b border-gray-6 px-3 py-2">
        <div className="flex flex-col gap-0.5 text-xs">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 font-semibold text-principal-11 hover:underline"
            >
              View <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <span className="font-mono text-gray-11" title={p.providerRef}>
              {abbreviate(p.providerRef)}
            </span>
          )}
          {p.txHash && (
            <span className="font-mono text-gray-11" title={p.txHash}>
              tx {abbreviate(p.txHash)}
            </span>
          )}
          {p.payer && (
            <span className="font-mono text-gray-11" title={p.payer}>
              from {abbreviate(p.payer)}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
