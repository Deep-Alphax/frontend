"use client";

import { Fragment, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES_KEY,
  AUDIT_LOGS_KEY,
  getAuditEntities,
  getAuditLogs,
  REDACTED,
  type AuditAction,
  type AuditChange,
  type AuditLogFilters,
  type AuditLogItem,
} from "@/lib/api/audit";
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
import { SkeletonGroup, TableSkeleton } from "@/components/ui/Skeleton";

/*
 * Log de auditoria: tudo que usuários (inclusive admins) e o sistema fazem —
 * páginas abertas, alterações com valor antigo e novo, login/logout.
 *
 * Os filtros são um RASCUNHO até o "Apply": digitar no campo de usuário não
 * dispara uma consulta por tecla. A lista é paginada por cursor ("Load more"),
 * mais recentes primeiro — a tabela cresce sem limite e nunca vem inteira.
 */

/** Sentinela do Select: o Radix não aceita `value=""` num item. */
const ALL = "__all";

const ACTION_LABEL: Record<AuditAction, string> = {
  PAGE_VIEW: "Page view",
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  CREATE_MANY: "Create (bulk)",
  UPDATE_MANY: "Update (bulk)",
  DELETE_MANY: "Delete (bulk)",
  LOGIN: "Login",
  LOGIN_FAILED: "Login failed",
  LOGOUT: "Logout",
};

/** Cor por família de ação — só para escanear a lista mais rápido. */
function actionTone(action: AuditAction): string {
  if (action.startsWith("DELETE") || action === "LOGIN_FAILED")
    return "border-danger-11/40 text-danger-11";
  if (action.startsWith("UPDATE")) return "border-principal-8 text-principal-11";
  if (action.startsWith("CREATE")) return "border-green-8 text-green-11";
  return "border-gray-6 text-gray-11";
}

interface Draft {
  action: string;
  actor: string;
  entity: string;
  entityId: string;
  from: string;
  to: string;
}

const EMPTY_DRAFT: Draft = {
  action: ALL,
  actor: "",
  entity: ALL,
  entityId: "",
  from: "",
  to: "",
};

/** Rascunho da tela → filtros da API. Datas: dia inteiro, no fuso local. */
export function draftToFilters(d: Draft): AuditLogFilters {
  const f: AuditLogFilters = {};
  if (d.action !== ALL) f.action = d.action as AuditAction;
  if (d.entity !== ALL) f.entity = d.entity;
  if (d.actor.trim()) f.actor = d.actor.trim();
  if (d.entityId.trim()) f.entityId = d.entityId.trim();
  if (d.from) f.from = new Date(`${d.from}T00:00:00`).toISOString();
  if (d.to) f.to = new Date(`${d.to}T23:59:59.999`).toISOString();
  return f;
}

function isClientError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export function AuditLogsAdmin() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [filters, setFilters] = useState<AuditLogFilters>({});

  const entities = useQuery({
    queryKey: AUDIT_ENTITIES_KEY,
    queryFn: getAuditEntities,
    staleTime: 10 * 60_000,
  });

  const logs = useInfiniteQuery({
    queryKey: [...AUDIT_LOGS_KEY, filters],
    queryFn: ({ pageParam }) => getAuditLogs(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Log é "o que aconteceu": ao voltar à tela, mostra o que entrou nesse meio tempo.
    staleTime: 0,
    // 4xx (ex.: 403 sem papel de admin) não melhora tentando de novo — mostra o
    // erro na hora. Só falha de servidor/rede merece uma segunda tentativa.
    retry: (count, error) => count < 1 && !isClientError(error),
  });

  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-12">Audit log</h1>
        <p className="mt-1 text-sm text-gray-11">
          Everything users, admins and the system do: pages opened, every change
          with its old and new value, logins. Sensitive fields (passwords,
          tokens, keys) are never stored. Page views are kept 90 days; changes, 2
          years.
        </p>
      </div>

      <form
        className="grid grid-cols-1 gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draftToFilters(draft));
        }}
      >
        <FilterSelect
          label="Action"
          value={draft.action}
          onChange={(action) => set({ action })}
          options={AUDIT_ACTIONS.map((a) => ({ value: a, label: ACTION_LABEL[a] }))}
        />
        <TextField
          label="User (id or e-mail)"
          value={draft.actor}
          onChange={(e) => set({ actor: e.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
        <FilterSelect
          label="Entity"
          value={draft.entity}
          onChange={(entity) => set({ entity })}
          options={(entities.data ?? []).map((e) => ({ value: e, label: e }))}
        />
        <TextField
          label="Record id"
          value={draft.entityId}
          onChange={(e) => set({ entityId: e.target.value })}
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
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            className="h-10 rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setFilters({});
            }}
            className="h-10 rounded-lg border border-gray-6 bg-gray-3 px-5 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8"
          >
            Clear
          </button>
        </div>
      </form>

      {/* `isPending`, não `isLoading`: com a aba em segundo plano o React Query
          PAUSA a nova tentativa — fica pendente sem estar buscando, e o
          `isLoading` (pendente E buscando) dá false. A tela caía no "No events"
          mesmo com a API respondendo 403. */}
      {logs.isPending ? (
        <SkeletonGroup className="py-2">
          <TableSkeleton rows={8} cols={5} />
        </SkeletonGroup>
      ) : logs.isError ? (
        <p role="alert" className="rounded-xl border border-danger-11/40 bg-gray-2 px-4 py-6 text-center text-sm text-danger-11">
          {getApiErrorMessage(logs.error, "Could not load the audit log.")}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-gray-6 bg-gray-2 px-4 py-10 text-center text-sm text-gray-11">
          No events for these filters.
        </p>
      ) : (
        <>
          <ScrollArea orientation="horizontal" className="rounded-xl border border-gray-6">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-3 text-left text-gray-11">
                  <th scope="col" className="w-8 border-b border-gray-6 px-2" />
                  {["When", "Who", "Action", "Target", "IP"].map((h) => (
                    <th key={h} scope="col" className="h-10 border-b border-gray-6 px-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <LogRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </ScrollArea>

          {logs.hasNextPage && (
            <button
              type="button"
              onClick={() => logs.fetchNextPage()}
              disabled={logs.isFetchingNextPage}
              className="mx-auto h-10 rounded-lg border border-gray-6 bg-gray-3 px-6 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8 disabled:opacity-60"
            >
              {logs.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
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
    second: "2-digit",
  });
}

function Who({ actor }: { actor: AuditLogItem["actor"] }) {
  if (actor.kind !== "user") {
    return <span className="italic text-gray-11">{actor.kind}</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-gray-12">{actor.email ?? actor.id ?? "—"}</span>
      {actor.role === "ADMIN" && (
        <span className="rounded-full border border-principal-8 px-1.5 py-px text-[10px] uppercase tracking-wide text-principal-11">
          Admin
        </span>
      )}
    </span>
  );
}

function target(item: AuditLogItem): string {
  if (item.entity) return item.entityId ? `${item.entity}#${item.entityId}` : item.entity;
  if (item.path) return item.method ? `${item.method} ${item.path}` : item.path;
  return "—";
}

function LogRow({ item }: { item: AuditLogItem }) {
  const [open, setOpen] = useState(false);
  const detailId = `audit-${item.id}`;

  return (
    <Fragment>
      <tr className={cn("align-top", open && "bg-gray-2")}>
        <td className="border-b border-gray-6 px-2 py-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={open ? "Hide details" : "Show details"}
            className="flex size-6 items-center justify-center rounded text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </td>
        <td className="whitespace-nowrap border-b border-gray-6 px-3 py-2 text-gray-11">
          {formatWhen(item.createdAt)}
        </td>
        <td className="border-b border-gray-6 px-3 py-2">
          <Who actor={item.actor} />
        </td>
        <td className="border-b border-gray-6 px-3 py-2">
          <span
            className={cn(
              "whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
              actionTone(item.action),
            )}
          >
            {ACTION_LABEL[item.action] ?? item.action}
          </span>
        </td>
        <td className="max-w-[320px] break-all border-b border-gray-6 px-3 py-2 font-mono text-xs text-gray-12">
          {target(item)}
        </td>
        <td className="whitespace-nowrap border-b border-gray-6 px-3 py-2 font-mono text-xs text-gray-11">
          {item.ip ?? "—"}
        </td>
      </tr>
      {open && (
        <tr id={detailId}>
          <td colSpan={6} className="border-b border-gray-6 bg-gray-1 px-6 py-4">
            <Details item={item} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/** Valor para exibir: `null` vira "—", objeto vira JSON curto, redacted em destaque. */
export function formatValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-gray-10">—</span>;
  if (v === REDACTED) {
    return (
      <span className="rounded bg-danger-11/10 px-1 text-danger-11" title="Sensitive field — never stored">
        {REDACTED}
      </span>
    );
  }
  if (typeof v === "object") {
    const json = JSON.stringify(v);
    return json.length > 200 ? `${json.slice(0, 200)}…` : json;
  }
  return String(v);
}

function ChangesList({ changes }: { changes: Record<string, AuditChange> }) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return <p className="text-xs text-gray-11">No field changes.</p>;
  return (
    <ul className="flex flex-col gap-1 font-mono text-xs">
      {entries.map(([field, c]) => (
        <li key={field} className="break-all">
          <span className="text-gray-11">{field}:</span>{" "}
          <span className="text-danger-11/90">{formatValue(c.old)}</span>
          <span className="px-1 text-gray-10">→</span>
          <span className="text-green-11">{formatValue(c.new)}</span>
        </li>
      ))}
    </ul>
  );
}

function Details({ item }: { item: AuditLogItem }) {
  const rows = Array.isArray(item.meta?.rows)
    ? (item.meta!.rows as { id: string; changes: Record<string, AuditChange> }[])
    : null;
  const metaRest = item.meta
    ? Object.fromEntries(Object.entries(item.meta).filter(([k]) => k !== "rows"))
    : null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      {item.changes && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-11">Changes</h3>
          <ChangesList changes={item.changes} />
        </section>
      )}
      {rows && rows.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-11">Rows</h3>
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <div key={r.id}>
                <p className="mb-1 font-mono text-xs text-gray-12">#{r.id}</p>
                <ChangesList changes={r.changes ?? {}} />
              </div>
            ))}
          </div>
        </section>
      )}
      {metaRest && Object.keys(metaRest).length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-11">Details</h3>
          <ul className="flex flex-col gap-1 font-mono text-xs">
            {Object.entries(metaRest).map(([k, v]) => (
              <li key={k} className="break-all">
                <span className="text-gray-11">{k}:</span> {formatValue(v)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-1 text-xs text-gray-11">
        {item.path && (
          <p className="break-all font-mono">
            {item.method ? `${item.method} ` : ""}
            {item.path}
          </p>
        )}
        <p className="break-all">{item.userAgent ?? "No user agent"}</p>
      </section>
    </div>
  );
}
