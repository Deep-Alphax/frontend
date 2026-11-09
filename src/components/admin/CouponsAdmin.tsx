"use client";

import { Fragment, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  ADMIN_COUPONS_KEY,
  createCoupon,
  listCouponRedemptions,
  listCoupons,
  updateCoupon,
  type AdminCoupon,
  type UpdateCouponInput,
} from "@/lib/api/coupons";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { couponErrorMessage } from "@/lib/coupon";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup, TableSkeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";

/*
 * Cupons de PRO grátis (contrato em `lib/api/coupons.ts`).
 *
 * Em cima, a criação; embaixo, a lista com status derivado, ligar/desligar,
 * ajuste do teto de usos e quem resgatou. Os dias de um cupom são imutáveis
 * depois de criado (o contrato não aceita mudar) — trocar a oferta é criar
 * outro código.
 *
 * A validação do formulário espelha os limites do backend só para errar cedo:
 * quem decide é o servidor (400/409), e a mensagem dele aparece na tela.
 */

const MAX_REDEMPTIONS = 100_000;

/** Data do `<input type="date">` → fim daquele dia no fuso local. */
function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59.999`);
}

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,32}$/, "3 to 32 characters: A–Z, 0–9 or -"),
  days: z
    .number({ error: "Enter the number of days" })
    .int("Whole days only")
    .min(1, "Between 1 and 365 days")
    .max(365, "Between 1 and 365 days"),
  maxRedemptions: z
    .number({ error: "Enter how many redemptions" })
    .int("Whole number only")
    .min(1, "Between 1 and 100,000")
    .max(MAX_REDEMPTIONS, "Between 1 and 100,000"),
  expiresOn: z
    .string()
    .refine(
      (v) => !v || endOfDay(v).getTime() > Date.now(),
      "Must be a future date",
    ),
  note: z.string().trim().max(200, "Up to 200 characters"),
});

type CreateFormValues = z.infer<typeof createSchema>;

const DEFAULTS: CreateFormValues = {
  code: "",
  days: 30,
  maxRedemptions: 100,
  expiresOn: "",
  note: "",
};

export type CouponStatus = "ACTIVE" | "DISABLED" | "EXPIRED" | "EXHAUSTED";

/**
 * Status mostrado na lista — derivado, o backend não grava. A ordem importa:
 * desativado manda sobre tudo (foi decisão do admin), depois validade, depois
 * esgotamento.
 */
export function couponStatus(c: AdminCoupon, now: number = Date.now()): CouponStatus {
  if (!c.active) return "DISABLED";
  if (c.expiresAt && Date.parse(c.expiresAt) <= now) return "EXPIRED";
  if (c.redeemedCount >= c.maxRedemptions) return "EXHAUSTED";
  return "ACTIVE";
}

const STATUS_LABEL: Record<CouponStatus, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
  EXPIRED: "Expired",
  EXHAUSTED: "Exhausted",
};

const STATUS_TONE: Record<CouponStatus, string> = {
  ACTIVE: "border-green-8 text-green-11",
  DISABLED: "border-gray-6 text-gray-11",
  EXPIRED: "border-danger-11/40 text-danger-11",
  EXHAUSTED: "border-principal-8 text-principal-11",
};

/** Link compartilhável — o `/plans` captura o `?coupon=` (ver `lib/coupon.ts`). */
export function couponLink(origin: string, code: string): string {
  return `${origin}/plans?coupon=${encodeURIComponent(code)}`;
}

function isClientError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Troca o cupom atualizado no cache da lista — sem refazer a consulta inteira. */
function replaceCoupon(qc: QueryClient, next: AdminCoupon): void {
  qc.setQueryData<AdminCoupon[]>(ADMIN_COUPONS_KEY, (list) =>
    list?.map((c) => (c.id === next.id ? next : c)),
  );
}

export function CouponsAdmin() {
  return (
    <div className="flex flex-col gap-10">
      <CreateCouponForm />
      <CouponsTable />
    </div>
  );
}

function CreateCouponForm() {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: DEFAULTS,
    mode: "onTouched",
  });

  const create = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createCoupon({
        code: values.code,
        days: values.days,
        maxRedemptions: values.maxRedemptions,
        expiresAt: values.expiresOn ? endOfDay(values.expiresOn).toISOString() : null,
        note: values.note || null,
      }),
    onSuccess: (coupon) => {
      // Mais recentes primeiro, como o backend devolve.
      qc.setQueryData<AdminCoupon[]>(ADMIN_COUPONS_KEY, (list) =>
        list ? [coupon, ...list] : list,
      );
      void qc.invalidateQueries({ queryKey: ADMIN_COUPONS_KEY });
      reset(DEFAULTS);
      toast.success(`Coupon ${coupon.code} created.`);
    },
    onError: (error) => {
      const message = couponErrorMessage(error, "Could not create the coupon.");
      const status = (error as { response?: { status?: number } })?.response?.status;
      // 409 = código já existe: o erro vai para o campo do código.
      if (status === 409) setError("code", { message });
      else setError("root.server", { message });
    },
  });

  // O código aparece em maiúsculas enquanto se digita (é como ele será gravado).
  const codeField = register("code");

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-12">Coupons</h1>
        <p className="mt-1 text-sm text-gray-11">
          Each code grants free Pro for a number of days. Only accounts that
          never had Pro can redeem, one coupon per account. When the days run
          out the account goes back to Free — nothing is charged.
        </p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((values) => create.mutate(values))}
        className="grid grid-cols-1 gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TextField
          label="Code"
          placeholder="LAUNCH30"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          error={errors.code?.message}
          {...codeField}
          onChange={(e) => {
            e.target.value = e.target.value.toUpperCase();
            void codeField.onChange(e);
          }}
        />
        <TextField
          label="Days of Pro"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          error={errors.days?.message}
          {...register("days", { valueAsNumber: true })}
        />
        <TextField
          label="Max redemptions"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_REDEMPTIONS}
          error={errors.maxRedemptions?.message}
          {...register("maxRedemptions", { valueAsNumber: true })}
        />
        <TextField
          label="Expires on (optional)"
          type="date"
          error={errors.expiresOn?.message}
          {...register("expiresOn")}
        />
        <TextField
          label="Note (optional)"
          placeholder="e.g. KOL campaign"
          maxLength={200}
          autoComplete="off"
          error={errors.note?.message}
          {...register("note")}
        />
        <div className="flex items-end">
          <button
            type="submit"
            disabled={create.isPending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {create.isPending ? "Creating…" : "Create coupon"}
          </button>
        </div>
        {errors.root?.server?.message && (
          <p role="alert" className="text-sm text-danger-11 sm:col-span-2 lg:col-span-3">
            {errors.root.server.message}
          </p>
        )}
      </form>
    </section>
  );
}

const HEADERS = [
  "Code",
  "Days",
  "Redeemed",
  "Expires",
  "Status",
  "Note",
  "Created",
  "",
];

function CouponsTable() {
  const coupons = useQuery({
    queryKey: ADMIN_COUPONS_KEY,
    queryFn: listCoupons,
    staleTime: 0,
    // 4xx (ex.: 403 sem papel de admin) não melhora tentando de novo.
    retry: (count, error) => count < 1 && !isClientError(error),
  });

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-12">All coupons</h2>

      {/* `isPending` e não `isLoading` — mesmo motivo do `PaymentsAdmin`. */}
      {coupons.isPending ? (
        <SkeletonGroup className="py-2">
          <TableSkeleton rows={5} cols={7} />
        </SkeletonGroup>
      ) : coupons.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-11/40 bg-gray-2 px-4 py-6 text-center text-sm text-danger-11"
        >
          {getApiErrorMessage(coupons.error, "Could not load the coupons.")}
        </p>
      ) : coupons.data.length === 0 ? (
        <p className="rounded-xl border border-gray-6 bg-gray-2 px-4 py-10 text-center text-sm text-gray-11">
          No coupons yet.
        </p>
      ) : (
        <ScrollArea orientation="horizontal" className="rounded-xl border border-gray-6">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr className="bg-gray-3 text-left text-gray-11">
                {HEADERS.map((h, i) => (
                  <th
                    key={h || i}
                    scope="col"
                    className="h-10 border-b border-gray-6 px-3 font-normal"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.data.map((c) => (
                <CouponRow key={c.id} coupon={c} />
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </section>
  );
}

const ROW_BTN =
  "rounded-md border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm text-gray-12 transition-colors hover:bg-gray-4 disabled:cursor-not-allowed disabled:opacity-40";

function CouponRow({ coupon: c }: { coupon: AdminCoupon }) {
  const qc = useQueryClient();
  const [showRedemptions, setShowRedemptions] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [maxDraft, setMaxDraft] = useState("");

  const update = useMutation({
    mutationFn: (input: UpdateCouponInput) => updateCoupon(c.id, input),
    onSuccess: (next, input) => {
      replaceCoupon(qc, next);
      setEditingMax(false);
      toast.success(
        input.active === undefined
          ? `${next.code} updated.`
          : `${next.code} ${next.active ? "enabled" : "disabled"}.`,
      );
    },
    onError: (error) => toast.error(couponErrorMessage(error, "Could not update the coupon.")),
  });

  const status = couponStatus(c);
  const parsedMax = /^\d+$/.test(maxDraft.trim()) ? Number(maxDraft.trim()) : NaN;
  // O teto nunca fica abaixo do que já foi resgatado (nem abaixo de 1).
  const minMax = Math.max(1, c.redeemedCount);
  const maxError = !Number.isInteger(parsedMax)
    ? "Enter a whole number"
    : parsedMax < minMax
      ? `At least ${minMax}`
      : parsedMax > MAX_REDEMPTIONS
        ? "At most 100,000"
        : undefined;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(couponLink(window.location.origin, c.code));
      toast.success("Coupon link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const cell = "border-b border-gray-6 px-3 py-2 align-top";

  return (
    <Fragment>
      <tr>
        <td className={cell}>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-gray-12">{c.code}</span>
            <button
              type="button"
              onClick={copyLink}
              aria-label={`Copy link for ${c.code}`}
              title="Copy shareable link"
              className="rounded-md p-1 text-gray-11 transition-colors hover:bg-gray-4 hover:text-gray-12"
            >
              <Link2 className="size-4" aria-hidden />
            </button>
          </div>
        </td>
        <td className={cn(cell, "tabular-nums text-gray-12")}>{c.days}</td>
        <td className={cell}>
          {editingMax ? (
            <form
              noValidate
              className="flex items-start gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (maxError || update.isPending) return;
                update.mutate({ maxRedemptions: parsedMax });
              }}
            >
              <span className="mt-3.5 whitespace-nowrap tabular-nums text-gray-11">
                {c.redeemedCount} /
              </span>
              <div className="w-28">
                <TextField
                  label={`Max redemptions for ${c.code}`}
                  hideLabel
                  type="number"
                  inputMode="numeric"
                  min={minMax}
                  max={MAX_REDEMPTIONS}
                  value={maxDraft}
                  onChange={(e) => setMaxDraft(e.target.value)}
                  error={maxDraft.trim() ? maxError : undefined}
                  autoFocus
                />
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="submit"
                  disabled={Boolean(maxError) || update.isPending}
                  className={ROW_BTN}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMax(false)}
                  className={ROW_BTN}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap tabular-nums text-gray-12">
                {c.redeemedCount} / {c.maxRedemptions}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMaxDraft(String(c.maxRedemptions));
                  setEditingMax(true);
                }}
                aria-label={`Edit max redemptions for ${c.code}`}
                className="text-xs font-semibold text-principal-11 hover:underline"
              >
                Edit
              </button>
            </div>
          )}
        </td>
        <td className={cn(cell, "whitespace-nowrap text-gray-11")}>
          {c.expiresAt ? formatDate(c.expiresAt) : "Never"}
        </td>
        <td className={cell}>
          <span
            className={cn(
              "whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
              STATUS_TONE[status],
            )}
          >
            {STATUS_LABEL[status]}
          </span>
        </td>
        <td className={cn(cell, "max-w-[220px] break-words text-gray-11")}>
          {c.note ?? "—"}
        </td>
        <td className={cn(cell, "whitespace-nowrap text-gray-11")}>
          {formatDate(c.createdAt)}
        </td>
        <td className={cell}>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ active: !c.active })}
              aria-label={`${c.active ? "Disable" : "Enable"} ${c.code}`}
              className={ROW_BTN}
            >
              {c.active ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={() => setShowRedemptions((v) => !v)}
              aria-expanded={showRedemptions}
              aria-label={`${showRedemptions ? "Hide" : "View"} redemptions of ${c.code}`}
              className={ROW_BTN}
            >
              {showRedemptions ? "Hide" : "View"}
            </button>
          </div>
        </td>
      </tr>
      {showRedemptions && (
        <tr>
          <td colSpan={HEADERS.length} className="border-b border-gray-6 bg-gray-2 px-3 py-3">
            <RedemptionsPanel coupon={c} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/** Quem resgatou — só busca quando o admin abre a linha. */
function RedemptionsPanel({ coupon }: { coupon: AdminCoupon }) {
  const redemptions = useQuery({
    // Sob a chave da lista: invalidar os cupons invalida também os resgates.
    queryKey: [...ADMIN_COUPONS_KEY, coupon.id, "redemptions"],
    queryFn: () => listCouponRedemptions(coupon.id),
    staleTime: 0,
    retry: (count, error) => count < 1 && !isClientError(error),
  });

  if (redemptions.isPending) {
    return (
      <SkeletonGroup label={`Loading redemptions of ${coupon.code}`} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <TableSkeleton rows={3} cols={3} />
      </SkeletonGroup>
    );
  }
  if (redemptions.isError) {
    return (
      <p role="alert" className="text-sm text-danger-11">
        {getApiErrorMessage(redemptions.error, "Could not load the redemptions.")}
      </p>
    );
  }
  if (redemptions.data.length === 0) {
    return <p className="text-sm text-gray-11">No redemptions yet.</p>;
  }

  return (
    <table
      aria-label={`Redemptions of ${coupon.code}`}
      className="w-full border-collapse text-sm"
    >
      <thead>
        <tr className="text-left text-gray-11">
          {["Account", "Redeemed", "Pro until"].map((h) => (
            <th key={h} scope="col" className="border-b border-gray-6 px-2 py-2 font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {redemptions.data.map((r) => (
          <tr key={r.id}>
            <td className="border-b border-gray-6/60 px-2 py-2 text-gray-12">
              {r.userEmail}
              {r.userId === null && (
                <span className="ml-2 text-xs text-gray-11">(deleted account)</span>
              )}
            </td>
            <td className="whitespace-nowrap border-b border-gray-6/60 px-2 py-2 text-gray-11">
              {formatDate(r.redeemedAt)}
            </td>
            <td className="whitespace-nowrap border-b border-gray-6/60 px-2 py-2 text-gray-11">
              {formatDate(r.periodEnd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
