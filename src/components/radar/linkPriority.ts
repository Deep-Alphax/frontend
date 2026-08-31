/**
 * Prioridade dos links nos chips das capturas do Rick Bot: as capturas trazem
 * uma dezena de links (trade, explorer, socials) e só os quatro de análise
 * interessam de relance — o resto vai para o modal "Todos os links".
 *
 * Módulo puro (sem React/DOM) → testável direto.
 */

/** Provedores priorizados, NA ORDEM de exibição dos chips. */
const PRIORITY_PROVIDERS: { label: string; hosts: string[] }[] = [
  { label: "GMGN", hosts: ["gmgn.ai"] },
  { label: "AXIOM", hosts: ["axiom.trade", "axiom.exchange"] },
  { label: "DEXSCREENER", hosts: ["dexscreener.com"] },
  { label: "SOLSCAN", hosts: ["solscan.io"] },
];

export interface PriorityLink {
  link: string;
  /** Rótulo do provedor ("GMGN", "AXIOM"…) — no lugar do derivado da URL. */
  label: string;
}

/** Host sem `www.` (`null` quando a URL é inválida). */
function hostOf(link: string): string | null {
  try {
    return new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Índice do provedor priorizado que casa com o link, ou -1. */
function providerIndex(link: string): number {
  const host = hostOf(link);
  if (!host) return -1;
  // Casa o host exato ou um subdomínio dele (ex.: `www.gmgn.ai`, `t.gmgn.ai`).
  return PRIORITY_PROVIDERS.findIndex((p) =>
    p.hosts.some((h) => host === h || host.endsWith(`.${h}`)),
  );
}

/**
 * Separa os links em `primary` (provedores priorizados, na ordem de
 * PRIORITY_PROVIDERS) e `rest` (todo o resto, na ordem original — vai para o
 * modal). Sem link priorizado, `primary` volta vazio e o chamador cai no
 * comportamento padrão (primeiros N chips + overflow).
 */
export function splitPriorityLinks(links: string[]): {
  primary: PriorityLink[];
  rest: string[];
} {
  const primary: (PriorityLink & { rank: number })[] = [];
  const rest: string[] = [];

  for (const link of links) {
    const i = providerIndex(link);
    if (i < 0) rest.push(link);
    else primary.push({ link, label: PRIORITY_PROVIDERS[i].label, rank: i });
  }

  // Ordem = ordem dos provedores; empate mantém a ordem da mensagem (sort estável).
  primary.sort((a, b) => a.rank - b.rank);
  return { primary: primary.map(({ link, label }) => ({ link, label })), rest };
}
