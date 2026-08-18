import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware do Next 16 (arquivo `proxy.ts`, função `proxy`).
 * Faz duas coisas:
 *   1. Gate de navegação por sessão (UX, não segurança) via cookie-dica.
 *   2. Aplica os security headers da aplicação (fonte ÚNICA — inclui a CSP).
 */

/**
 * Cookie-dica de sessão (`pt_authed_client`): NÃO-httpOnly, valor "1", setado
 * pelo backend no login/registro. É só um sinal de "provavelmente logado" para
 * decidir o roteamento — NÃO é credencial. A autorização real é o cookie
 * httpOnly `pt_at_client`, validado pela API (401 se inválido). Em dev, o cookie
 * host-only de `localhost` é compartilhado entre portas (cookies ignoram porta),
 * então o middleware do front (:3000) enxerga o que a API (:3333) setou.
 */
const SESSION_HINT_COOKIE = "pt_authed_client";

/** Rotas acessíveis SEM sessão (Home pública + login/cadastro/recuperação/callbacks OAuth). */
function isPublicPath(pathname: string): boolean {
  // Home é pública: deslogado vê o header sem conta + CTA "Acessar plataforma"
  // que leva ao login. A API e as demais telas seguem protegidas.
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/register" || pathname.startsWith("/register/")) return true;
  if (pathname.startsWith("/forgot-password")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/spline-test")) return true; // DEBUG temporário — remover
  return false;
}

/**
 * Páginas de ENTRADA de auth: um usuário já logado não deveria vê-las (mandamos
 * para a Home). Note que `/register/success` fica de fora de propósito — o
 * usuário recém-cadastrado já está logado e precisa ver a conclusão.
 */
function isAuthEntryPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

/** Origem (scheme+host+porta) da API, p/ liberar no connect-src. */
function apiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3333";
  }
}

/**
 * Origens próprias do app (apex + contraparte www⇄apex), p/ o img-src.
 * A metadata do WalletConnect exige URL ABSOLUTA no ícone (`APP_URL/brand/...`);
 * se a página é servida no host "irmão" (ex.: www) o `'self'` não cobre a apex e
 * o ícone é bloqueado. Liberar os dois hosts torna a CSP resiliente ao host.
 */
function appOrigins(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const url = new URL(raw);
    const origins = new Set<string>([url.origin]);
    const alt = new URL(url.href);
    alt.hostname = alt.hostname.startsWith("www.")
      ? alt.hostname.slice(4)
      : `www.${alt.hostname}`;
    origins.add(alt.origin);
    return [...origins].join(" ");
  } catch {
    return "http://localhost:3000";
  }
}

function buildContentSecurityPolicy(isDev: boolean): string {
  const api = apiOrigin();
  // WebSocket (socket.io de tempo real) fala com a MESMA origin da API, no esquema
  // ws/wss. connect-src casa por esquema, então o https da API não cobre o wss —
  // liberamos explicitamente (em dev o `ws: wss:` abaixo já cobre localhost).
  const apiWs = api.replace(/^http/, "ws");
  const app = appOrigins();
  const turnstile = "https://challenges.cloudflare.com";

  // Spline (animação de "sincronizando"): runtime empacotado localmente (script-src
  // fica 'self'); liberamos os hosts da CENA (.splinecode + texturas) + unpkg (o
  // runtime baixa sob demanda os .wasm de física/navmesh/boolean/ui de unpkg) +
  // 'wasm-unsafe-eval' p/ instanciar esses WASM ('wasm-unsafe-eval' NÃO permite
  // eval de JS — bem mais restrito que 'unsafe-eval').
  const splineConnect = "https://*.spline.design https://unpkg.com";
  const splineImg = "https://*.spline.design";

  // Wallet connect (Reown/WalletConnect): só libera os domínios quando há
  // projectId configurado — mantém a CSP mínima quando a carteira está desligada.
  const walletOn = (process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "").length > 0;
  const wcConnect = walletOn
    ? "https://*.walletconnect.org https://*.walletconnect.com " +
      "wss://relay.walletconnect.org wss://relay.walletconnect.com " +
      "https://rpc.walletconnect.org https://pulse.walletconnect.org " +
      "https://api.web3modal.org https://api.mainnet-beta.solana.com " +
      // Conector "Base Account" (Coinbase): telemetria (cca-lite) + RPC/wallet.
      "https://cca-lite.coinbase.com https://*.coinbase.com"
    : "";
  const wcImg = walletOn
    ? "https://imagedelivery.net https://explorer-api.walletconnect.com"
    : "";
  const wcFrame = walletOn
    ? "https://secure.walletconnect.org https://*.walletconnect.org"
    : "";
  // A modal da Reown/AppKit injeta a fonte via Google Fonts em runtime:
  // o <link> do CSS vem de fonts.googleapis.com (style-src) e os arquivos
  // .woff2 de fonts.gstatic.com (font-src). Só liberado com a carteira ligada.
  const wcStyle = walletOn ? "https://fonts.googleapis.com" : "";
  const wcFont = walletOn ? "https://fonts.gstatic.com" : "";

  // Mídia dos embeds do Discord (GIF/imagem/vídeo). Usamos SEMPRE a `proxyURL`
  // do Discord — ele reencaminha QUALQUER provedor (klipy/tenor/giphy/…) por
  // estes hosts, então liberamos só o proxy dele (não cada provedor externo).
  const discordMedia =
    "https://*.discordapp.net https://cdn.discordapp.com https://media.discordapp.net";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} 'wasm-unsafe-eval' ${turnstile}`,
    `style-src 'self' 'unsafe-inline' ${wcStyle}`,
    `font-src 'self' data: ${wcFont}`,
    // Avatar re-hospedado (nossa API) + fallback Google + data/blob (assets inline) + ícones de carteiras + texturas do Spline.
    `img-src 'self' data: blob: ${api} ${app} https://*.googleusercontent.com ${discordMedia} ${wcImg} ${splineImg}`,
    // Vídeo/GIF (gifv) dos embeds do Discord — sem media-src cairia no default-src.
    `media-src 'self' data: blob: ${discordMedia}`,
    `connect-src 'self' ${api} ${apiWs} ${turnstile} ${wcConnect} ${splineConnect} ${isDev ? "ws: wss:" : ""}`,
    `frame-src ${turnstile} ${wcFrame}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.map((d) => d.replace(/\s+/g, " ").trim()).join("; ");
}

/** Aplica os security headers a uma resposta e a retorna. */
function withSecurityHeaders(response: NextResponse, isDev: boolean): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(isDev));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
  return response;
}

export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const { pathname, search } = request.nextUrl;

  // NOTA: a canonicalização de host (www → apex `deepalpha.fun`) é feita na
  // camada de DOMÍNIO da Vercel (Settings → Domains: apex como Primary, `www`
  // com "Redirect to deepalpha.fun"), NÃO aqui. Fazer o redirect também no
  // middleware criava loop (Vercel apex→www vs. middleware www→apex).

  const isAuthed = request.cookies.get(SESSION_HINT_COOKIE)?.value === "1";

  // Logado tentando abrir login/cadastro → Home.
  if (isAuthed && isAuthEntryPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Deslogado em rota protegida → login (preservando o destino em `next`).
  if (!isAuthed && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return withSecurityHeaders(NextResponse.next(), isDev);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
