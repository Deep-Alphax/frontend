/**
 * Configuração pública (exposta ao browser via prefixo NEXT_PUBLIC_).
 * NUNCA colocar segredos aqui — tudo que é NEXT_PUBLIC_ vai no bundle do client.
 */

/** Base URL da API (NestJS). Default aponta para o backend em dev local. */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"
).replace(/\/$/, "");

/**
 * Site key do Cloudflare Turnstile (anti-bot). Vazio = widget não renderiza e o
 * fluxo segue sem token — o backend é fail-open em dev e exige o token em prod.
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Project ID do WalletConnect Cloud / Reown (https://cloud.reown.com). Necessário
 * para o modal de conexão de carteira (EVM + Solana). Vazio = wallet connect
 * desabilitado (o botão avisa em vez de abrir). Público por natureza (é um id de
 * app, não um segredo).
 */
export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

/** Origem pública do app (metadata do WalletConnect). Default: dev local. */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
