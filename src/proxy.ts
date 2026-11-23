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
  if (pathname === "/register" || pathname.startsWith("/register/"))
    return true;
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
 * Assets referenciados por URL ABSOLUTA (`NEXT_PUBLIC_APP_URL/brand/...`) não são
 * cobertos por `'self'` quando a página é servida no host "irmão" (ex.: www) —
 * liberar os dois hosts torna a CSP resiliente ao host.
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

/**
 * Origem https de uma variável opcional; vazio se ausente ou inválida. Nunca
 * devolve `https:` genérico: um valor torto não pode abrir a CSP inteira.
 */
function optionalHttpsOrigin(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function buildContentSecurityPolicy(isDev: boolean): string {
  const api = apiOrigin();

  // Arquivos da mentoria no Cloudflare R2 (ver DEPLOY.md do backend):
  //   - media: domínio PÚBLICO de leitura (capas no <img>);
  //   - r2Upload: endpoint S3 da conta, para onde o admin faz o PUT assinado.
  //     Origem da NOSSA conta, não `*.r2.cloudflarestorage.com`: o curinga
  //     deixaria um script injetado mandar dados para o bucket de qualquer um.
  const media = optionalHttpsOrigin(process.env.NEXT_PUBLIC_MEDIA_BASE_URL);
  const r2Upload = optionalHttpsOrigin(
    process.env.NEXT_PUBLIC_R2_UPLOAD_ORIGIN,
  );
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

  // Ícones de token do Tracker (CDNs do DexScreener, Helius e Moralis). O front
  // só monta <img> com URL desses hosts (`TokenIcon`), então a liberação é estreita.
  const tokenImg =
    "https://dd.dexscreener.com https://cdn.dexscreener.com https://cdn.helius-rpc.com https://logo.moralis.io";

  // Mídia dos embeds do Discord (GIF/imagem/vídeo). Usamos SEMPRE a `proxyURL`
  // do Discord — ele reencaminha QUALQUER provedor (klipy/tenor/giphy/…) por
  // estes hosts, então liberamos só o proxy dele (não cada provedor externo).
  const discordMedia =
    "https://*.discordapp.net https://cdn.discordapp.com https://media.discordapp.net";

  // Player das aulas da mentoria. Hosts NOMEADOS, não um `https:` geral: o
  // `videoUrl` é digitado no admin, e um frame-src aberto transformaria esse
  // campo em "embute qualquer página de terceiro dentro do app".
  //   - youtube-nocookie: variante sem cookie de rastreio; é a que usamos ao
  //     montar o embed (ver `lib/mentorship/video.ts`).
  //   - youtube.com: o player faz redirect/fallback para ele em alguns casos.
  const videoFrames =
    "https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com";
  // APIs JS OFICIAIS dos players (progresso real das aulas, `lib/mentorship/
  // player.ts`): YouTube carrega `iframe_api` + o widget do mesmo host; Vimeo,
  // `player.vimeo.com/api/player.js`. Hosts nomeados, nunca `https:` geral.
  const videoScripts = "https://www.youtube.com https://player.vimeo.com";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} 'wasm-unsafe-eval' ${turnstile} ${videoScripts}`,
    `style-src 'self' 'unsafe-inline'`,
    // Fontes são self-hosted pelo `next/font` — nada de fonts.gstatic.com.
    `font-src 'self' data:`,
    // Avatar re-hospedado (nossa API) + fallback Google + data/blob (assets inline) + texturas do Spline.
    `img-src 'self' data: blob: ${api} ${app} https://*.googleusercontent.com ${discordMedia} ${splineImg} ${tokenImg} ${media}`,
    // Vídeo/GIF (gifv) dos embeds do Discord — sem media-src cairia no default-src.
    `media-src 'self' data: blob: ${discordMedia}`,
    `connect-src 'self' ${api} ${apiWs} ${turnstile} ${splineConnect} ${r2Upload} ${isDev ? "ws: wss:" : ""}`,
    `frame-src ${turnstile} ${videoFrames}`,
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
function withSecurityHeaders(
  response: NextResponse,
  isDev: boolean,
): NextResponse {
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(isDev),
  );
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
    // Exclui assets estáticos E as rotas de metadata (opengraph-image/twitter-image):
    // crawlers batem nelas DESLOGADOS — sem excluir, o guard de auth as redirecionava
    // pro /login e o preview de link (OG) quebrava. `icon.svg` já cai na regra `.svg$`.
    // `sw.js` (service worker do push): o navegador o rebusca sozinho em segundo
    // plano, e um redirect para /login faz a atualização falhar. É estático e
    // não carrega dado de ninguém.
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|twitter-image|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
