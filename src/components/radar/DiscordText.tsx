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
const CUSTOM_EMOJI = /<a?:(\w+):\d+>/;
const LINK = /\[([^\]]*?)\]\((https?:\/\/[^)\s]+)\)/;
const BOLD = /\*\*([\s\S]+?)\*\*/;
const ITALIC = /_([^_\n]+?)_/;
// URL "solta" (fora de Markdown) — o Discord também autolinka. LINK vence quando
// a URL está dentro de `[x](url)` (índice do `[` é menor).
const URL = /(https?:\/\/[^\s<>()]+)/;

const LINK_CLASS =
  "text-secundaria-11 underline underline-offset-2 transition-colors hover:text-secundaria-12 [overflow-wrap:anywhere]";

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
      ["link", LINK],
      ["bold", BOLD],
      ["italic", ITALIC],
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
        // Como no texto copiado do Discord (sem a imagem do emoji custom).
        out.push(`:${m[1]}:`);
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
