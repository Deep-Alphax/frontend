"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, X } from "lucide-react";

import {
  CopyIcon,
  GoldIcon,
  WalletFilledIcon,
} from "@/components/icons/hugeicons";
import {
  AFFILIATES_KEY,
  formatBps,
  formatCents,
  getAffiliateOverview,
  timeAgo,
  updateReferralCode,
  type AffiliateOverview,
} from "@/lib/api/affiliates";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

interface AffiliatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Painel de afiliados (Figma `1150:32837` — `modal-kol-edit`).
 *
 * Geometria do arquivo: modal 1006px, raio 16; header 48px; cartões de ganhos
 * 477×104; chips 52px; linha da tabela 48px sobre cabeçalho de 44px.
 *
 * Os rótulos são os do design. "Deposit" e "Spent" vêm de uma arte de outro
 * produto (lá havia depósito e aposta), então cada um aponta para o número
 * equivalente daqui: Deposit = receita bruta que os indicados trouxeram,
 * Spent = comissão já repassada ao afiliado. Nenhum chip fica decorativo.
 *
 * Gate de montagem: só busca dados quando aberto. O painel é uma consulta de
 * dinheiro, e ninguém deveria pagá-la só por ter o header na tela.
 */
export function AffiliatesModal({ open, onOpenChange }: AffiliatesModalProps) {
  if (!open) return null;
  return <AffiliatesDialog onClose={() => onOpenChange(false)} />;
}

function AffiliatesDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: AFFILIATES_KEY,
    queryFn: getAffiliateOverview,
    staleTime: 30_000,
  });

  // Fecha no Escape (subscrição a evento externo — uso legítimo de effect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // clique no backdrop fecha
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Affiliates"
    >
      <div className="my-auto w-full max-w-[1006px] overflow-hidden rounded-2xl border border-gray-6 bg-gray-2">
        {/* Header 48px, padding 12/16, régua embaixo. */}
        <header className="flex h-12 items-center justify-between border-b border-gray-6 px-4">
          <h2 className="text-sm font-semibold text-gray-12">Affiliates</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
          >
            <X className="size-4" />
          </button>
        </header>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-gray-11">
            <Loader2 className="size-5 animate-spin" aria-label="Loading" />
          </div>
        ) : isError || !data ? (
          <div className="px-4 py-10 text-center text-base text-gray-11">
            {getApiErrorMessage(error, "Could not load your affiliate panel.")}
          </div>
        ) : (
          <div className="px-4">
            <CodeSection
              data={data}
              onSaved={(next) => queryClient.setQueryData(AFFILIATES_KEY, next)}
            />
            <hr className="border-gray-6" />
            <DashboardSection data={data} />
            <hr className="border-gray-6" />
            <HistorySection data={data} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Título de seção — 20px semibold, como as três do arquivo. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xl font-semibold text-gray-12">{children}</h3>;
}

/** Código e link, com edição do código (o botão "Editar" do design). */
function CodeSection({
  data,
  onSaved,
}: {
  data: AffiliateOverview;
  onSaved: (next: AffiliateOverview) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.code);

  const save = useMutation({
    mutationFn: updateReferralCode,
    onSuccess: (next) => {
      onSaved(next);
      setEditing(false);
      toast.success("Referral code updated.");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success("Referral link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const fieldClass =
    "h-12 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-2 px-4 text-base text-gray-12 outline-none transition-colors";

  return (
    <section className="flex flex-col gap-4 py-5">
      <SectionTitle>Affiliates</SectionTitle>

      <div className="grid gap-[18px] md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="referral-code" className="text-base text-gray-12">
            Referral code
          </label>
          <div className="flex items-center gap-2">
            <input
              id="referral-code"
              value={editing ? draft : data.code}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={!editing}
              spellCheck={false}
              autoComplete="off"
              className={cn(
                fieldClass,
                editing ? "focus:border-secundaria-11" : "text-gray-11",
              )}
            />
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(draft)}
                  className="h-12 shrink-0 rounded-lg bg-principal-9 px-5 text-base font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:opacity-60"
                >
                  {save.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(data.code);
                    setEditing(false);
                  }}
                  className="h-12 shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-5 text-base font-semibold text-gray-12 transition-colors hover:bg-gray-4"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft(data.code);
                  setEditing(true);
                }}
                className="h-12 shrink-0 rounded-lg bg-principal-9 px-5 text-base font-semibold text-gray-1 transition-colors hover:bg-principal-10"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-base text-gray-12">Referral link</span>
          <div className={cn(fieldClass, "flex items-center gap-2 px-4")}>
            <span className="min-w-0 flex-1 truncate text-gray-11">
              {data.link}
            </span>
            <button
              type="button"
              aria-label="Copy referral link"
              onClick={copyLink}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
            >
              <CopyIcon className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ganhos e contadores. */
function DashboardSection({ data }: { data: AffiliateOverview }) {

  return (
    <section className="flex flex-col gap-4 py-5">
      <SectionTitle>Dashboard</SectionTitle>

      <div className="grid gap-5 md:grid-cols-2">
        <EarningsCard
          label="Available earnings"
          value={formatCents(data.availableCents, data.currency)}
          tone="green"
        />
        <EarningsCard
          label="Total Earnings"
          value={formatCents(data.totalCents, data.currency)}
          tone="amber"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Deposit"
          value={formatCents(data.depositCents, data.currency)}
        />
        <StatTile
          label="Spent"
          value={formatCents(data.paidOutCents, data.currency)}
        />
        <StatTile
          label="Referalls"
          value={`${data.referralCount} ${data.referralCount === 1 ? "User" : "Users"}`}
        />
      </div>
    </section>
  );
}

/**
 * Cartão de ganhos: 104px, fundo gray-3, e a faixa de acento colada na borda
 * direita — no Figma é um quadrado de 40px girado -90° que o cartão recorta,
 * então o que aparece é uma lasca arredondada. O brilho ao lado dela é o que
 * dá profundidade ao cartão; sem ele o bloco fica chapado.
 */
function EarningsCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber";
}) {
  // Três tons por cartão, como no arquivo: a faixa, o ícone e o valor NÃO são
  // a mesma cor — o ícone é um passo mais saturado que o número.
  const accent = tone === "green" ? "bg-green-10" : "bg-principal-9";
  const icon = tone === "green" ? "text-green-11" : "text-principal-11";
  const text = tone === "green" ? "text-green-12" : "text-principal-12";
  const glow =
    tone === "green"
      ? "from-transparent to-green-10/25"
      : "from-transparent to-principal-9/25";
  const Icon = tone === "green" ? WalletFilledIcon : GoldIcon;

  return (
    <div className="relative h-[104px] overflow-hidden rounded-lg border border-gray-6 bg-gray-3 px-4 py-5">
      {/* Brilho e faixa do acento — decorativos, fora da árvore de acessibilidade. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-r",
          glow,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-0 top-1/2 h-10 w-2 -translate-y-1/2 rounded-l-xl",
          accent,
        )}
      />

      <div className="relative flex flex-col gap-4">
        <span className="text-base text-gray-12">{label}</span>
        <span className="flex items-center gap-2">
          <Icon className={cn("size-9 shrink-0", icon)} />
          <span className={cn("text-2xl font-semibold", text)}>{value}</span>
        </span>
      </div>
    </div>
  );
}

/** Chip de contador: 52px, rótulo à esquerda e valor à direita. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-[52px] items-center justify-between rounded-lg border border-gray-6 bg-gray-3 px-4">
      <span className="text-base text-gray-12">{label}</span>
      <span className="text-base font-semibold text-gray-12">{value}</span>
    </div>
  );
}

/** Extrato: uma linha por fatura paga de um indicado. */
function HistorySection({ data }: { data: AffiliateOverview }) {
  return (
    <section className="flex flex-col gap-4 py-5">
      <SectionTitle>History</SectionTitle>

      {data.history.length === 0 ? (
        <p className="rounded-lg border border-gray-6 bg-gray-3 px-4 py-10 text-center text-base text-gray-11">
          No referrals yet. Share your link — you earn{" "}
          {formatBps(data.level1Bps)} of every payment your referrals make, plus{" "}
          {formatBps(data.level2Bps)} of what the people <em>they</em> bring in
          pay, for as long as they stay subscribed.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-6">
          <table className="w-full min-w-[720px] border-collapse text-base">
            <thead>
              <tr className="bg-gray-3 text-left text-gray-11">
                {["User", "Spent", "Commission", "Start Date", "Last Seen"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="h-11 border-b border-gray-6 px-4 font-normal"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.history.map((row) => (
                <tr key={row.id} className="h-12">
                  <td className="border-b border-gray-6 px-4 font-semibold text-gray-12">
                    {row.referredName}
                  </td>
                  <td className="border-b border-gray-6 px-4 font-semibold text-gray-12">
                    {formatCents(row.spentCents, row.currency)}
                  </td>
                  <td className="border-b border-gray-6 px-4 font-semibold text-gray-12">
                    {formatCents(row.commissionCents, row.currency)}
                  </td>
                  <td className="border-b border-gray-6 px-4 font-semibold text-gray-12">
                    {new Date(row.startDate).toLocaleDateString("en-US")}
                  </td>
                  <td className="border-b border-gray-6 px-4 font-semibold text-gray-12">
                    {timeAgo(row.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
