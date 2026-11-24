"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { SkeletonGroup, TableSkeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import {
  ADMIN_INVITES_KEY,
  formatAdminDate as formatDate,
  inviteLink,
  inviteStatus,
  isClientError,
  type InviteStatus,
} from "@/lib/access/admin";
import {
  createInvite,
  listInvites,
  updateInvite,
  type AccessInvite,
} from "@/lib/api/access";
import { getAdminErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/*
 * Links de convite do Elixir Alpha (`/mentorship?invite=CODE`).
 *
 * Quem abre o link e aceita vira ELIXIR_ALPHA (a pergunta é do
 * `InviteRedeemer`). O código é opcional na criação — vazio, o servidor gera
 * um aleatório. Validação aqui só para errar cedo; quem decide é o servidor
 * (400/409), e a mensagem dele aparece na tela.
 */

const MAX_USES = 100_000;

/** Data do `<input type="date">` → fim daquele dia no fuso local. */
function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59.999`);
}

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => !v || /^[A-Z0-9-]{3,32}$/.test(v), "3 to 32 characters: A–Z, 0–9 or -"),
  // Texto (e não número) porque vazio = sem teto.
  maxUses: z
    .string()
    .trim()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= MAX_USES),
      "Between 1 and 100,000 (or empty for unlimited)",
    ),
  expiresOn: z
    .string()
    .refine((v) => !v || endOfDay(v).getTime() > Date.now(), "Must be a future date"),
  note: z.string().trim().max(200, "Up to 200 characters"),
});

type CreateFormValues = z.infer<typeof createSchema>;

const DEFAULTS: CreateFormValues = { code: "", maxUses: "", expiresOn: "", note: "" };

const STATUS_LABEL: Record<InviteStatus, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
  EXPIRED: "Expired",
  EXHAUSTED: "Exhausted",
};

const STATUS_TONE: Record<InviteStatus, string> = {
  ACTIVE: "border-green-8 text-green-11",
  DISABLED: "border-gray-6 text-gray-11",
  EXPIRED: "border-danger-11/40 text-danger-11",
  EXHAUSTED: "border-principal-8 text-principal-11",
};

/** Origem pública do app para o link (ver `inviteLink`). */
function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

export function InvitesAdmin() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-12">Invite links</h2>
        <p className="mt-1 text-sm text-gray-11">
          Anyone who opens an invite link and accepts it becomes Elixir Alpha.
          Leave the code empty to generate a random one.
        </p>
      </div>
      <CreateInviteForm />
      <InvitesTable />
    </section>
  );
}

function CreateInviteForm() {
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
      createInvite({
        ...(values.code ? { code: values.code } : {}),
        maxUses: values.maxUses ? Number(values.maxUses) : null,
        expiresAt: values.expiresOn ? endOfDay(values.expiresOn).toISOString() : null,
        note: values.note || null,
      }),
    onSuccess: (invite) => {
      qc.setQueryData<AccessInvite[]>(ADMIN_INVITES_KEY, (list) =>
        list ? [invite, ...list] : list,
      );
      void qc.invalidateQueries({ queryKey: ADMIN_INVITES_KEY });
      reset(DEFAULTS);
      toast.success(`Invite ${invite.code} created.`);
    },
    onError: (error) => {
      const message = getAdminErrorMessage(error, "Could not create the invite.");
      const status = (error as { response?: { status?: number } })?.response?.status;
      // 409 = código já existe: o erro vai para o campo do código.
      if (status === 409) setError("code", { message });
      else setError("root.server", { message });
    },
  });

  const codeField = register("code");

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => create.mutate(values))}
      className="grid grid-cols-1 gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <TextField
        label="Code (optional)"
        placeholder="ELIXIR-VIP"
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
        label="Max uses (optional)"
        placeholder="Unlimited"
        inputMode="numeric"
        autoComplete="off"
        error={errors.maxUses?.message}
        {...register("maxUses")}
      />
      <TextField
        label="Expires on (optional)"
        type="date"
        error={errors.expiresOn?.message}
        {...register("expiresOn")}
      />
      <TextField
        label="Note (optional)"
        placeholder="e.g. Elixir cohort 1"
        maxLength={200}
        autoComplete="off"
        error={errors.note?.message}
        {...register("note")}
      />
      <div className="flex items-end sm:col-span-2 lg:col-span-4 lg:justify-end">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60 lg:w-56"
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {create.isPending ? "Creating…" : "Create invite"}
        </button>
      </div>
      {errors.root?.server?.message && (
        <p role="alert" className="text-sm text-danger-11 sm:col-span-2 lg:col-span-4">
          {errors.root.server.message}
        </p>
      )}
    </form>
  );
}

const HEADERS = ["Code", "Uses", "Expires", "Status", "Note", "Created", ""];

function InvitesTable() {
  const invites = useQuery({
    queryKey: ADMIN_INVITES_KEY,
    queryFn: listInvites,
    staleTime: 0,
    retry: (count, error) => count < 1 && !isClientError(error),
  });

  if (invites.isPending) {
    return (
      <SkeletonGroup label="Loading invites" className="py-2">
        <TableSkeleton rows={4} cols={6} />
      </SkeletonGroup>
    );
  }
  if (invites.isError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-danger-11/40 bg-gray-2 px-4 py-6 text-center text-sm text-danger-11"
      >
        {getAdminErrorMessage(invites.error, "Could not load the invites.")}
      </p>
    );
  }
  if (invites.data.length === 0) {
    return (
      <p className="rounded-xl border border-gray-6 bg-gray-2 px-4 py-10 text-center text-sm text-gray-11">
        No invites yet.
      </p>
    );
  }

  return (
    <ScrollArea orientation="horizontal" className="rounded-xl border border-gray-6">
      <table aria-label="Invites" className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="bg-gray-3 text-left text-gray-11">
            {HEADERS.map((h, i) => (
              <th key={h || i} scope="col" className="h-10 border-b border-gray-6 px-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invites.data.map((invite) => (
            <InviteRow key={invite.id} invite={invite} />
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

function InviteRow({ invite: inv }: { invite: AccessInvite }) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () => updateInvite(inv.id, { active: !inv.active }),
    onSuccess: (next) => {
      qc.setQueryData<AccessInvite[]>(ADMIN_INVITES_KEY, (list) =>
        list?.map((i) => (i.id === next.id ? next : i)),
      );
      toast.success(`${next.code} ${next.active ? "enabled" : "disabled"}.`);
    },
    onError: (error) => toast.error(getAdminErrorMessage(error, "Could not update the invite.")),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(appOrigin(), inv.code));
      toast.success("Invite link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const status = inviteStatus(inv);
  const cell = "border-b border-gray-6 px-3 py-2 align-middle";

  return (
    <tr>
      <td className={cell}>
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-gray-12">{inv.code}</span>
          <button
            type="button"
            onClick={copyLink}
            aria-label={`Copy link for ${inv.code}`}
            title="Copy invite link"
            className="rounded-md p-1 text-gray-11 transition-colors hover:bg-gray-4 hover:text-gray-12"
          >
            <Link2 className="size-4" aria-hidden />
          </button>
        </div>
      </td>
      <td className={cn(cell, "whitespace-nowrap tabular-nums text-gray-12")}>
        {inv.usedCount} / {inv.maxUses ?? "∞"}
      </td>
      <td className={cn(cell, "whitespace-nowrap text-gray-11")}>
        {inv.expiresAt ? formatDate(inv.expiresAt) : "Never"}
      </td>
      <td className={cell}>
        <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-xs", STATUS_TONE[status])}>
          {STATUS_LABEL[status]}
        </span>
      </td>
      <td className={cn(cell, "max-w-[220px] break-words text-gray-11")}>{inv.note ?? "—"}</td>
      <td className={cn(cell, "whitespace-nowrap text-gray-11")}>{formatDate(inv.createdAt)}</td>
      <td className={cell}>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
            aria-label={`${inv.active ? "Disable" : "Enable"} ${inv.code}`}
            className="rounded-md border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm text-gray-12 transition-colors hover:bg-gray-4 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {inv.active ? "Disable" : "Enable"}
          </button>
        </div>
      </td>
    </tr>
  );
}
