"use client";

import { memo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { CapturedMessage } from "@/lib/api/feed";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import { MoreChip, TokenChip } from "@/components/radar/TokenChip";
import { LinksModal } from "@/components/radar/LinksModal";

/** Máximo de chips exibidos antes do overflow "+N" (espelha o Figma: 4 + "+N"). */
const MAX_VISIBLE_CHIPS = 4;
/** Acima disto o texto ganha "Ler mais" (heurística: evita medir o DOM). */
const CLAMP_THRESHOLD = 220;

/** Formata ISO → { date: "13/08", time: "23:30" } (curto, pt-BR). */
function fmt(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  } catch {
    return { date: iso, time: "" };
  }
}

/** Subtítulo do card: "Grupo › #canal" (o que houver). */
function subtitle(m: CapturedMessage): string {
  if (m.guildName && m.channelName) return `${m.guildName} › #${m.channelName}`;
  if (m.guildName) return m.guildName;
  if (m.channelName) return `#${m.channelName}`;
  return m.channelId;
}

/** Data + divisor + hora (header no card wide, rodapé no compact). */
function DateInfo({ iso, small }: { iso: string; small?: boolean }) {
  const { date, time } = fmt(iso);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap text-gray-11",
        small ? "text-xs" : "text-sm",
      )}
    >
      <time dateTime={iso}>{date}</time>
      <span className="h-px w-1.5 bg-gray-6" aria-hidden />
      <span>{time}</span>
    </div>
  );
}

interface RadarMessageCardProps {
  m: CapturedMessage;
  isNew?: boolean;
  /** Variante compacta dos painéis laterais (perfil/favoritos). */
  compact?: boolean;
  /** Variante destacada (node 491:7505) — cards do perfil em análise. */
  highlighted?: boolean;
  /**
   * Habilita o refluxo animado (`layout`) do framer. Só no feed central (a página
   * rola). Em listas virtualizadas NÃO deve ligar — conflita com o `translateY`
   * da virtualização e desalinha o card.
   */
  animateLayout?: boolean;
  /** Seleciona o autor (abre o perfil). Recebe a tag (identidade) + exibição. */
  onSelectAuthor?: (authorTag: string, authorName: string) => void;
}

function RadarMessageCardBase({
  m,
  isNew = false,
  compact = false,
  highlighted = false,
  animateLayout = false,
  onSelectAuthor,
}: RadarMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const reduce = useReducedMotion();

  // Só anima capturas que chegaram em tempo real (socket). Load inicial e
  // paginação renderizam sem animação — evita "tempestade" de entrada.
  const animateIn = isNew && !reduce;

  const author = m.authorTag || "Desconhecido";
  const text = m.text ?? "";
  const isLong = text.length > CLAMP_THRESHOLD || text.split("\n").length > 6;

  const links = m.links ?? [];
  const visibleChips = links.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = links.length - visibleChips.length;
  const hasChips = links.length > 0;

  // Identidade = authorTag (presente em 100% das capturas → todo card clicável).
  const selectable = Boolean(onSelectAuthor && m.authorTag);
  const select = () => {
    if (m.authorTag) onSelectAuthor?.(m.authorTag, author);
  };
  // Clique no card abre o perfil — exceto quando o alvo é um controle (link,
  // botão, "Ler mais", chips, "+N"), que mantêm seu próprio comportamento.
  const onCardClick = (e: React.MouseEvent) => {
    if (!selectable) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    select();
  };

  // Tokens de tamanho por variante (wide = feed central; compact = laterais).
  const padX = compact ? "px-3" : "px-4";

  return (
    <motion.article
      // `layout` só quando explicitamente habilitado (feed central). Em listas
      // virtualizadas/scroll interno ele desalinha o card — mantido desligado.
      layout={animateLayout && !reduce ? "position" : false}
      initial={animateIn ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.emphasis, ease: EASE.out }}
      onClick={onCardClick}
      className={cn(
        "relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg border",
        highlighted ? "border-gray-7 bg-gray-3" : "border-gray-6 bg-gray-2",
        selectable && "cursor-pointer transition-colors hover:border-gray-8",
      )}
    >
      {/* Cabeçalho: avatar + autor/grupo (+ data no wide) */}
      <header
        className={cn(
          "flex items-center gap-2",
          compact ? "p-3" : "justify-between px-4 py-3",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={author} className={compact ? "size-7" : "size-8"} />
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-semibold leading-tight text-gray-12",
                compact ? "text-sm" : "text-base",
              )}
            >
              {author}
            </p>
            <p
              className={cn(
                "truncate leading-tight text-gray-11",
                compact ? "text-xs" : "text-sm",
              )}
            >
              {subtitle(m)}
            </p>
          </div>
        </div>
        {!compact && <DateInfo iso={m.createdAt} />}
      </header>

      {/* Corpo: texto (medium 14) + "Ler mais" */}
      {text && (
        <div className={cn("flex w-full min-w-0 flex-col items-start gap-1 pt-1", padX, hasChips || compact ? "pb-2" : "pb-4")}>
          <p
            className={cn(
              // `overflow-wrap:anywhere` quebra strings longas sem espaço
              // (contratos/URLs) para não estourar a largura do card.
              "w-full min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
              "text-sm font-medium leading-snug text-gray-12",
              !expanded && isLong && "line-clamp-5",
            )}
          >
            {text}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-sm text-gray-11 underline underline-offset-2 hover:text-gray-12"
            >
              {expanded ? "Ver menos" : "Ler mais"}
            </button>
          )}
        </div>
      )}

      {/* Chips de token/link */}
      {hasChips && (
        <div className={cn("flex w-full min-w-0 flex-wrap content-start items-start gap-2 pt-2 pb-2", padX)}>
          {visibleChips.map((l) => (
            <TokenChip key={l} link={l} compact={compact} />
          ))}
          {hiddenCount > 0 && (
            <MoreChip count={hiddenCount} compact={compact} onClick={() => setLinksOpen(true)} />
          )}
        </div>
      )}

      {/* Rodapé com data (só compact) */}
      {compact && (
        <div className={cn("pb-3 pt-1", padX)}>
          <DateInfo iso={m.createdAt} small />
        </div>
      )}

      <LinksModal open={linksOpen} links={links} onClose={() => setLinksOpen(false)} />
    </motion.article>
  );
}

/** Memoizado: a lista pode ficar longa; só re-renderiza se a mensagem mudar. */
export const RadarMessageCard = memo(RadarMessageCardBase);
