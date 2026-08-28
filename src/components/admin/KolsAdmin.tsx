"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, RotateCcw, Search, Trash2, X } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/client";
import {
  createKolPreset,
  deleteKolPreset,
  getKolPresetAdmin,
  getKolPresetOne,
  restoreKolPreset,
  updateKolPreset,
  type KolPresetAdminEntry,
  type KolPresetAdminPage,
  type KolPresetListItem,
  type KolPresetPatch,
} from "@/lib/api/walletReader";
import { KOL_INDEX_KEY } from "@/lib/walletReader/useKolIndex";
import { fileToAvatar } from "@/lib/walletReader/avatar";
import {
  KOL_TYPES,
  KOL_TYPE_MAP,
  memeAvatarFor,
  tierFor,
  type WalletRef,
} from "@/lib/walletReader/types";
import { Modal } from "@/components/walletReader/Modal";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";

/** Chave da query do preset visto pelo admin (inclui os removidos). */
export const KOL_PRESET_ADMIN_KEY = ["kol-preset-admin"] as const;

/** Itens por página do preset. */
const PAGE = 60;

/** Rascunho do formulário — espelha os campos editáveis do preset. */
interface Draft {
  name: string;
  relevance: number;
  types: string[];
  twitter: string;
  notes: string;
  squads: string;
  avatar: string | null;
  wallets: WalletRef[];
}

function draftFrom(k: KolPresetAdminEntry | null): Draft {
  return {
    name: k?.name ?? "",
    relevance: k?.relevance ?? 20,
    types: k?.types ?? [],
    twitter: k?.twitter ?? "",
    notes: k?.notes ?? "",
    squads: (k?.squads ?? []).join(", "),
    avatar: k?.avatar ?? null,
    wallets: k?.wallets ?? [],
  };
}

function draftToPatch(d: Draft): KolPresetPatch & { name: string } {
  return {
    name: d.name.trim(),
    relevance: d.relevance,
    types: d.types,
    twitter: d.twitter.trim().replace(/^@/, ""),
    notes: d.notes,
    squads: d.squads
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    avatar: d.avatar,
    wallets: d.wallets,
  };
}

/** Campo rotulado do formulário. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-11">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus-visible:border-secundaria-11/60";

/** Formulário de um KOL do preset (criar ou editar). */
function KolEditor({
  open,
  editing,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  editing: KolPresetAdminEntry | null;
  onClose: () => void;
  onSubmit: (patch: KolPresetPatch & { name: string }) => void;
  saving: boolean;
}) {
  // `key` no <Modal> reinicia o rascunho a cada KOL aberto.
  const [d, setD] = useState<Draft>(() => draftFrom(editing));
  const [wName, setWName] = useState("");
  const [wAddr, setWAddr] = useState("");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      set("avatar", await fileToAvatar(file));
    } catch {
      toast.error("Não foi possível ler a imagem.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${editing.name}` : "Adicionar KOL ao preset"}
      className="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-11">
            O que você salvar aqui aparece para <b className="text-gray-12">todos</b> os usuários.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-6 bg-gray-3 px-3 py-2 text-sm font-medium text-gray-11 transition-colors hover:text-gray-12"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || !d.name.trim()}
              onClick={() => onSubmit(draftToPatch(d))}
              className="rounded-lg bg-principal-9 px-4 py-2 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar preset"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Identidade */}
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={d.avatar || memeAvatarFor(editing?.id ?? "novo")}
            alt=""
            width={72}
            height={72}
            className="size-18 shrink-0 rounded-full border border-gray-6 object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Field label="Nome">
              <input
                className={inputCls}
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nome do KOL"
              />
            </Field>
            <div className="flex items-center gap-3 text-xs">
              <label className="cursor-pointer text-secundaria-11 underline underline-offset-2">
                trocar foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onUpload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {d.avatar && (
                <button
                  type="button"
                  onClick={() => set("avatar", null)}
                  className="text-gray-11 underline underline-offset-2 hover:text-gray-12"
                >
                  remover foto
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Relevância */}
        <Field label={`Relevância — ${d.relevance}/100 · ${tierFor(d.relevance).label}`}>
          <input
            type="range"
            min={0}
            max={100}
            value={d.relevance}
            onChange={(e) => set("relevance", Number(e.target.value))}
            className="w-full accent-[var(--color-principal-9)]"
          />
        </Field>

        {/* Tipos */}
        <Field label="Tipos de trader">
          <div className="flex flex-wrap gap-1.5">
            {KOL_TYPES.map((t) => {
              const on = d.types.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    set("types", on ? d.types.filter((x) => x !== t.id) : d.types.concat([t.id]))
                  }
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    on
                      ? "border-principal-8 bg-principal-3 text-principal-11"
                      : "border-gray-6 bg-gray-1 text-gray-11 hover:border-gray-8 hover:text-gray-12",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Twitter / X">
            <input
              className={inputCls}
              value={d.twitter}
              onChange={(e) => set("twitter", e.target.value)}
              placeholder="handle sem @"
            />
          </Field>
          <Field label="Squads (separados por vírgula)">
            <input
              className={inputCls}
              value={d.squads}
              onChange={(e) => set("squads", e.target.value)}
              placeholder="Lair, Pastel Alpha"
            />
          </Field>
        </div>

        <Field label="Notas">
          <textarea
            rows={3}
            className="w-full resize-y rounded-lg border border-gray-6 bg-gray-1 p-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus-visible:border-secundaria-11/60"
            value={d.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Contexto do KOL — visível para todos."
          />
        </Field>

        {/* Carteiras */}
        <Field label={`Carteiras (${d.wallets.length})`}>
          <div className="flex flex-col gap-1.5">
            {d.wallets.map((w, i) => (
              <div
                key={`${w.address}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-gray-6 bg-gray-1 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-gray-12">{w.name}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-11">
                  {w.address}
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${w.address}`}
                  onClick={() => set("wallets", d.wallets.filter((_, j) => j !== i))}
                  className="shrink-0 text-gray-11 transition-colors hover:text-vermelho-11"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                className={cn(inputCls, "h-9 w-32 shrink-0")}
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                placeholder="apelido"
              />
              <input
                className={cn(inputCls, "h-9 min-w-0 flex-1 font-mono text-xs")}
                value={wAddr}
                onChange={(e) => setWAddr(e.target.value)}
                placeholder="endereço on-chain"
              />
              <button
                type="button"
                onClick={() => {
                  const addr = wAddr.trim();
                  if (!addr || d.wallets.some((w) => w.address === addr)) return;
                  set("wallets", d.wallets.concat([{ name: wName.trim() || "Carteira", address: addr }]));
                  setWName("");
                  setWAddr("");
                }}
                className="h-9 shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-3 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
              >
                Adicionar
              </button>
            </div>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/**
 * Preset GLOBAL de KOLs. O que o admin salva aqui é o que todo usuário vê ao
 * abrir /wallet-reader; as edições que cada usuário faz por cima ficam na conta
 * dele e continuam vencendo o preset campo a campo.
 *
 * Gated por role no componente (cosmético) — quem autoriza de fato é o
 * `AdminGuard` do backend em `/wallet-reader/admin/*`.
 */
export function KolsAdmin() {
  const { profile, isAuthenticated, isLoading } = useSession();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [editing, setEditing] = useState<KolPresetListItem | null>(null);
  const [creating, setCreating] = useState(false);

  // Busca com debounce — agora cada tecla seria uma consulta ao banco.
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const {
    data,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [...KOL_PRESET_ADMIN_KEY, search],
    queryFn: ({ pageParam }) =>
      getKolPresetAdmin({ search, offset: pageParam, limit: PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last: KolPresetAdminPage, all: KolPresetAdminPage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: profile?.role === "ADMIN",
  });

  const filtered = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );
  const total = data?.pages[0]?.total ?? 0;

  /** Mudou o preset → o índice que os usuários leem está velho. */
  const afterWrite = () => {
    qc.invalidateQueries({ queryKey: KOL_PRESET_ADMIN_KEY });
    qc.invalidateQueries({ queryKey: KOL_INDEX_KEY });
  };

  const createMut = useMutation({
    mutationFn: createKolPreset,
    onSuccess: () => {
      setCreating(false);
      afterWrite();
      toast.success("KOL adicionado ao preset.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível criar o KOL.")),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: KolPresetPatch }) =>
      updateKolPreset(id, patch),
    onSuccess: () => {
      setEditing(null);
      afterWrite();
      toast.success("Preset atualizado para todos.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível salvar.")),
  });

  const removeMut = useMutation({
    mutationFn: deleteKolPreset,
    onSuccess: afterWrite,
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível remover.")),
  });

  const restoreMut = useMutation({
    mutationFn: restoreKolPreset,
    onSuccess: afterWrite,
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível restaurar.")),
  });

  // Virtualização: o preset inteiro vem numa lista só e cresce sem teto —
  // renderizar 276 linhas (e um dia milhares) no DOM é desperdício puro.
  // `@tanstack/react-virtual` já era dependência do projeto e não era usado.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rows = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,
    overscan: 8,
  });

  // Puxa a próxima página quando a virtualização chega perto do fim da lista.
  const lastVisible = rows.getVirtualItems().at(-1)?.index ?? 0;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && lastVisible >= filtered.length - 10) {
      void fetchNextPage();
    }
  }, [lastVisible, filtered.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-gray-2" aria-hidden />;
  }
  if (!isAuthenticated) {
    return <p className="text-gray-11">Faça login para acessar.</p>;
  }
  if (profile?.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-gray-6 bg-gray-2 p-6">
        <h1 className="text-lg font-semibold text-gray-12">Acesso restrito</h1>
        <p className="text-sm text-gray-11">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-12">Preset de KOLs</h1>
        <p className="text-sm text-gray-11">
          Esta é a lista que <b className="text-gray-12">todos</b> os usuários veem. Cada usuário
          pode editar um KOL na conta dele — essa edição vence o preset só para ele.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-11"
            strokeWidth={1.75}
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, squad ou endereço…"
            aria-label="Buscar KOL no preset"
            className={cn(inputCls, "pl-10")}
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
        >
          <Plus className="size-4" strokeWidth={2} /> Adicionar KOL
        </button>
      </div>

      <p className="text-xs text-gray-11 tabular-nums">
        {total.toLocaleString("pt-BR")} KOLs no preset
        {filtered.length < total && ` · ${filtered.length} carregados`}
      </p>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-2" />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-[65dvh] overflow-y-auto rounded-lg"
          role="list"
        >
          <div className="relative w-full" style={{ height: rows.getTotalSize() }}>
            {rows.getVirtualItems().map((v) => {
              const k = filtered[v.index];
              const tier = tierFor(k.relevance);
              const removed = Boolean(k.deletedAt);
              return (
                <div
                  key={k.id}
                  role="listitem"
                  ref={rows.measureElement}
                  data-index={v.index}
                  className="absolute left-0 top-0 w-full pb-1.5"
                  style={{ transform: `translateY(${v.start}px)` }}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-gray-6 bg-gray-2 px-3 py-2",
                      removed && "opacity-60",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={k.avatar || memeAvatarFor(k.id)}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-full border border-gray-6 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-sm font-semibold text-gray-12">
                        {k.name}
                        {removed && (
                          <span className="ml-2 text-xs font-normal text-vermelho-11">removido</span>
                        )}
                      </p>
                      <p className="min-w-0 truncate text-xs text-gray-11">
                        {k.walletCount} carteira{k.walletCount !== 1 ? "s" : ""}
                        {k.squads.length > 0 && ` · ${k.squads.join(", ")}`}
                        {k.types.length > 0 &&
                          ` · ${k.types.map((t) => KOL_TYPE_MAP[t]?.label ?? t).join(", ")}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                        tier.chipBg,
                        tier.chipBorder,
                        tier.text,
                      )}
                    >
                      {k.relevance} · {tier.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditing(k)}
                      className="shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-xs font-medium text-gray-12 transition-colors hover:bg-gray-4"
                    >
                      Editar
                    </button>
                    {removed ? (
                      <button
                        type="button"
                        aria-label={`Restaurar ${k.name}`}
                        onClick={() => restoreMut.mutate(k.id)}
                        className="shrink-0 text-gray-11 transition-colors hover:text-green-11"
                      >
                        <RotateCcw className="size-4" strokeWidth={1.75} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remover ${k.name} do preset`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remover "${k.name}" do preset? Ele some para TODOS os usuários (as edições de conta são preservadas).`,
                            )
                          )
                            removeMut.mutate(k.id);
                        }}
                        className="shrink-0 text-gray-11 transition-colors hover:text-vermelho-11"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {creating && (
        <KolEditor
          open
          editing={null}
          saving={createMut.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(patch) => createMut.mutate(patch)}
        />
      )}
      {editing && (
        <KolEditorLoader
          key={editing.id}
          id={editing.id}
          saving={updateMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(patch) => updateMut.mutate({ id: editing.id, patch })}
        />
      )}
    </div>
  );
}

/**
 * Busca o KOL COM as carteiras e só então monta o editor.
 *
 * A lista não traz mais os endereços — carregá-los para 60 KOLs só para exibir
 * uma contagem era a maior parte do payload da página.
 */
function KolEditorLoader({
  id,
  saving,
  onClose,
  onSubmit,
}: {
  id: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (patch: KolPresetPatch & { name: string }) => void;
}) {
  const { data } = useQuery({
    queryKey: ["kol-preset-one", id],
    queryFn: () => getKolPresetOne(id),
  });

  if (!data) {
    return (
      <Modal open onClose={onClose} title="Carregando…" className="max-w-2xl">
        <div className="h-64 animate-pulse bg-gray-2" aria-hidden />
      </Modal>
    );
  }
  return (
    <KolEditor
      open
      editing={data}
      saving={saving}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
