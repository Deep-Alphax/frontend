"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  LayoutGrid,
  Pin,
  Plus,
  QrCode,
  Search,
  SlidersHorizontal,
  Star,
  Upload,
  Users,
  X,
} from "lucide-react";

import { Topbar } from "@/components/home/Topbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { KolProfileModal } from "@/components/walletReader/KolProfileModal";
import { SquadsManagerModal } from "@/components/walletReader/SquadsManagerModal";
import { AddKolModal } from "@/components/walletReader/AddKolModal";
import { KolCard } from "@/components/walletReader/KolCard";
import { KOL_TIERS, KOL_TYPES } from "@/lib/walletReader/types";
import type { KolIndexParams } from "@/lib/api/walletReader";

/** Chave de seleção de carteira (kolId|address). `squads` viaja junto porque a
 * tela não carrega mais o KOL inteiro — só a página que está mostrando. */
type SelWallet = { kolId: string; address: string; name: string; squads: string[] };

type SortMode = "relevance" | "name" | "wallets" | "tier";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "relevance", label: "Relevância ↓" },
  { value: "name", label: "Nome A–Z" },
  { value: "wallets", label: "Nº de carteiras ↓" },
  { value: "tier", label: "Categoria ↓" },
];

/** Ícone do X (Twitter) — a lucide não traz o mark novo; SVG inline do logo oficial. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

/** Recortes rápidos da rail (exclusivos entre si). */
type ViewId = "all" | "unclassified" | "alphaUp" | "noTwitter" | "pendingScan";

const QUICK_VIEWS: { id: ViewId; label: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  { id: "all", label: "Todos", Icon: (p) => <LayoutGrid {...p} strokeWidth={1.75} /> },
  { id: "unclassified", label: "Falta classificar", Icon: (p) => <Pin {...p} strokeWidth={1.75} /> },
  { id: "alphaUp", label: "Alpha e acima", Icon: (p) => <Star {...p} strokeWidth={1.75} /> },
  { id: "noTwitter", label: "Sem Twitter", Icon: (p) => <XIcon {...p} /> },
  { id: "pendingScan", label: "Varredura pendente", Icon: (p) => <QrCode {...p} strokeWidth={1.75} /> },
];

/** Item de recorte rápido da rail (ícone em caixa + rótulo + contagem). */
function QuickView({
  label,
  count,
  active,
  onClick,
  children,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border py-1 pl-1 pr-2 transition-colors",
        active
          ? "border-principal-8 bg-principal-3"
          : "border-transparent hover:bg-gray-2",
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded border",
          active
            ? "border-principal-8 bg-principal-5 text-principal-12"
            : "border-gray-6 bg-gray-3 text-gray-11",
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-left text-xs",
          active ? "text-gray-12" : "text-gray-11",
        )}
      >
        {label}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-principal-11">{count}</span>
    </button>
  );
}

/** Seção recolhível de filtros da rail. */
function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-11 transition-colors hover:text-gray-12"
      >
        {title}
        <ChevronDown
          className={cn("size-5 shrink-0 transition-transform", open ? "rotate-0" : "-rotate-90")}
          strokeWidth={1.75}
        />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

/** Linha de checkbox da rail (rótulo + contagem). */
function FilterCheck({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-secundaria-11/40",
            checked ? "border-principal-9 bg-principal-9 text-gray-1" : "border-gray-6",
          )}
        >
          {checked && <Check className="size-3.5" strokeWidth={3} />}
        </span>
        <span className={cn("min-w-0 truncate text-sm", checked ? "text-gray-12" : "text-gray-11")}>
          {label}
        </span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-principal-11">{count}</span>
    </label>
  );
}

/**
 * KOLs (ex-Wallet Reader) — node Figma 833:16987: app-shell de altura total com
 * Topbar + rail de filtros (203px) + área principal (cabeçalho com contagem,
 * busca e CTA + grade de cards). Índice, filtros e contagens vêm paginados do
 * servidor (`useKolIndex`); a rail só desenha as facetas que ele devolveu.
 */
export function WalletReaderScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [squadsOpen, setSquadsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelWallet>>(() => new Map());
  const importRef = useRef<HTMLInputElement | null>(null);

  // Busca com debounce: cada tecla agora seria uma consulta ao servidor.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [view, setView] = useState<ViewId>("all");
  const [sort, setSort] = useState<SortMode>("relevance");
  const [tiers, setTiers] = useState<Set<string>>(() => new Set());
  const [types, setTypes] = useState<Set<string>>(() => new Set());
  const [squadsF, setSquadsF] = useState<Set<string>>(() => new Set());

  // Os filtros viram a CHAVE da query — trocar um refaz a consulta no servidor.
  const params = useMemo<KolIndexParams>(
    () => ({
      search,
      view,
      sort,
      tiers: Array.from(tiers).sort(),
      types: Array.from(types).sort(),
      squads: Array.from(squadsF).sort(),
    }),
    [search, view, sort, tiers, types, squadsF],
  );

  const index = useKolIndex(params);
  const {
    loaded,
    items,
    total,
    counts,
    viewCounts,
    squads,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    addKol,
    exportBackup,
    importBackup,
    reset,
  } = index;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  // Rolagem infinita: o servidor pagina, a tela pede a próxima ao chegar no fim.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isSelected = (kolId: string, address: string) => selected.has(kolId + "|" + address);
  const toggleSelect = (
    kolId: string,
    w: { name: string; address: string },
    squadsOf: string[] = [],
  ) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = kolId + "|" + w.address;
      if (next.has(key)) next.delete(key);
      else next.set(key, { kolId, address: w.address, name: w.name, squads: squadsOf });
      return next;
    });
  };

  const stepProfile = (dir: 1 | -1) => {
    if (!openId || items.length === 0) return;
    const ids = items.map((s) => s.id);
    let i = ids.indexOf(openId);
    if (i === -1) i = 0;
    setOpenId(ids[(i + dir + ids.length) % ids.length]);
  };

  /** Payload das carteiras selecionadas no formato do wallets.txt (com grupos). */
  const buildSelectionPayload = () => {
    const arr = Array.from(selected.values()).map(({ address, name, squads: sq }) => ({
      trackedWalletAddress: address,
      name,
      emoji: "🔔",
      alertsOnToast: true,
      alertsOnBubble: true,
      alertsOnFeed: true,
      groups: Array.from(new Set(["Main", ...sq])),
      sound: "default",
    }));
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
        void importBackup(JSON.parse(String(e.target?.result ?? "{}")));
      } catch {
        // arquivo inválido — silencioso
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-1">
      <Topbar />

      <div className="relative flex min-h-0 flex-1">
        {filtersOpen && (
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={() => setFiltersOpen(false)}
            className="fixed inset-0 z-30 bg-gray-1/70 lg:hidden"
          />
        )}

        <aside
          className={cn(
            "z-40 flex w-[203px] shrink-0 flex-col overflow-y-auto border-r border-gray-6 bg-gray-1 transition-transform max-lg:fixed max-lg:inset-y-0 max-lg:left-0",
            filtersOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-6 px-3 py-2 lg:hidden">
            <span className="text-sm text-gray-11">Filtros</span>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Fechar filtros"
              className="text-gray-11 transition-colors hover:text-gray-12"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex flex-col gap-1 border-b border-gray-6 p-3">
            {QUICK_VIEWS.map(({ id, label, Icon }) => (
              <QuickView
                key={id}
                label={label}
                count={viewCounts[id] ?? 0}
                active={view === id}
                onClick={() => setView(id)}
              >
                <Icon className="size-3.5" />
              </QuickView>
            ))}
          </div>

          <FilterSection title="Relevância">
            {KOL_TIERS.slice().reverse().map((t) => (
              <FilterCheck
                key={t.id}
                label={t.label}
                count={counts.byTier[t.id] ?? 0}
                checked={tiers.has(t.id)}
                onChange={() => toggle(tiers, setTiers, t.id)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Tipo de trader">
            {KOL_TYPES.map((t) => (
              <FilterCheck
                key={t.id}
                label={t.label}
                count={counts.byType[t.id] ?? 0}
                checked={types.has(t.id)}
                onChange={() => toggle(types, setTypes, t.id)}
              />
            ))}
          </FilterSection>

          {/* Uma faceta só: o servidor já devolve em `squads` tanto os do preset
              quanto os que o usuário criou na conta dele. */}
          {squads.length > 0 && (
            <FilterSection title="Squads" defaultOpen={false}>
              {squads.map((s) => (
                <FilterCheck
                  key={s}
                  label={s}
                  count={counts.bySquad[s] ?? 0}
                  checked={squadsF.has(s)}
                  onChange={() => toggle(squadsF, setSquadsF, s)}
                />
              ))}
            </FilterSection>
          )}

          <div className="mt-auto flex flex-col gap-2 border-t border-gray-6 p-3">
            <div className="flex flex-col gap-1 text-xs text-gray-11">
              <span id="kols-sort-label">Ordenar por</span>
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger size="sm" aria-labelledby="kols-sort-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={() => setSquadsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-xs font-medium text-gray-12 transition-colors hover:border-gray-8"
            >
              <Users className="size-4" strokeWidth={1.75} /> Squads
            </button>
            <button
              type="button"
              onClick={async () =>
                downloadFile(
                  "kol-index-backup.json",
                  JSON.stringify(await exportBackup(), null, 2),
                  "application/json",
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-xs font-medium text-gray-11 transition-colors hover:border-gray-8 hover:text-gray-12"
            >
              <Download className="size-4" strokeWidth={1.75} /> Exportar backup
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-xs font-medium text-gray-11 transition-colors hover:border-gray-8 hover:text-gray-12"
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
                if (
                  window.confirm(
                    "Isso apaga TODAS as edições e grupos da SUA conta (o preset global não é tocado). Exporte um backup antes. Continuar?",
                  )
                )
                  reset();
              }}
              className="rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-xs font-medium text-gray-11 transition-colors hover:border-vermelho-7 hover:text-vermelho-11"
            >
              Limpar edições
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-y-2.5 border-b border-gray-6 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-label="Abrir filtros"
                className="flex items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-2 px-3 py-1.5 text-sm text-gray-11 transition-colors hover:text-gray-12 lg:hidden"
              >
                <SlidersHorizontal className="size-4" strokeWidth={1.75} /> Filtros
              </button>
              <h1 className="text-base text-gray-11 tabular-nums">
                {total.toLocaleString("pt-BR")} KOLs
              </h1>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-11"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Busque aqui..."
                  aria-label="Buscar KOL"
                  className="h-10 w-full max-w-[345px] rounded-lg border border-gray-6 bg-transparent pl-10 pr-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus-visible:border-secundaria-11/60 sm:w-[345px]"
                />
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-principal-9 px-5 text-base font-semibold text-gray-1 transition-colors hover:bg-principal-10"
              >
                <Plus className="size-5" strokeWidth={2} />
                <span className="max-sm:sr-only">Adicionar KOL</span>
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {!loaded ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-[295px] animate-pulse rounded-lg border border-gray-6 bg-gray-2" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 px-6 py-16 text-center">
                <p className="text-sm font-semibold text-gray-12">Nenhum KOL encontrado</p>
                <p className="max-w-sm text-xs text-gray-11">Ajuste a busca ou os filtros.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                  {items.map((s) => (
                    <KolCard key={s.id} kol={s} onOpen={() => setOpenId(s.id)} />
                  ))}
                </div>
                {/* Gatilho da próxima página — só existe enquanto houver mais. */}
                {hasNextPage && (
                  <div ref={sentinel} className="flex justify-center py-6">
                    <span className="text-xs text-gray-11">
                      {isFetchingNextPage ? "Carregando mais…" : " "}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {selected.size > 0 && (
        <div className="z-40 flex flex-wrap items-center gap-3 border-t border-gray-6 bg-gray-2/95 px-6 py-3 backdrop-blur">
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
      <SquadsManagerModal
        open={squadsOpen}
        onClose={() => setSquadsOpen(false)}
        index={index}
        onOpenProfile={(id) => {
          setSquadsOpen(false);
          setOpenId(id);
        }}
      />
      <AddKolModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={async (name, wallet) => {
          const id = await addKol(name, wallet);
          setAddOpen(false);
          if (id) setOpenId(id);
        }}
      />
    </div>
  );
}
