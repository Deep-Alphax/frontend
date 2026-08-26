"use client";

import { memo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Star } from "lucide-react";

import type { CapturedMessage } from "@/lib/api/feed";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { extractCa, shortenCa } from "@/lib/ca";
import { DURATION, EASE } from "@/lib/motion";
import {
  cardBgFor,
  cardBorderFor,
  starFor,
  toneFor,
} from "@/components/radar/favoriteColors";
import { DiscordText } from "@/components/radar/DiscordText";
import { RoleBadge, cardGradientFor } from "@/components/radar/roleBadge";
import { MoreChip, TokenChip } from "@/components/radar/TokenChip";
import { LinksModal } from "@/components/radar/LinksModal";
import {
  getEmbedMedia,
  getLinkMedia,
  isEmbedOnlyText,
  type EmbedMediaItem,
} from "@/components/radar/embedMedia";
import { MediaModal } from "@/components/radar/MediaModal";
import { useFavoriteFor } from "@/components/radar/favoritesLookup";

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
      {small && <span className="h-px w-full bg-gray-6" aria-hidden />}
    </div>
  );
}

/**
 * Chip do contract address: mostra o CA encurtado + ícone de copiar. Clicar copia
 * o CA COMPLETO p/ a área de transferência (feedback breve de "copiado"). Usado nas
 * capturas do Rick Bot p/ pegar o CA do token sem abrir a mensagem.
 */
function CaChip({ ca }: { ca: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard indisponível (contexto não-seguro) — ignora silenciosamente.
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copiado!" : `Copiar CA: ${ca}`}
      aria-label={`Copiar contract address ${ca}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-xs transition-colors",
        copied
          ? "border-green-8 bg-green-3 text-green-11"
          : "border-gray-6 bg-gray-3 text-gray-12 hover:border-gray-8",
      )}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0" strokeWidth={2} />
      ) : (
        <Copy className="size-3.5 shrink-0 text-gray-11" strokeWidth={2} />
      )}
      <span>{copied ? "Copiado" : shortenCa(ca)}</span>
    </button>
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
   * Superfície do card (node Figma 654:14193):
   * - "card" (default) → caixa com borda e cantos arredondados (perfil, destaque).
   * - "list" → sem caixa, divisória inferior + tint sutil por papel (os 3 feeds).
   */
  surface?: "card" | "list";
  /**
   * Faixa de destaque (gradiente violeta) atrás do nome + data no rodapé —
   * variante das colunas laterais (fonte/favoritos, node Figma 748:25317).
   */
  nameAccent?: boolean;
  /**
   * Mostra o CA do token analisado como chip clicável (copia ao clicar), sem
   * precisar abrir a mensagem. Usado nas capturas do Rick Bot.
   */
  showCa?: boolean;
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
  surface = "card",
  nameAccent = false,
  showCa = false,
  onSelectAuthor,
}: RadarMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [lightbox, setLightbox] = useState<EmbedMediaItem | null>(null);
  const reduce = useReducedMotion();

  // Só anima capturas que chegaram em tempo real (socket). Load inicial e
  // paginação renderizam sem animação — evita "tempestade" de entrada.
  const animateIn = isNew && !reduce;

  // Personalização do autor seguido (apelido/cor/foto) — reflete no card.
  const fav = useFavoriteFor(m.authorTag);
  const following = Boolean(fav);
  const author = m.authorTag || "Desconhecido";
  const displayName = fav?.nickname?.trim() || author;
  // Cor escolhida → borda + gradiente sutil no card (node 492:8120).
  const colorBorder = cardBorderFor(fav?.color);
  const colorBg = cardBgFor(fav?.color);
  const isList = surface === "list";
  // Tint por papel (só quando não há cor de favorito, que tem prioridade visual).
  const roleGrad = colorBg ? "" : cardGradientFor(m.role);
  const text = m.text ?? "";
  const isLong = text.length > CLAMP_THRESHOLD || text.split("\n").length > 6;

  const links = m.links ?? [];

  // Mídia = embeds + LINKS diretos de mídia (ex.: anexo `cdn.discordapp.com/…gif`,
  // que não vira embed → sem isto apareceria como link cru). Dedup por src.
  const linkMedia = getLinkMedia(links);
  const mediaUrls = new Set(linkMedia.map((x) => x.src));
  const embedMedia = getEmbedMedia(m.embed);
  const media = [
    ...embedMedia,
    ...linkMedia.filter((x) => !embedMedia.some((e) => e.src === x.src)),
  ];

  // Links de mídia saem dos chips (já viram a própria mídia).
  const chipLinks = mediaUrls.size ? links.filter((l) => !mediaUrls.has(l)) : links;
  const visibleChips = chipLinks.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = chipLinks.length - visibleChips.length;
  const hasChips = chipLinks.length > 0;

  // Texto sem as URLs de mídia (o GIF é mostrado como mídia, não como link cru).
  const cleanedText = mediaUrls.size
    ? [...mediaUrls].reduce((t, u) => t.split(u).join(" "), text).trim()
    : text;
  // Não mostra texto quando ele era só o link do embed OU só a(s) URL(s) de mídia.
  const isMediaOnly =
    media.length > 0 &&
    (isEmbedOnlyText(text, m.embed) || cleanedText.replace(/\s+/g, "").length === 0);
  const showText = text.length > 0 && !isMediaOnly;
  const displayText = mediaUrls.size ? cleanedText : text;

  // CA do token analisado (Rick Bot) — mostrado como chip clicável (copia).
  const ca = showCa ? extractCa(text, links) : null;

  // Identidade = authorTag (presente em 100% das capturas → todo card clicável).
  const selectable = Boolean(onSelectAuthor && m.authorTag);
  const select = () => {
    if (m.authorTag) onSelectAuthor?.(m.authorTag, displayName);
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
      // Entrada de mensagem nova (realtime): sobe DE BAIXO (y+ → 0) + fade. É só
      // transform (não altera altura), então não conflita com a ancoragem do chat.
      initial={animateIn ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.emphasis, ease: EASE.out }}
      onClick={onCardClick}
      className={cn(
        "relative flex w-full min-w-0 flex-col overflow-hidden",
        // Superfície: lista vs caixa (borda + cantos). A divisória inferior entre
        // mensagens fica SÓ no feed principal (lista wide); colunas laterais
        // (compact) não têm divisória entre cards.
        isList
          ? cn(
            !compact && "last:border-none border-b border-gray-6/70",
            colorBg ? colorBg : roleGrad || "bg-transparent",
          )
          : cn(
            "rounded-lg border",
            colorBorder
              ? cn(colorBorder, colorBg)
              : highlighted
                ? "border-gray-7 bg-gray-3"
                : "border-gray-6 bg-gray-2",
          ),
        selectable && "cursor-pointer transition-colors",
        selectable && !isList && !colorBorder && "hover:border-gray-8",
        selectable && isList && "hover:bg-gray-2/50",
      )}
    >
      {/* Cabeçalho: avatar + autor/grupo (+ data no wide) */}
      <header
        className={cn(
          "relative flex items-center gap-2",
          compact ? "p-3" : "justify-between px-4 py-3",
        )}
      >
        <div className="relative flex min-w-0 items-center gap-2">
          {/* Faixa violeta atrás do nome (node 748:25317) — só colunas laterais.
              Dimensiona pelo BLOCO DO NOME (`right-0`) → acompanha o nome inteiro,
              não importa o comprimento. `-left-3` estende até a borda do card
              (compensa o p-3 do header). Gradiente exato do Figma. */}
          {nameAccent && (
            <span
              aria-hidden
              className="pointer-events-none absolute -left-3 -right-6 top-1/2 h-10 -translate-y-1/2 rounded-r-[32px] bg-linear-to-l from-violeta-5 via-violeta-2 to-gray-1"
            />
          )}
          <div className="relative shrink-0">
            <Avatar
              src={fav?.photoUrl}
              name={displayName}
              className="size-8"
              fallbackClassName={toneFor(fav?.color)}
            />
            {following && (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-gray-2">
                <Star className={cn("size-2.5 fill-current", starFor(fav?.color))} strokeWidth={0} />
              </span>
            )}
          </div>
          <div className="relative min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={cn(
                  "min-w-0 truncate font-semibold leading-tight text-gray-12",
                  compact ? "text-sm" : "text-base",
                )}
              >
                {displayName}
              </p>
              <RoleBadge role={m.role} />
            </div>
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

      {/* CA do token (Rick Bot) — sempre visível, clicar copia. */}
      {ca && (
        <div className={cn("pt-1 pb-1", padX)}>
          <CaChip ca={ca} />
        </div>
      )}

      {/* Corpo: texto renderizado como o Discord (links inline) + "Ler mais" */}
      {showText && (
        <div className={cn("flex w-full min-w-0 flex-col items-start gap-1 pt-1", padX, hasChips || media.length > 0 || compact ? "pb-2" : "pb-4")}>
          <p
            className={cn(
              // `overflow-wrap:anywhere` quebra strings longas sem espaço
              // (contratos/URLs) para não estourar a largura do card.
              "w-full min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]",
              "text-sm font-medium leading-snug text-gray-12",
              !expanded && isLong && "line-clamp-5",
            )}
          >
            <DiscordText text={displayText} />
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

      {/* Mídia dos embeds (GIF/imagem/vídeo) — clique abre em tela (lightbox) */}
      {media.length > 0 && (
        <div className={cn("flex flex-col items-start gap-2 pt-1 pb-2", padX)}>
          {media.map((mi, i) => (
            <button
              key={mi.src + i}
              type="button"
              onClick={() => setLightbox(mi)}
              aria-label="Abrir mídia"
              className="block overflow-hidden rounded-lg border border-gray-6 bg-gray-1 transition-opacity hover:opacity-90"
            >
              {mi.kind === "video" ? (
                <video
                  src={mi.src}
                  poster={mi.poster}
                  autoPlay
                  loop
                  muted
                  playsInline
                  width={mi.width}
                  height={mi.height}
                  // pointer-events-none: o clique é do botão (abre o lightbox).
                  className="pointer-events-none max-h-48 w-auto max-w-[220px]"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mi.src}
                  alt=""
                  loading="lazy"
                  className="pointer-events-none max-h-48 w-auto max-w-[220px] object-contain"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Chips de token/link (botões) — complementam o texto formatado */}
      {hasChips && (
        <div className={cn("flex w-full min-w-0 flex-wrap content-start items-start gap-2 pt-2 pb-4", padX)}>
          {visibleChips.map((l) => (
            <TokenChip key={l} link={l} compact={compact} />
          ))}
          {hiddenCount > 0 && (
            <MoreChip count={hiddenCount} compact={compact} onClick={() => setLinksOpen(true)} />
          )}
        </div>
      )}

      {/* Rodapé: só a data (sem linha divisória) — colunas laterais. */}
      {compact && (
        <div className={cn("pb-3 pt-1", padX)}>
          <DateInfo iso={m.createdAt} small />
        </div>
      )}

      <LinksModal open={linksOpen} links={links} onClose={() => setLinksOpen(false)} />
      <MediaModal item={lightbox} onClose={() => setLightbox(null)} />
    </motion.article>
  );
}

/** Memoizado: a lista pode ficar longa; só re-renderiza se a mensagem mudar. */
export const RadarMessageCard = memo(RadarMessageCardBase);
