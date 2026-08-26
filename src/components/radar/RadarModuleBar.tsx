"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  ChevronUp,
  CircleDollarSign,
  Crosshair,
  GripVertical,
  LineChart,
  Target,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { getPortfolioAnalytics, type PortfolioAnalytics } from "@/lib/api/analytics";
import { getWallets, type Wallet as WalletModel } from "@/lib/api/wallets";
import { getDiscordSourcesAnalytics } from "@/lib/api/sources";
import { formatCompactUsd, formatPct, formatSignedUsd, signOf } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MetricTooltip } from "@/components/radar/MetricTooltip";

type Tone = "green" | "red" | "neutral";

interface ModuleChip {
  key: string;
  icon: LucideIcon;
  title: string;
  value: string;
  tone: Tone;
  /** Alça de arraste (chips reordenáveis, exceto o seletor de carteiras). */
  grip?: boolean;
  /** Abre o tooltip de detalhamento ao clicar. */
  hasTooltip?: boolean;
}

function toneClass(tone: Tone): string {
  return tone === "green"
    ? "text-green-11"
    : tone === "red"
      ? "text-vermelho-11"
      : "text-gray-11";
}

/** Um chip de módulo: [alça] + ícone + (título / valor). Arrastável p/ reordenar. */
function ModuleChipItem({
  chip,
  active,
  onClick,
  draggable,
  dragging,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
  menu,
}: {
  chip: ModuleChip;
  active?: boolean;
  onClick?: (el: HTMLButtonElement) => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnter?: () => void;
  onDrop?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  /** Mostra o chevron de menu (dropdown) — usado no seletor de carteiras. */
  menu?: boolean;
}) {
  const { icon: Icon, title, value, tone, grip } = chip;
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick ? (e) => onClick(e.currentTarget) : undefined}
      aria-expanded={chip.hasTooltip || menu ? active : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg border bg-gray-2 px-2 py-1.5 text-left transition-[opacity,border-color,transform]",
        active ? "border-gray-8" : "border-gray-6 hover:border-gray-8",
        dragging && "scale-[0.97] opacity-40",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {grip && (
          <GripVertical className="size-3.5 shrink-0 cursor-grab text-gray-8" strokeWidth={1.75} />
        )}
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-gray-6 bg-gray-2">
          <Icon className="size-3.5 text-gray-11" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col justify-center whitespace-nowrap text-[11px] leading-tight">
          <span className="text-gray-11">{title}</span>
          <span className={cn("truncate font-semibold", toneClass(tone))}>{value}</span>
        </div>
      </div>
      {menu && (
        <ChevronUp
          className={cn("size-3.5 shrink-0 text-gray-11 transition-transform", active && "rotate-180")}
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}

/** Métricas do agregado das carteiras → chips (dados do dashboard). */
function buildMetricChips(a: PortfolioAnalytics, topSourceName: string | null): ModuleChip[] {
  return [
    {
      key: "net",
      icon: CircleDollarSign,
      title: "Resultado líquido",
      value: formatSignedUsd(a.netPnlUsd),
      tone: signOf(a.netPnlUsd) < 0 ? "red" : "green",
      grip: true,
      hasTooltip: true,
    },
    {
      key: "win",
      icon: Target,
      title: "Taxa de acerto",
      value: formatPct(a.winRate.winRatePct, 1),
      tone: "green",
      grip: true,
      hasTooltip: true,
    },
    {
      key: "top",
      icon: Crosshair,
      title: "Aproveitamento do topo",
      value:
        a.peaks.available && a.peaks.topCapturePct != null
          ? formatPct(a.peaks.topCapturePct)
          : "—",
      tone: "green",
      grip: true,
      hasTooltip: true,
    },
    {
      key: "dd",
      icon: TrendingDown,
      title: "Maior Drawdown",
      value:
        a.bankroll.maxDrawdownPct != null
          ? formatPct(Math.abs(a.bankroll.maxDrawdownPct))
          : "—",
      tone: "red",
      grip: true,
      hasTooltip: true,
    },
    {
      key: "vol",
      icon: BarChart3,
      title: "Volume operado",
      value: formatCompactUsd(a.volumeUsd),
      tone: "green",
      grip: true,
      hasTooltip: true,
    },
    {
      key: "src",
      icon: LineChart,
      title: "Fonte mais lucrativa",
      value: topSourceName ?? "—",
      tone: "green",
      grip: true,
      hasTooltip: true,
    },
  ];
}

/** Encurta um endereço on-chain para exibição. */
function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

/** Item do dropdown de carteiras (rótulo + subtítulo + check quando ativo). */
function WalletMenuItem({
  label,
  sub,
  selected,
  onSelect,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-3"
    >
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-gray-12">{label}</span>
        <span className="truncate text-xs text-gray-11">{sub}</span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-principal-11" strokeWidth={2} />}
    </button>
  );
}

/**
 * Dropdown (abre p/ cima) do seletor de carteiras: "Todas" + cada carteira. A
 * escolha reescopa os dados do footer (agregado ↔ carteira específica).
 */
function WalletMenu({
  wallets,
  selectedId,
  onSelect,
}: {
  wallets: WalletModel[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="w-64 overflow-hidden rounded-lg rounded-bl-sm border border-gray-6 bg-gray-2 py-1 shadow-2xl shadow-black/40">
      <div className="max-h-72 overflow-y-auto">
        <WalletMenuItem
          label="Todas as carteiras"
          sub={`${wallets.length} ${wallets.length === 1 ? "carteira" : "comparadas"}`}
          selected={selectedId === null}
          onSelect={() => onSelect(null)}
        />
        {wallets.map((w) => (
          <WalletMenuItem
            key={w.id}
            label={w.label?.trim() || shortAddr(w.address)}
            sub={w.chain.toLowerCase()}
            selected={selectedId === w.id}
            onSelect={() => onSelect(w.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Chave da ordem dos chips (drag-and-drop) persistida no navegador. */
const ORDER_KEY = "radar:moduleOrder";

/** Lê a ordem salva (guardado p/ SSR/bloqueio). [] = usa a ordem padrão. */
function readOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
  } catch {
    // ignora leitura inválida/bloqueada
  }
  return [];
}

/**
 * Barra inferior do Radar (node Figma 748:26066) — substitui o footer. Puxa os
 * dados REAIS do agregado das carteiras do usuário (mesma fonte do dashboard):
 * seletor "Todas as carteiras / N comparadas" + métricas. Clicar num chip com
 * tooltip abre o detalhamento (nodes 684:14377 etc.) num popover acima do chip.
 * Os chips de métrica são reordenáveis por drag-and-drop (ordem salva localmente).
 */
export function RadarModuleBar() {
  const walletsQuery = useQuery({ queryKey: ["wallets"], queryFn: getWallets });
  const wallets = walletsQuery.data ?? [];
  const walletCount = wallets.length;

  // Carteira escolhida no seletor (`null` = agregado "Todas"). Reescopa os dados.
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  // Métricas — agregado (walletId null) ou carteira específica. Mesma chave/janela
  // do dashboard (compartilha cache). Só quando há carteira.
  const analyticsQuery = useQuery({
    queryKey: ["portfolio-analytics", "D30", selectedWalletId],
    queryFn: () => getPortfolioAnalytics("D30", selectedWalletId),
    enabled: walletCount > 0,
    retry: false,
  });
  const a = analyticsQuery.data;

  // Fonte de alpha mais lucrativa (mesmo escopo). Cross-ref trades×calls do
  // Discord — pode vir vazio (sem cobertura) → chip mostra "—".
  const sourcesQuery = useQuery({
    queryKey: ["discord-sources-analytics", "D30", selectedWalletId],
    queryFn: () => getDiscordSourcesAnalytics("D30", selectedWalletId),
    enabled: walletCount > 0,
    retry: false,
  });
  const topSourceName = useMemo(() => {
    const list = sourcesQuery.data;
    if (!list || list.length === 0) return null;
    const best = list.reduce((a, b) => (Number(b.pnlUsd) > Number(a.pnlUsd) ? b : a));
    return Number(best.pnlUsd) > 0 ? best.name : null;
  }, [sourcesQuery.data]);

  // Popovers (fixed → escapam o overflow-x da barra): tooltip de métrica e o
  // dropdown de carteiras. Só um aberto por vez.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const [walletMenu, setWalletMenu] = useState<{ left: number; bottom: number } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toggleTooltip = (key: string, el: HTMLButtonElement) => {
    setWalletMenu(null);
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    const r = el.getBoundingClientRect();
    // Ancora acima do chip; clampa às bordas p/ não sair da viewport.
    const left = Math.min(r.left, window.innerWidth - 320 - 8);
    setPos({ left: Math.max(8, left), bottom: window.innerHeight - r.top + 8 });
    setOpenKey(key);
  };

  const toggleWalletMenu = (el: HTMLButtonElement) => {
    setOpenKey(null);
    if (walletMenu) {
      setWalletMenu(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setWalletMenu({ left: r.left, bottom: window.innerHeight - r.top + 8 });
  };

  // Fecha ao clicar fora ou Esc. (Cliques nos chips são tratados nos toggles.)
  useEffect(() => {
    if (!openKey && !walletMenu) return;
    const closeAll = () => {
      setOpenKey(null);
      setWalletMenu(null);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!tipRef.current?.contains(t) && !menuRef.current?.contains(t)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    // `mousedown` fecharia ao reclicar o mesmo chip antes do onClick; adiamos o
    // listener p/ não colidir com os toggles.
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openKey, walletMenu]);

  // Ordem dos chips (drag-and-drop) persistida no navegador.
  const [order, setOrder] = useState<string[]>(readOrder);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragKey = useRef<string | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      // ignora escrita bloqueada/cota
    }
  }, [order]);

  // Seletor: reflete a carteira escolhida (ou "Todas").
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) ?? null;
  const selector: ModuleChip = {
    key: "wallets",
    icon: Wallet,
    title: selectedWallet ? selectedWallet.label?.trim() || shortAddr(selectedWallet.address) : "Todas as carteiras",
    value: selectedWallet
      ? selectedWallet.chain.toLowerCase()
      : `${walletCount} ${walletCount === 1 ? "comparada" : "comparadas"}`,
    tone: "neutral",
  };
  const metrics = a ? buildMetricChips(a, topSourceName) : [];

  // Reconcilia a ordem salva com os chips atuais (novos vão p/ o fim; removidos
  // somem) → tolera adicionar/ocultar chips sem quebrar a ordem persistida.
  const byKey = new Map(metrics.map((c) => [c.key, c]));
  const known = order.filter((k) => byKey.has(k));
  const rest = metrics.map((c) => c.key).filter((k) => !known.includes(k));
  const orderedMetrics = [...known, ...rest]
    .map((k) => byKey.get(k))
    .filter((c): c is ModuleChip => Boolean(c));

  const handleDragStart = (key: string) => (e: React.DragEvent<HTMLButtonElement>) => {
    dragKey.current = key;
    setDraggingKey(key);
    setOpenKey(null); // fecha tooltip aberto ao começar a arrastar
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", key); // Firefox exige um dado no dragstart
    } catch {
      // ignora
    }
    document.body.style.cursor = "grabbing";
  };
  // Reordena AO VIVO ao passar por cima de outro chip (feedback imediato).
  const handleDragEnter = (targetKey: string) => () => {
    const from = dragKey.current;
    if (!from || from === targetKey) return;
    const full = orderedMetrics.map((c) => c.key);
    const arr = full.filter((k) => k !== from);
    arr.splice(arr.indexOf(targetKey), 0, from);
    setOrder(arr);
  };
  const handleDragEnd = () => {
    dragKey.current = null;
    setDraggingKey(null);
    document.body.style.cursor = "";
  };

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto border-t border-gray-6 bg-gray-1 px-6">
      <ModuleChipItem
        chip={selector}
        menu
        active={walletMenu != null}
        onClick={(el) => toggleWalletMenu(el)}
      />
      <span className="h-6 w-px shrink-0 rounded-full bg-gray-6" aria-hidden />

      {analyticsQuery.isLoading && walletCount > 0 ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-40 shrink-0 animate-pulse rounded-lg border border-gray-6 bg-gray-2" />
        ))
      ) : (
        orderedMetrics.map((chip) => (
          <ModuleChipItem
            key={chip.key}
            chip={chip}
            active={openKey === chip.key}
            onClick={chip.hasTooltip ? (el) => toggleTooltip(chip.key, el) : undefined}
            draggable
            dragging={draggingKey === chip.key}
            onDragStart={handleDragStart(chip.key)}
            onDragEnter={handleDragEnter(chip.key)}
            onDrop={(e) => e.preventDefault()}
            onDragEnd={handleDragEnd}
          />
        ))
      )}

      {/* Popover do detalhamento (fixed → escapa o overflow-x da barra). */}
      {openKey && pos && a && (
        <div ref={tipRef} className="fixed z-50" style={{ left: pos.left, bottom: pos.bottom }}>
          <MetricTooltip
            metricKey={openKey}
            data={a}
            sources={sourcesQuery.data}
            onClose={() => setOpenKey(null)}
          />
        </div>
      )}

      {/* Dropdown de carteiras (abre p/ cima). */}
      {walletMenu && (
        <div ref={menuRef} className="fixed z-50" style={{ left: walletMenu.left, bottom: walletMenu.bottom }}>
          <WalletMenu
            wallets={wallets}
            selectedId={selectedWalletId}
            onSelect={(id) => {
              setSelectedWalletId(id);
              setWalletMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
