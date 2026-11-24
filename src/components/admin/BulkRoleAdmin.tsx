"use client";

import { useId, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  ADMIN_USERS_KEY,
  MAX_BULK_EMAILS,
  parseEmailList,
  ROLE_LABEL,
} from "@/lib/access/admin";
import { bulkSetRole, type BulkRoleResult, type UserRole } from "@/lib/api/access";
import { getAdminErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/*
 * Cargo em lote: o admin cola a lista de e-mails (planilha, chat, CSV) e aplica
 * USER ou ELIXIR_ALPHA. ADMIN nunca vai em lote (o backend recusa) e um ADMIN
 * da lista nunca é rebaixado — volta em `skippedAdmins`.
 *
 * A normalização (minúsculas, sem repetição) acontece aqui para a contagem na
 * tela bater com o que o servidor vai processar.
 */

type BulkRole = Exclude<UserRole, "ADMIN">;
const BULK_ROLES: BulkRole[] = ["ELIXIR_ALPHA", "USER"];

export function BulkRoleAdmin() {
  const qc = useQueryClient();
  const textareaId = useId();
  const [text, setText] = useState("");
  const [role, setRole] = useState<BulkRole>("ELIXIR_ALPHA");
  const [result, setResult] = useState<{ role: BulkRole; data: BulkRoleResult } | null>(
    null,
  );

  const parsed = useMemo(() => parseEmailList(text), [text]);
  const count = parsed.emails.length;
  const tooMany = count > MAX_BULK_EMAILS;
  const error =
    parsed.invalid.length > 0
      ? `Fix or remove ${parsed.invalid.length === 1 ? "this entry" : "these entries"}: ${parsed.invalid
          .slice(0, 5)
          .join(", ")}${parsed.invalid.length > 5 ? ` and ${parsed.invalid.length - 5} more` : ""}`
      : tooMany
        ? `Up to ${MAX_BULK_EMAILS.toLocaleString("en-US")} emails at a time (you have ${count.toLocaleString("en-US")}).`
        : undefined;

  const apply = useMutation({
    mutationFn: ({ emails, role }: { emails: string[]; role: BulkRole }) =>
      bulkSetRole(emails, role),
    onSuccess: (data, vars) => {
      setResult({ role: vars.role, data });
      void qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
      toast.success(
        `${data.updated.length} ${data.updated.length === 1 ? "account" : "accounts"} updated.`,
      );
    },
    onError: (err) => toast.error(getAdminErrorMessage(err, "Could not apply the role.")),
  });

  const submit = () => {
    if (count === 0 || error || apply.isPending) return;
    const ok = window.confirm(
      `Set the role ${ROLE_LABEL[role]} for ${count} ${count === 1 ? "account" : "accounts"}?`,
    );
    if (!ok) return;
    setResult(null);
    apply.mutate({ emails: parsed.emails, role });
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-12">Bulk role by email</h2>
        <p className="mt-1 text-sm text-gray-11">
          Paste emails separated by commas, spaces or new lines. Admins in the
          list are never changed.
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={textareaId} className="text-base text-gray-12">
            Emails
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            spellCheck={false}
            autoComplete="off"
            placeholder={"ana@example.com, bruno@example.com\ncarla@example.com"}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${textareaId}-hint`}
            className={cn(
              "min-h-32 w-full resize-y rounded-lg border bg-gray-2 px-3 py-2 font-mono text-sm text-gray-12 outline-none transition-colors placeholder:text-gray-11",
              error ? "border-danger-11" : "border-gray-6 focus:border-secundaria-11",
            )}
          />
          <p
            id={`${textareaId}-hint`}
            role={error ? "alert" : undefined}
            className={cn("text-sm", error ? "text-danger-11" : "text-gray-11")}
          >
            {error ??
              (count === 0
                ? `Up to ${MAX_BULK_EMAILS.toLocaleString("en-US")} emails.`
                : `${count} ${count === 1 ? "email" : "emails"} ready.`)}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <Select value={role} onValueChange={(v) => setRole(v as BulkRole)}>
              <SelectTrigger aria-label="Role to apply">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BULK_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="submit"
            disabled={count === 0 || Boolean(error) || apply.isPending}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {apply.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {apply.isPending ? "Applying…" : "Apply role"}
          </button>
        </div>
      </form>

      {result && <BulkResultSummary role={result.role} result={result.data} />}
    </section>
  );
}

function BulkResultSummary({ role, result }: { role: BulkRole; result: BulkRoleResult }) {
  const groups: { key: keyof BulkRoleResult; label: string; tone: string }[] = [
    { key: "updated", label: `Updated to ${ROLE_LABEL[role]}`, tone: "text-green-11" },
    { key: "unchanged", label: "Already had this role", tone: "text-gray-12" },
    { key: "skippedAdmins", label: "Skipped (admins)", tone: "text-principal-11" },
    { key: "notFound", label: "No account found", tone: "text-danger-11" },
  ];

  return (
    <div
      role="region"
      aria-label="Bulk role result"
      className="flex flex-col gap-3 rounded-xl border border-gray-6 bg-gray-2 p-4"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-col gap-1 rounded-lg border border-gray-6 bg-gray-3 px-3 py-2">
            <span className="text-xs text-gray-11">{g.label}</span>
            <span className={cn("text-xl font-semibold tabular-nums", g.tone)}>
              {result[g.key].length}
            </span>
          </div>
        ))}
      </div>
      {groups
        .filter((g) => result[g.key].length > 0)
        .map((g) => (
          <details key={g.key} className="rounded-lg border border-gray-6 px-3 py-2">
            <summary className="cursor-pointer text-sm text-gray-12">
              {g.label} ({result[g.key].length})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 break-all font-mono text-xs text-gray-11">
              {result[g.key].map((email) => (
                <li key={email}>{email}</li>
              ))}
            </ul>
          </details>
        ))}
    </div>
  );
}
