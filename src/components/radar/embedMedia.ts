/**
 * Extrai mídia (GIF/imagem/vídeo) dos embeds capturados do Discord, para
 * renderizar como o Discord (ex.: link de GIF vira o próprio GIF).
 *
 * Preferimos SEMPRE a `proxyURL` do Discord: ela reencaminha qualquer provedor
 * (klipy/tenor/giphy/…) por `*.discordapp.net`, único host liberado na CSP.
 */

export interface EmbedMediaItem {
  /** `video` = gifv/vídeo (mp4, autoplay/loop/mudo); `image` = imagem/gif estático. */
  kind: "video" | "image";
  src: string;
  /** Pôster do vídeo (thumbnail), quando houver. */
  poster?: string;
  width?: number;
  height?: number;
}

interface EmbedAsset {
  url?: string;
  proxyURL?: string;
  width?: number;
  height?: number;
}
interface Embed {
  type?: string;
  url?: string;
  title?: string;
  image?: EmbedAsset | null;
  video?: EmbedAsset | null;
  thumbnail?: EmbedAsset | null;
}

/** Prioriza a proxyURL do Discord (CSP-friendly); cai na url de origem. */
function pick(asset: EmbedAsset | null | undefined): string | undefined {
  return asset?.proxyURL || asset?.url || undefined;
}

/** Lista a mídia renderizável dos embeds (na ordem em que aparecem). */
export function getEmbedMedia(embed: unknown): EmbedMediaItem[] {
  if (!Array.isArray(embed)) return [];
  const out: EmbedMediaItem[] = [];
  for (const raw of embed) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Embed;
    const type = e.type;

    // gifv/video → vídeo mp4 (comporta como GIF: autoplay/loop/mudo).
    if (e.video && (type === "gifv" || type === "video")) {
      const src = pick(e.video);
      if (src) {
        out.push({
          kind: "video",
          src,
          poster: pick(e.thumbnail),
          width: e.video.width,
          height: e.video.height,
        });
        continue;
      }
    }

    // Imagem direta.
    const img = e.image && pick(e.image) ? e.image : null;
    if (img) {
      out.push({ kind: "image", src: pick(img)!, width: img.width, height: img.height });
      continue;
    }

    // Embed só com thumbnail de imagem (ex.: link de imagem).
    if (type === "image" && e.thumbnail && pick(e.thumbnail)) {
      out.push({
        kind: "image",
        src: pick(e.thumbnail)!,
        width: e.thumbnail.width,
        height: e.thumbnail.height,
      });
    }
  }
  return out;
}

/**
 * True quando o texto da mensagem é ESSENCIALMENTE só o link/título do embed —
 * caso em que renderizamos só a mídia (o "texto" é redundante com o GIF).
 */
export function isEmbedOnlyText(text: string, embed: unknown): boolean {
  if (!Array.isArray(embed) || embed.length === 0) return false;
  let t = text;
  for (const raw of embed) {
    const e = raw as Embed;
    if (e?.url) t = t.split(e.url).join(" ");
    if (e?.title) t = t.split(e.title).join(" ");
  }
  return t.replace(/\s+/g, "").length === 0;
}
