/**
 * Identidade do Rick Bot. As capturas dele ganham tratamento próprio no card
 * (chip do CA + só os links de análise) — e isso vale ONDE QUER QUE a mensagem
 * apareça: coluna do Rick, feed principal ou perfil do autor. Por isso a regra
 * mora aqui, e não numa prop de coluna.
 *
 * Ajuste aqui se a identidade mudar; o `useRadarFeed` e o `RickBotPanel`
 * consultam a mesma constante.
 */
export const RICK_BOT_TAG = "Rick#9725";

/** A mensagem é do Rick Bot? (comparação exata, como no filtro do backend) */
export function isRickBot(authorTag: string | null | undefined): boolean {
  return authorTag === RICK_BOT_TAG;
}
