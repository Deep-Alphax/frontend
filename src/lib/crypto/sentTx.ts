import type { SentCryptoTx } from "@/lib/api/billing";

/*
 * Transação que a carteira JÁ enviou, guardada até o servidor confirmar que a
 * recebeu. Cobre o buraco entre "a carteira devolveu o hash" e "o POST /submit
 * respondeu": se a aba cair ou a rede falhar ali, o dinheiro saiu mas o servidor
 * não sabe de qual transação — reabrir a cobrança reenvia daqui.
 *
 * É só conveniência deste navegador (pode vir vazio: aba anônima, storage
 * bloqueado). Por isso todo acesso é protegido e nada de segurança depende disto:
 * quem decide se pagou é o servidor, lendo a transação na rede.
 */

const PREFIX = "deepalpha:crypto-sent:";

export function loadSentTx(paymentId: string): SentCryptoTx | null {
  try {
    const raw = localStorage.getItem(PREFIX + paymentId);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SentCryptoTx>;
    if (typeof v.txHash !== "string" || typeof v.payer !== "string") return null;
    return typeof v.signature === "string"
      ? { txHash: v.txHash, payer: v.payer, signature: v.signature }
      : { txHash: v.txHash, payer: v.payer };
  } catch {
    return null;
  }
}

export function saveSentTx(paymentId: string, sent: SentCryptoTx): void {
  try {
    localStorage.setItem(PREFIX + paymentId, JSON.stringify(sent));
  } catch {
    // Sem storage o fluxo segue; só perde a retomada após recarregar.
  }
}

export function clearSentTx(paymentId: string): void {
  try {
    localStorage.removeItem(PREFIX + paymentId);
  } catch {
    // idem
  }
}
