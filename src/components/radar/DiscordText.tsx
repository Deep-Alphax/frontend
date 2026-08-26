"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Renderiza texto no "Markdown do Discord" como o próprio Discord: os links
 * aparecem pelo RÓTULO (`[texto](url)` → "texto" clicável, sem a URL solta),
 * `**negrito**`, `_itálico_`, `` `código` `` e emoji custom `<:nome:id>` → `:nome:`.
 *
 * Segurança: constrói NÓS React (nunca `dangerouslySetInnerHTML`) → sem XSS; só
 * aceita hrefs http(s). Puro/estável (sem estado), seguro para virtualização.
 */

// Sem flag `g`: cada `exec` começa do 0 e pega a 1ª ocorrência (recursão segura).
const CODE = /`([^`\n]+?)`/;
// Emoji custom `<:nome:id>` / animado `<a:nome:id>` — capturamos flag, nome e id
// p/ montar a imagem real na CDN do Discord.
const CUSTOM_EMOJI = /<(a)?:(\w+):(\d+)>/;
const LINK = /\[([^\]]*?)\]\((https?:\/\/[^)\s]+)\)/;
const BOLD = /\*\*([\s\S]+?)\*\*/;
const ITALIC = /_([^_\n]+?)_/;
// Itálico com `*asteriscos*` (o Discord aceita `*` e `_`). BOLD (`**`) vence por
// vir antes e por casar em índice ≤.
const ITALIC_STAR = /\*([^*\n]+?)\*/;
// URL "solta" (fora de Markdown) — o Discord também autolinka. LINK vence quando
// a URL está dentro de `[x](url)` (índice do `[` é menor).
const URL = /(https?:\/\/[^\s<>()]+)/;
// Menções do Discord: `<@id>`/`<@!id>` (usuário), `<@&id>` (cargo), `<#id>` (canal).
// Sem o mapa id→nome nas capturas, renderizamos um rótulo genérico (pílula).
const MENTION = /<(@!|@&|@|#)(\d+)>/;
// `@everyone` / `@here` (sem colchetes).
const MENTION_ALL = /@(everyone|here)\b/;

const LINK_CLASS =
  "text-secundaria-11 underline underline-offset-2 transition-colors hover:text-secundaria-12 [overflow-wrap:anywhere]";
// Pílula de menção (estilo Discord): fundo azulado sutil + texto de link.
const MENTION_CLASS =
  "rounded bg-secundaria-4/50 px-1 font-medium text-secundaria-11";

/** Rótulo genérico da menção por tipo (não temos o nome, só o id). */
function mentionLabel(prefix: string): string {
  if (prefix === "#") return "#canal";
  if (prefix === "@&") return "@cargo";
  return "@usuário";
}

/** Tokeniza uma string em nós React, tratando o mais próximo primeiro (recursivo). */
function tokenize(input: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = input;
  let key = 0;

  while (rest.length > 0) {
    const candidates: Array<{ type: string; m: RegExpExecArray }> = [];
    for (const [type, re] of [
      ["code", CODE],
      ["emoji", CUSTOM_EMOJI],
      ["mention", MENTION],
      ["mentionAll", MENTION_ALL],
      ["link", LINK],
      ["bold", BOLD],
      ["italic", ITALIC],
      ["italicStar", ITALIC_STAR],
      ["url", URL],
    ] as const) {
      const m = re.exec(rest);
      if (m) candidates.push({ type, m });
    }

    if (candidates.length === 0) {
      out.push(rest);
      break;
    }

    // Mais próximo do início vence; empate → resolve pela ordem acima (code first).
    candidates.sort((a, b) => a.m.index - b.m.index);
    const { type, m } = candidates[0];
    if (m.index > 0) out.push(rest.slice(0, m.index));

    const k = key++;
    switch (type) {
      case "code":
        out.push(
          <code
            key={k}
            className="rounded bg-gray-3 px-1 py-0.5 font-mono text-[0.85em] text-gray-12"
          >
            {m[1]}
          </code>,
        );
        break;
      case "emoji":
        // Emoji custom → imagem real da CDN do Discord (`a` = animado → .gif).
        out.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={`https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? "gif" : "png"}`}
            alt={`:${m[2]}:`}
            title={`:${m[2]}:`}
            loading="lazy"
            className="mx-0.5 inline-block size-[1.25em] -translate-y-[0.1em] align-middle"
          />,
        );
        break;
      case "mention":
        out.push(
          <span key={k} className={MENTION_CLASS}>
            {mentionLabel(m[1])}
          </span>,
        );
        break;
      case "mentionAll":
        out.push(
          <span key={k} className={MENTION_CLASS}>
            @{m[1]}
          </span>,
        );
        break;
      case "link":
        out.push(
          <a
            key={k}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {tokenize(m[1])}
          </a>,
        );
        break;
      case "bold":
        out.push(
          <strong key={k} className="font-semibold">
            {tokenize(m[1])}
          </strong>,
        );
        break;
      case "italic":
      case "italicStar":
        out.push(<em key={k}>{tokenize(m[1])}</em>);
        break;
      case "url":
        out.push(
          <a
            key={k}
            href={m[1]}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {m[1]}
          </a>,
        );
        break;
    }

    rest = rest.slice(m.index + m[0].length);
  }

  return out;
}

export function DiscordText({ text }: { text: string }): ReactNode {
  return <Fragment>{tokenize(text)}</Fragment>;
}
