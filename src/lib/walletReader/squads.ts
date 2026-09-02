/**
 * Squads — a única forma de agrupar KOLs.
 *
 * Antes havia dois modelos para a mesma ideia: `squads` no preset (nomes
 * globais, só o ADMIN escreve) e "Grupos/FnFs", uma entidade por conta com id.
 * A rail acabava com duas facetas que se combinavam em AND e nenhuma delas
 * respondia sozinha "em que squads este KOL está". Hoje é um conceito só: um
 * NOME, que pode vir do preset ou da conta do usuário.
 *
 * Como são nomes livres digitados por gente, a comparação é sempre pela chave
 * normalizada — senão "Lair" e "lair " viram dois squads na rail e o usuário lê
 * como um.
 */

/** Chave de comparação de um squad: sem espaços nas pontas e sem caixa. */
export function squadKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Remove repetidos preservando a ORDEM e a grafia da primeira ocorrência — a
 * do preset vem antes, então é a dela que prevalece na tela. Nomes vazios saem.
 */
export function dedupSquads(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = squadKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return out;
}

/**
 * Como os squads aparecem sob o nome do KOL: "Squad1, Squad2, Squad3".
 * Sem nenhum, o card não fica com um buraco — diz que não há.
 */
export function formatSquads(names: string[], empty = "Sem squad"): string {
  const list = dedupSquads(names);
  return list.length > 0 ? list.join(", ") : empty;
}
