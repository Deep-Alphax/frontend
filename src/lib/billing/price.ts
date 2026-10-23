/**
 * Preço do PRO em US$ (30 dias / mês) — só VITRINE: o card de planos e a
 * escolha do meio, que aparecem antes de qualquer resposta do servidor (e
 * para quem nem logou). Quem cobra é o backend:
 *  - USDC: `PRO_PRICE_UNITS` (backend/src/app/billing/crypto/crypto-rules.ts);
 *  - Pix: `PIX_PRICE_USD_CENTS` (deriva do mesmo, em pix-rules.ts);
 *  - cartão: o Price do Stripe em `STRIPE_PRICE_PRO_MONTHLY`.
 * Mudou o preço? Mude os três e este. Onde o servidor já devolve o valor
 * (opções de USDC/Pix, cobrança aberta), exiba o do servidor.
 */
export const PRO_PRICE_USD = 100;
