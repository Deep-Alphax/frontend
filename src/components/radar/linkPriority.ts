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
 * Escolhe UM link do provedor. Capturas do Rick trazem vários do mesmo lugar
 * (o solscan do token, o da carteira do dev, o da transação…) e só o do token
 * interessa no card: preferimos o que carrega o CA da mensagem; sem CA (ou sem
 * casar), fica o primeiro que apareceu.
 */
function pickOne(list: string[], ca: string | null | undefined): string {
  if (ca) {
    const needle = ca.toLowerCase();
    const withCa = list.find((l) => l.toLowerCase().includes(needle));
    if (withCa) return withCa;
  }
  return list[0];
}

/**
 * Separa os links em `primary` (UM por provedor priorizado, na ordem de
 * PRIORITY_PROVIDERS) e `rest` (todo o resto, na ordem original — vira a
 * contagem do "+N"). Sem link priorizado, `primary` volta vazio e o chamador cai
 * no comportamento padrão (primeiros N chips + overflow).
 *
 * `ca` (contract address da mensagem) desempata quando o mesmo provedor aparece
 * mais de uma vez. Links repetidos idênticos entram uma vez só.
 */
export function splitPriorityLinks(
  links: string[],
  ca?: string | null,
): {
  primary: PriorityLink[];
  rest: string[];
} {
  // Agrupa por provedor preservando a ordem da mensagem dentro de cada grupo.
  const byProvider = new Map<number, string[]>();
  for (const link of links) {
    const i = providerIndex(link);
    if (i < 0) continue;
    const list = byProvider.get(i);
    if (list) list.push(link);
    else byProvider.set(i, [link]);
  }

  const primary: PriorityLink[] = [];
  const chosen = new Set<string>();
  // Ordem = ordem dos provedores em PRIORITY_PROVIDERS.
  for (let i = 0; i < PRIORITY_PROVIDERS.length; i++) {
    const list = byProvider.get(i);
    if (!list) continue;
    const link = pickOne(list, ca);
    chosen.add(link);
    primary.push({ link, label: PRIORITY_PROVIDERS[i].label });
  }

  return { primary, rest: links.filter((l) => !chosen.has(l)) };
}
