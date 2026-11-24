"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import toast from "react-hot-toast";

import { BulkRoleAdmin } from "@/components/admin/BulkRoleAdmin";
import { InvitesAdmin } from "@/components/admin/InvitesAdmin";
import { AdminGate } from "@/components/admin/MentorshipAdminUi";
import { ScrollArea } from "@/components/ui/ScrollArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { SkeletonGroup, TableSkeleton } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import {
  ADMIN_USERS_KEY,
  formatAdminDate as formatDate,
  isClientError,
  ROLE_LABEL,
} from "@/lib/access/admin";
import {
  listAdminUsers,
  setAdminUserRole,
  type AdminUserPage,
  type AdminUserRow,
  type UserRole,
} from "@/lib/api/access";
import { getAdminErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";

/*
 * Admin · usuários e cargo Elixir Alpha (contrato em `lib/api/access.ts`).
 *
 * Três blocos: a lista de contas (busca, filtro por cargo e troca de cargo por
 * linha), o cargo em lote por e-mail e os links de convite. Gated por ADMIN no
 * componente só para não montar nada que levaria 403 — quem autoriza é o
 * `AdminGuard` do backend.
 */

const PAGE_SIZE = 25;
const ALL = "ALL";
type RoleFilter = UserRole | typeof ALL;

const ROLES: UserRole[] = ["USER", "ELIXIR_ALPHA", "ADMIN"];

export function UsersAdmin() {
  return (
    <AdminGate>
      <div className="flex flex-col gap-12">
        <UsersTable />
        <BulkRoleAdmin />
        <InvitesAdmin />
      </div>
    </AdminGate>
  );
}

const HEADERS = ["Email", "Name", "Role", "Plan", "Created", "Last login"];

function UsersTable() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>(ALL);

  // Debounce: sem ele cada tecla seria uma consulta ao banco.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const users = useInfiniteQuery({
    queryKey: [...ADMIN_USERS_KEY, { search, role }],
    queryFn: ({ pageParam }) =>
      listAdminUsers({
        search: search || undefined,
        role: role === ALL ? undefined : role,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 0,
    // Trocar busca/filtro mantém a lista anterior na tela até a nova chegar.
    placeholderData: keepPreviousData,
    retry: (count, error) => count < 1 && !isClientError(error),
  });

  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-12">Users</h1>
        <p className="mt-1 text-sm text-gray-11">
          Elixir Alpha accounts on the Free plan can only use the Mentorship,
          Plans, Affiliates, the KOLs index and the Deep Ranking. Pro unlocks
          everything for them.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Search"
            hideLabel
            type="search"
            placeholder="Search by email or name"
            autoComplete="off"
            maxLength={100}
            leftIcon={<Search className="size-4 text-gray-11" aria-hidden />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
            <SelectTrigger aria-label="Filter by role" className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {users.isPending ? (
        <SkeletonGroup label="Loading users" className="py-2">
          <TableSkeleton rows={6} cols={6} />
        </SkeletonGroup>
      ) : users.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-11/40 bg-gray-2 px-4 py-6 text-center text-sm text-danger-11"
        >
          {getAdminErrorMessage(users.error, "Could not load the users.")}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-gray-6 bg-gray-2 px-4 py-10 text-center text-sm text-gray-11">
          {search || role !== ALL ? "No users match these filters." : "No users yet."}
        </p>
      ) : (
        <>
          <ScrollArea
            orientation="horizontal"
            className={cn(
              "rounded-xl border border-gray-6 transition-opacity",
              users.isPlaceholderData && "opacity-60",
            )}
          >
            <table aria-label="Users" className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-3 text-left text-gray-11">
                  {HEADERS.map((h) => (
                    <th key={h} scope="col" className="h-10 border-b border-gray-6 px-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </ScrollArea>

          {users.hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void users.fetchNextPage()}
                disabled={users.isFetchingNextPage}
                className="flex h-10 items-center gap-2 rounded-lg border border-gray-6 bg-gray-3 px-5 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {users.isFetchingNextPage && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                {users.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Troca a linha atualizada em TODAS as listas em cache (qualquer filtro). */
function replaceUser(
  qc: ReturnType<typeof useQueryClient>,
  next: AdminUserRow,
): void {
  qc.setQueriesData<InfiniteData<AdminUserPage, string | undefined>>(
    { queryKey: ADMIN_USERS_KEY },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((p) => ({
          ...p,
          items: p.items.map((u) => (u.id === next.id ? next : u)),
        })),
      },
  );
}

function fullName(u: AdminUserRow): string {
  return [u.firstName, u.lastName].filter((s) => s?.trim()).join(" ") || "—";
}

/**
 * Dar ou tirar ADMIN pede confirmação: é o único cargo que abre o painel
 * inteiro (e tirar o de alguém pode deixá-lo sem acesso no meio do trabalho).
 */
function confirmRoleChange(user: AdminUserRow, next: UserRole): boolean {
  if (next === "ADMIN") {
    return window.confirm(
      `Make ${user.email} an admin? Admins can manage every part of Deep Alpha.`,
    );
  }
  if (user.role === "ADMIN") {
    return window.confirm(
      `Remove admin access from ${user.email}? They will become ${ROLE_LABEL[next]}.`,
    );
  }
  return true;
}

function UserRow({ user: u }: { user: AdminUserRow }) {
  const qc = useQueryClient();
  const { profile } = useSession();
  const isSelf = profile?.id === u.id;

  const change = useMutation({
    mutationFn: (role: UserRole) => setAdminUserRole(u.id, role),
    onSuccess: (next) => {
      replaceUser(qc, next);
      toast.success(`${next.email} is now ${ROLE_LABEL[next.role]}.`);
    },
    onError: (error) =>
      toast.error(getAdminErrorMessage(error, "Could not change the role.")),
  });

  const onRoleChange = (value: string) => {
    const next = value as UserRole;
    if (next === u.role || change.isPending) return;
    if (!confirmRoleChange(u, next)) return;
    change.mutate(next);
  };

  const cell = "border-b border-gray-6 px-3 py-2 align-middle";

  return (
    <tr>
      <td className={cn(cell, "break-all text-gray-12")}>{u.email}</td>
      <td className={cn(cell, "text-gray-11")}>{fullName(u)}</td>
      <td className={cell}>
        <div className="flex w-40 items-center gap-2">
          <Select value={u.role} onValueChange={onRoleChange} disabled={isSelf || change.isPending}>
            <SelectTrigger
              size="sm"
              aria-label={`Role for ${u.email}`}
              title={isSelf ? "You can't change your own role" : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {change.isPending && (
            <Loader2 className="size-4 shrink-0 animate-spin text-gray-11" aria-hidden />
          )}
        </div>
      </td>
      <td className={cell}>
        <span
          className={cn(
            "whitespace-nowrap rounded-full border px-2 py-0.5 text-xs",
            u.plan === "PRO" ? "border-principal-8 text-principal-11" : "border-gray-6 text-gray-11",
          )}
        >
          {u.plan === "PRO" ? "Pro" : "Free"}
        </span>
      </td>
      <td className={cn(cell, "whitespace-nowrap text-gray-11")}>{formatDate(u.createdAt)}</td>
      <td className={cn(cell, "whitespace-nowrap text-gray-11")}>
        {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}
      </td>
    </tr>
  );
}
