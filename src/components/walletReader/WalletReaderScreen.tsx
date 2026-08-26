"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, Download, Plus, Search, Upload, Users } from "lucide-react";

import { Topbar } from "@/components/home/Topbar";
import { Footer } from "@/components/home/Footer";
import { cn } from "@/lib/cn";
import { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { KolProfileModal } from "@/components/walletReader/KolProfileModal";
import { GroupsManagerModal } from "@/components/walletReader/GroupsManagerModal";
import { AddKolModal } from "@/components/walletReader/AddKolModal";
import {
  KOL_TIERS,
  KOL_TYPES,
  KOL_TYPE_MAP,
  avatarSrc,
  tierFor,
  type KolState,
} from "@/lib/walletReader/types";

/** Chave de seleção de carteira (kolId|address). */
type SelWallet = { kolId: string; address: string; name: string };

type SortMode = "relevance" | "name" | "wallets" | "tier";

/** Chip de filtro (toggle) — pílula com ponto colorido. */
function FilterChip({
  label,
  active,
  onClick,
  dotClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-principal-8 bg-principal-3 text-principal-11"
          : "border-gray-6 bg-gray-2 text-gray-11 hover:border-gray-8 hover:text-gray-12",
      )}
    >
      {dotClass && <span className={cn("size-2 shrink-0 rounded-full", dotClass)} />}
      {label}
    </button>
  );
}

/** Card de um KOL (node do app original, adaptado ao DS). */
function KolCard({ state, onOpen }: { state: KolState; onOpen: () => void }) {
  const tier = tierFor(state.relevance);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-lg border border-gray-6 bg-gray-2 p-4 text-left transition-colors hover:border-gray-8"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(state)}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 rounded-full border border-gray-6 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate font-semibold text-gray-12">{state.name}</p>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                tier.chipBg,
                tier.chipBorder,
                tier.text,
              )}
            >
              {tier.label}
            </span>
          </div>
          {state.squads.length > 0 && (
            <p className="truncate text-xs text-gray-11">{state.squads.join(" · ")}</p>
          )}
        </div>
      </div>

      {/* Barra de relevância */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-4">
        <span className={cn("block h-full rounded-full", tier.meter)} style={{ width: `${state.relevance}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-11">
        <span>
          <b className="text-gray-12">{state.relevance}</b>/100 relevância
        </span>
        <span>
          <b className="text-gray-12">{state.walletCount}</b> carteira{state.walletCount !== 1 ? "s" : ""}
        </span>
      </div>

      {state.twitter && (
        <p className="truncate text-xs text-secundaria-11">@{state.twitter.replace(/^@/, "")}</p>
      )}

      {/* Tipos */}
      <div className="flex flex-wrap gap-1.5">
        {state.types.length > 0 ? (
          <>
            {state.types.slice(0, 3).map((tid) => (
              <span key={tid} className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">
                {KOL_TYPE_MAP[tid]?.label ?? tid}
              </span>
            ))}
            {state.types.length > 3 && (
              <span className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">
                +{state.types.length - 3}
              </span>
            )}
          </>
        ) : (
          <span className="rounded-md border border-dashed border-gray-6 px-2 py-0.5 text-xs text-gray-9">
            sem tipo definido
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Wallet Reader (KOL Index) — porta do app standalone p/ o Deep Alpha (DS).
 * FASE 1: índice navegável (busca, ordenação, filtros por categoria/tipo/squad/
 * grupo, stats, cards). Perfil/edição, grupos, import/export e scan vêm a seguir.
 */
export function WalletReaderScreen() {
  const index = useKolIndex();
  const { loaded, states, profiles, groups, addKol, exportBackup, importBackup, reset } = index;

  const [openId, setOpenId] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelWallet>>(() => new Map());
  const importRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("relevance");
  const [tiers, setTiers] = useState<Set<string>>(() => new Set());
  const [types, setTypes] = useState<Set<string>>(() => new Set());
  const [squadsF, setSquadsF] = useState<Set<string>>(() => new Set());
  const [fnfF, setFnfF] = useState<Set<string>>(() => new Set());

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const squads = useMemo(
    () => Array.from(new Set(profiles.flatMap((p) => p.squads))).sort(),
    [profiles],
  );

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = states.filter((s) => {
      if (q) {
        const hay = (s.name + " " + s.wallets.map((w) => w.name + " " + w.address).join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tiers.size && !tiers.has(tierFor(s.relevance).id)) return false;
      if (types.size && !s.types.some((t) => types.has(t))) return false;
      if (squadsF.size && !s.squads.some((sq) => squadsF.has(sq))) return false;
      if (fnfF.size && !s.fnfGroups.some((g) => fnfF.has(g))) return false;
      return true;
    });
    const arr = list.slice();
    if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "wallets") arr.sort((a, b) => b.walletCount - a.walletCount);
    else if (sort === "tier")
      arr.sort(
        (a, b) =>
          KOL_TIERS.findIndex((t) => t.id === tierFor(b.relevance).id) -
            KOL_TIERS.findIndex((t) => t.id === tierFor(a.relevance).id) || b.relevance - a.relevance,
      );
    else arr.sort((a, b) => b.relevance - a.relevance);
    return arr;
  }, [states, q, tiers, types, squadsF, fnfF, sort]);

  const stats = useMemo(
    () => [
      { n: states.length, label: "KOLs na coleção" },
      { n: states.reduce((s, st) => s + st.walletCount, 0), label: "Carteiras rastreadas" },
      { n: states.filter((st) => st.types.length > 0).length, label: "Já classificados" },
      { n: states.filter((st) => st.twitter).length, label: "Com twitter" },
      { n: groups.length, label: "Grupos / FnFs" },
    ],
    [states, groups],
  );

  const isSelected = (kolId: string, address: string) => selected.has(kolId + "|" + address);
  const toggleSelect = (kolId: string, w: { name: string; address: string }) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = kolId + "|" + w.address;
      if (next.has(key)) next.delete(key);
      else next.set(key, { kolId, address: w.address, name: w.name });
      return next;
    });
  };

  const stepProfile = (dir: 1 | -1) => {
    if (!openId || filtered.length === 0) return;
    const ids = filtered.map((s) => s.id);
    let i = ids.indexOf(openId);
    if (i === -1) i = 0;
    setOpenId(ids[(i + dir + ids.length) % ids.length]);
  };

  /** Payload das carteiras selecionadas no formato do wallets.txt (com grupos). */
  const buildSelectionPayload = () => {
    const arr = Array.from(selected.values()).map(({ kolId, address, name }) => {
      const st = index.getState(kolId);
      const grp = Array.from(new Set(["Main", ...st.squads]));
      return {
        trackedWalletAddress: address,
        name,
        emoji: "🔔",
        alertsOnToast: true,
        alertsOnBubble: true,
        alertsOnFeed: true,
        groups: grp,
        sound: "default",
      };
    });
    return JSON.stringify(arr, null, 2);
  };

  const downloadFile = (filename: string, data: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        importBackup(JSON.parse(String(e.target?.result ?? "{}")));
      } catch {
        // arquivo inválido — silencioso
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />

      <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-8 md:px-12 lg:px-20">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-display-24 text-gray-12">Wallet Reader</h1>
          <p className="text-sm text-gray-11 tabular-nums">
            {filtered.length.toLocaleString("pt-BR")} de {states.length.toLocaleString("pt-BR")} KOLs
          </p>
        </div>

        {/* Busca + ordenação */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-11"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou endereço de carteira…"
              aria-label="Buscar KOL"
              className="h-11 w-full rounded-lg border border-gray-6 bg-gray-2 pl-10 pr-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus-visible:border-secundaria-11/60 focus-visible:ring-2 focus-visible:ring-secundaria-11/30"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Ordenar"
            className="h-11 rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm text-gray-12 outline-none focus-visible:border-secundaria-11/60"
          >
            <option value="relevance">Relevância ↓</option>
            <option value="name">Nome A–Z</option>
            <option value="wallets">Nº de carteiras ↓</option>
            <option value="tier">Categoria ↓</option>
          </select>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-6 bg-gray-2 p-3">
              <b className="text-lg font-semibold text-gray-12 tabular-nums">
                {s.n.toLocaleString("pt-BR")}
              </b>
              <p className="text-xs text-gray-11">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-11">Categoria</span>
            {KOL_TIERS.slice().reverse().map((t) => (
              <FilterChip
                key={t.id}
                label={t.label}
                active={tiers.has(t.id)}
                onClick={() => toggle(tiers, setTiers, t.id)}
                dotClass={t.meter}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-11">Tipo</span>
            {KOL_TYPES.map((t) => (
              <FilterChip
                key={t.id}
                label={t.label}
                active={types.has(t.id)}
                onClick={() => toggle(types, setTypes, t.id)}
              />
            ))}
          </div>
          {squads.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-11">Squad</span>
              {squads.map((s) => (
                <FilterChip key={s} label={s} active={squadsF.has(s)} onClick={() => toggle(squadsF, setSquadsF, s)} />
              ))}
            </div>
          )}
          {groups.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-11">Grupo</span>
              {groups.map((g) => (
                <FilterChip key={g.id} label={g.name} active={fnfF.has(g.id)} onClick={() => toggle(fnfF, setFnfF, g.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Ações / backup */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGroupsOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-sm font-medium text-gray-12 transition-colors hover:border-gray-8"
          >
            <Users className="size-4" strokeWidth={1.75} /> Grupos / FnFs
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-principal-9 px-3 py-1.5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            <Plus className="size-4" strokeWidth={2} /> Adicionar KOL
          </button>
          <span className="mx-1 h-5 w-px bg-gray-6" aria-hidden />
          <button
            type="button"
            onClick={() =>
              downloadFile("kol-index-backup.json", JSON.stringify(exportBackup(), null, 2), "application/json")
            }
            className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-sm font-medium text-gray-11 transition-colors hover:border-gray-8 hover:text-gray-12"
          >
            <Download className="size-4" strokeWidth={1.75} /> Exportar backup
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-sm font-medium text-gray-11 transition-colors hover:border-gray-8 hover:text-gray-12"
          >
            <Upload className="size-4" strokeWidth={1.75} /> Importar
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              onImportFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Isso apaga TODAS as edições salvas neste navegador. Exporte um backup antes. Continuar?"))
                reset();
            }}
            className="rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-sm font-medium text-gray-11 transition-colors hover:border-vermelho-7 hover:text-vermelho-11"
          >
            Limpar edições
          </button>
        </div>

        {/* Grid */}
        {!loaded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg border border-gray-6 bg-gray-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-12">Nenhum KOL encontrado</p>
            <p className="max-w-sm text-xs text-gray-11">Ajuste a busca ou os filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((s) => (
              <KolCard key={s.id} state={s} onOpen={() => setOpenId(s.id)} />
            ))}
          </div>
        )}
      </main>

      {/* Barra de seleção de carteiras (fixa no rodapé) */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 z-40 flex flex-wrap items-center gap-3 border-t border-gray-6 bg-gray-2/95 px-6 py-3 backdrop-blur md:px-12 lg:px-20">
          <span className="text-sm font-medium text-gray-12">
            {selected.size} carteira{selected.size !== 1 ? "s" : ""} selecionada{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(new Map())}
            className="rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm font-medium text-gray-11 transition-colors hover:text-gray-12"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(buildSelectionPayload())}
            className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            <Copy className="size-4" strokeWidth={1.75} /> Copiar
          </button>
          <button
            type="button"
            onClick={() => downloadFile("wallets-selecionadas.txt", buildSelectionPayload(), "text/plain")}
            className="flex items-center gap-1.5 rounded-lg bg-principal-9 px-3 py-1.5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            <Download className="size-4" strokeWidth={2} /> Exportar
          </button>
        </div>
      )}

      {openId && (
        <KolProfileModal
          key={openId}
          id={openId}
          index={index}
          onClose={() => setOpenId(null)}
          onStep={stepProfile}
          onOpenKol={(id) => setOpenId(id)}
          isSelected={isSelected}
          toggleSelect={toggleSelect}
        />
      )}
      <GroupsManagerModal
        open={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        index={index}
        onOpenProfile={(id) => {
          setGroupsOpen(false);
          setOpenId(id);
        }}
      />
      <AddKolModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(name, wallet) => {
          const id = addKol(name, wallet);
          setAddOpen(false);
          setOpenId(id);
        }}
      />

      <Footer />
    </div>
  );
}
