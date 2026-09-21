/*
 * `videoUrl` (digitado no admin) → URL de embed.
 *
 * ALLOWLIST, não normalização: só YouTube e Vimeo viram embed, e qualquer outra
 * coisa devolve `null` para a tela mostrar "vídeo indisponível". O campo é livre
 * no admin e vai para o `src` de um `<iframe>`; aceitar host arbitrário seria
 * embutir página de terceiro dentro do app (e o `frame-src` do `proxy.ts` lista
 * exatamente estes hosts, então qualquer outro seria bloqueado pelo browser de
 * todo jeito — melhor falhar aqui, com mensagem, do que num frame vazio).
 */

export type VideoProvider = "youtube" | "vimeo";

export interface VideoEmbed {
  provider: VideoProvider;
  /** URL pronta para o `src` do iframe. */
  src: string;
}

/** Id de vídeo do YouTube: 11 caracteres de um alfabeto url-safe. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/** Id do Vimeo: só dígitos. */
const VIMEO_ID = /^\d+$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

/** Primeiro segmento não vazio depois de um prefixo conhecido. */
function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function youtubeId(url: URL): string | null {
  // youtu.be/<id>
  if (url.hostname.endsWith("youtu.be")) {
    const [id] = segments(url.pathname);
    return id && YOUTUBE_ID.test(id) ? id : null;
  }
  // youtube.com/watch?v=<id>
  const v = url.searchParams.get("v");
  if (v && YOUTUBE_ID.test(v)) return v;
  // youtube.com/embed/<id> e /shorts/<id> e /live/<id>
  const parts = segments(url.pathname);
  if (parts.length >= 2 && ["embed", "shorts", "live"].includes(parts[0])) {
    return YOUTUBE_ID.test(parts[1]) ? parts[1] : null;
  }
  return null;
}

function vimeoId(url: URL): string | null {
  const parts = segments(url.pathname);
  // player.vimeo.com/video/<id>
  if (parts[0] === "video" && parts[1]) {
    return VIMEO_ID.test(parts[1]) ? parts[1] : null;
  }
  // vimeo.com/<id>
  const [id] = parts;
  return id && VIMEO_ID.test(id) ? id : null;
}

export function toVideoEmbed(videoUrl: string): VideoEmbed | null {
  const raw = videoUrl?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Só https: `http:` num iframe seria mixed content e o browser bloquearia.
  if (url.protocol !== "https:") return null;

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    const id = youtubeId(url);
    if (!id) return null;
    // `-nocookie` não planta o cookie de rastreio antes do play.
    // `rel=0` evita sugerir vídeo de terceiro no fim da aula.
    return {
      provider: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    };
  }

  if (VIMEO_HOSTS.has(url.hostname)) {
    const id = vimeoId(url);
    if (!id) return null;
    return { provider: "vimeo", src: `https://player.vimeo.com/video/${id}` };
  }

  return null;
}

/**
 * `2516582` → `"2.4 MB"`. Base 1024 (o que o sistema de arquivos reporta).
 *
 * `0` devolve string vazia: no banco o zero significa "tamanho desconhecido",
 * e escrever "0 B" ao lado de um PDF real seria informação errada.
 */
const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Bytes inteiros; a partir de KB, uma casa decimal (como o Figma escreve).
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${text} ${UNITS[unit]}`;
}
