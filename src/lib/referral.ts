/**
 * Código de indicação vindo do link de afiliado (`/register?ref=CODE`).
 *
 * Fica no `localStorage` e não só na URL porque o caminho real quase nunca é
 * reto: quem chega pelo link costuma passar por "já tenho conta", voltar, ler
 * os planos e só então se cadastrar. Perdido o parâmetro, a venda deixa de ser
 * atribuída e o afiliado reclama — com razão.
 *
 * Não é credencial nem PII: é um apelido público que o próprio afiliado
 * divulga. Se o storage estiver bloqueado, tudo degrada para "sem indicação".
 */

const KEY = "da_ref";

/** Mesmo limite do backend — código maior que isso não existe e não vale guardar. */
const MAX_LENGTH = 24;

/**
 * Lê `?ref=` da URL atual e guarda. Chamar mais de uma vez é seguro.
 *
 * Não sobrescreve um código já guardado: entre o primeiro e o último link
 * clicado, o primeiro é quem de fato trouxe a pessoa.
 */
export function captureReferralFromUrl(search: string): void {
  const raw = new URLSearchParams(search).get("ref");
  if (!raw) return;
  const code = raw.trim().slice(0, MAX_LENGTH);
  if (!code) return;
  try {
    if (window.localStorage.getItem(KEY)) return;
    window.localStorage.setItem(KEY, code);
  } catch {
    // Storage bloqueado (modo privado / cookies de terceiros) — segue sem.
  }
}

/** Código guardado, ou undefined. */
export function storedReferral(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Descarta o código depois do cadastro. Sem isso, a segunda conta criada no
 * mesmo navegador (o caso comum de um casal ou de um teste) seria atribuída ao
 * mesmo afiliado sem que ninguém tenha clicado no link de novo.
 */
export function clearReferral(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada a limpar se nem dá para ler.
  }
}
