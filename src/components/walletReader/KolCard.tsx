"use client";

import { cn } from "@/lib/cn";
import { KOL_TYPE_MAP, avatarSrc, tierFor, type TierSpec } from "@/lib/walletReader/types";

/**
 * Cantoneira decorativa: caixa de 40px com bordas só à esquerda/topo, pintada
 * pelo degradê do nível. A máscara `exclude` (border-box − padding-box) deixa
 * visível apenas a faixa de 1px da borda, preservando o raio de 8px.
 */
const CORNER_CLS =
  "pointer-events-none absolute size-10 rounded-tl-lg border-l border-t border-transparent bg-linear-to-b bg-origin-border " +
  "[mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)] [mask-clip:padding-box,border-box] [mask-composite:exclude]";

/** Máximo de tags de tipo no rodapé antes do "+N" (o Figma mostra 1 + "+2"). */
const MAX_VISIBLE_TYPES = 2;

/** Ícone do X (Twitter) — a lucide não traz o mark novo; SVG inline do logo oficial. */
export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

/**
 * Pílula do nível: emblema + nome, com o degradê/borda do tier
 * (node Figma 886:19085). Reaproveitável fora do card (modais, listas).
 */
export function TierPill({ tier, className }: { tier: TierSpec; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-[32px] border bg-linear-to-r px-2 py-1",
        tier.pill,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tier.emblem} alt="" width={20} height={20} className="size-5 shrink-0 object-contain" />
      <span className={cn("text-sm font-medium leading-[1.3]", tier.pillText)}>{tier.label}</span>
    </span>
  );
}

/** O que o card precisa de um KOL — serve tanto ao índice quanto ao preset. */
export interface KolCardItem {
  id: string;
  name: string;
  avatar: string | null;
  squads: string[];
  walletCount: number;
  relevance: number;
  types: string[];
  twitter: string;
}

interface KolCardProps {
  kol: KolCardItem;
  /** Clique no card (abre o perfil/editor). Sem isto o card é estático. */
  onOpen?: () => void;
  /** Faixa extra no rodapé — ações do admin (editar/remover). */
  actions?: React.ReactNode;
  /** Esmaece o card (preset removido em soft delete). */
  dimmed?: boolean;
}

/**
 * Card de um KOL (node Figma 886:18067). O SKIN inteiro — borda, fundo em
 * degradê, anel do avatar, barra, cantoneiras e pílula — vem do nível
 * (`tierFor(relevance)`), então o card não conhece cor nenhuma: só compõe.
 *
 * O clique é um botão em `absolute inset-0` (não um `<button>` em volta de
 * tudo): assim o rodapé de ações do admin pode ter os próprios botões sem
 * aninhar botão dentro de botão.
 */
export function KolCard({ kol, onOpen, actions, dimmed = false }: KolCardProps) {
  const tier = tierFor(kol.relevance);
  const shown = kol.types.slice(0, MAX_VISIBLE_TYPES);
  const extra = kol.types.length - shown.length;
  // Todos os squads do KOL, na ordem em que vieram: "Squad1, Squad2, Squad3".
  // A linha tem `truncate`, então o `title` é quem mostra a lista inteira
  // quando ela não cabe.
  const squad = kol.squads.length > 0 ? kol.squads.join(", ") : "Sem squad";

  return (
    <article
      className={cn(
        // Sem `overflow-hidden`: as cantoneiras ficam em -1px, fora da caixa —
        // clipar comia o detalhe. Quem clipa é cada filho que precisa.
        "group relative isolate flex flex-col rounded-lg border transition-colors",
        tier.card,
        dimmed && "opacity-60",
      )}
    >
      {/* Emblema do nível ao fundo do topo: girado 18,79° e esmaecido por uma
          máscara vertical (o mesmo degradê do Figma, sem precisar do SVG). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[153px] overflow-hidden rounded-t-lg [mask-image:linear-gradient(to_bottom,#000_0%,rgba(0,0,0,0.8)_24%,transparent_100%)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tier.emblem}
          alt=""
          width={126}
          height={126}
          className="absolute -left-6 -top-4 size-[126px] rotate-[18.79deg] object-contain opacity-50"
        />
      </div>

      {/* Perfil: avatar + nome + squad */}
      <div className="relative flex flex-col items-center gap-4 px-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(kol)}
          alt=""
          width={64}
          height={64}
          className={cn("size-16 shrink-0 rounded-full border-2 object-cover", tier.ring)}
        />
        <div className="flex w-full min-w-0 flex-col items-center gap-3 text-center">
          <p className="w-full truncate text-lg font-semibold leading-[1.1] text-gray-12">{kol.name}</p>
          <p
            className="w-full truncate text-sm font-medium leading-[1.3] text-gray-11"
            title={squad}
          >
            {squad}
          </p>
        </div>
      </div>

      {/* Barra de 2px do nível — sempre cheia, no degradê do tier (node 886:18075). */}
      <div className={cn("h-0.5 w-full shrink-0 rounded-[32px] bg-linear-to-r", tier.bar)} />

      {/* Nível + nº de carteiras */}
      <div className="flex items-center border-b border-gray-6 p-4">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <p className="text-xs font-medium text-gray-11">Level</p>
          <TierPill tier={tier} />
        </div>
        <span className="h-10 w-px shrink-0 bg-gray-6" aria-hidden />
        <div className="flex shrink-0 flex-col items-start gap-2 pl-3">
          <p className="text-xs font-medium text-gray-11">Carteiras</p>
          <p className="text-xl font-semibold leading-[1.1] tabular-nums text-gray-12">
            {kol.walletCount}
          </p>
        </div>
      </div>

      {/* Tipos de trader + X */}
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex min-w-0 items-center gap-1">
          {shown.length > 0 ? (
            <>
              {shown.map((tid) => (
                <span
                  key={tid}
                  className="max-w-full truncate rounded-[32px] border border-gray-6 bg-gray-3 px-3 py-2 text-sm font-medium leading-[1.3] text-gray-11"
                >
                  {KOL_TYPE_MAP[tid]?.label ?? tid}
                </span>
              ))}
              {extra > 0 && (
                <span className="shrink-0 rounded-[32px] border border-gray-6 bg-gray-3 px-3 py-2 text-sm font-medium leading-[1.3] text-gray-11">
                  +{extra}
                </span>
              )}
            </>
          ) : (
            <span className="rounded-[32px] border border-dashed border-gray-6 px-3 py-2 text-sm text-gray-9">
              Sem tipo definido
            </span>
          )}
        </div>
        {kol.twitter && <XIcon className="size-4 shrink-0 text-gray-11" />}
      </div>

      {/* Cantoneiras (detalhe-1/2, nodes 886:18093-18094): "L" de 1px sobre a
          borda do card, em degradê vertical. O L sai do degradê recortando só a
          área da borda (máscara border-box menos padding-box) — é o que mantém o
          canto arredondado, que um `border-image` perderia. */}
      <span aria-hidden className={cn(CORNER_CLS, "-left-px -top-px", tier.corner)} />
      <span
        aria-hidden
        className={cn(CORNER_CLS, "-bottom-px -right-px rotate-180", tier.corner)}
      />

      {/* Alvo do clique: cobre o card inteiro, ABAIXO do rodapé de ações. */}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir ${kol.name}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9"
        />
      )}

      {/* Ações (admin) — acima do alvo de clique para receberem o próprio evento. */}
      {actions && (
        <div className="relative z-20 flex items-center gap-2 rounded-b-lg border-t border-gray-6 bg-gray-1/40 px-4 py-3">
          {actions}
        </div>
      )}
    </article>
  );
}
