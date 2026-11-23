"use client";

import type { VideoProvider } from "@/lib/mentorship/video";

/*
 * Ponte para as APIs OFICIAIS dos players embutidos (YouTube IFrame API e
 * Vimeo Player), atrás de uma interface única. Só lê tempo/estado do vídeo —
 * não controla o player, não injeta nada no iframe.
 *
 * Os scripts vêm dos hosts dos próprios provedores e são carregados sob
 * demanda (só na página da aula / no painel do admin), uma vez por página.
 * A CSP (`src/proxy.ts`) libera exatamente esses dois hosts em `script-src`.
 */

export interface PlayerEvents {
  /** ~1×/s enquanto toca: posição e duração em segundos. */
  onTime?: (positionSec: number, durationSec: number) => void;
  onPause?: (positionSec: number, durationSec: number) => void;
  onEnded?: (durationSec: number) => void;
  /** Player pronto, com a duração já conhecida (0 se o provedor não disse). */
  onReady?: (durationSec: number) => void;
}

export interface PlayerHandle {
  destroy: () => void;
}

const YT_API = "https://www.youtube.com/iframe_api";
const VIMEO_API = "https://player.vimeo.com/api/player.js";

// ── Tipos mínimos das APIs (só o que usamos) ────────────────────────────────

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: {
      events: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}
interface VimeoPlayer {
  on(event: string, cb: (data: { seconds: number; duration: number }) => void): void;
  getDuration(): Promise<number>;
  getCurrentTime(): Promise<number>;
  off(event: string): void;
}
interface VimeoNamespace {
  Player: new (el: HTMLIFrameElement) => VimeoPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    Vimeo?: VimeoNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Estados do YouTube que usamos (`YT.PlayerState`). */
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

// ── Carregamento dos scripts (uma vez por página) ───────────────────────────

const loading = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = loading.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loading.delete(src); // deixa tentar de novo numa próxima montagem
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(el);
  });
  loading.set(src, p);
  return p;
}

function youTubeReady(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    // O script chama este global quando termina de montar `YT.Player`.
    // Encadeia em vez de sobrescrever um callback que já exista.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    loadScript(YT_API).catch(reject);
  });
}

async function vimeoReady(): Promise<VimeoNamespace> {
  if (!window.Vimeo?.Player) await loadScript(VIMEO_API);
  if (!window.Vimeo?.Player) throw new Error("Vimeo API unavailable");
  return window.Vimeo;
}

// ── Adaptadores ─────────────────────────────────────────────────────────────

/**
 * Liga os eventos ao iframe JÁ renderizado. Falha de rede ao carregar a API
 * (bloqueador de anúncio, offline) só desliga o rastreio: o vídeo continua
 * tocando, e o "Mark as completed" continua valendo.
 */
export async function attachPlayer(
  iframe: HTMLIFrameElement,
  provider: VideoProvider,
  events: PlayerEvents,
): Promise<PlayerHandle> {
  return provider === "youtube"
    ? attachYouTube(iframe, events)
    : attachVimeo(iframe, events);
}

/**
 * UM `YT.Player` por iframe, com vários ouvintes. Criar um segundo player no
 * mesmo iframe (o efeito do React monta 2× em dev/StrictMode, ou remonta)
 * deixa um deles surdo — visto no E2E: vídeo tocando e nenhum evento.
 */
interface YtEntry {
  player: YTPlayer;
  ready: boolean;
  listeners: Set<PlayerEvents>;
  timer: ReturnType<typeof setInterval> | null;
}
const ytEntries = new WeakMap<HTMLIFrameElement, YtEntry>();

/** Duração do YouTube: vídeo não iniciado às vezes diz 0 até os metadados. */
function readYtDuration(entry: YtEntry, done: (d: number) => void) {
  let tries = 0;
  const read = () => {
    const d = safe(() => entry.player.getDuration());
    if (d > 0 || tries >= 10) done(d);
    else {
      tries += 1;
      setTimeout(read, 500);
    }
  };
  read();
}

async function attachYouTube(
  iframe: HTMLIFrameElement,
  events: PlayerEvents,
): Promise<PlayerHandle> {
  const YT = await youTubeReady();

  let entry = ytEntries.get(iframe);
  if (!entry) {
    const e: YtEntry = {
      player: undefined as unknown as YTPlayer,
      ready: false,
      listeners: new Set(),
      timer: null,
    };
    const stopTicking = () => {
      if (e.timer) clearInterval(e.timer);
      e.timer = null;
    };
    const now = () => safe(() => e.player.getCurrentTime());
    const duration = () => safe(() => e.player.getDuration());
    e.player = new YT.Player(iframe, {
      events: {
        onReady: () => {
          e.ready = true;
          readYtDuration(e, (d) => e.listeners.forEach((l) => l.onReady?.(d)));
        },
        onStateChange: ({ data }) => {
          if (data === YT_PLAYING) {
            // A API do YouTube não emite "timeupdate": consulta 1×/s só
            // enquanto toca (parado, nenhum timer roda).
            stopTicking();
            e.timer = setInterval(() => {
              const t = now();
              const d = duration();
              e.listeners.forEach((l) => l.onTime?.(t, d));
            }, 1000);
          } else if (data === YT_PAUSED) {
            stopTicking();
            const t = now();
            const d = duration();
            e.listeners.forEach((l) => l.onPause?.(t, d));
          } else if (data === YT_ENDED) {
            stopTicking();
            const d = duration();
            e.listeners.forEach((l) => l.onEnded?.(d));
          }
        },
      },
    });
    ytEntries.set(iframe, e);
    entry = e;
  }

  const current = entry;
  current.listeners.add(events);
  // Ouvinte que chega depois do "ready" (remount) ainda recebe a duração.
  if (current.ready && events.onReady) readYtDuration(current, events.onReady);

  return {
    destroy: () => {
      current.listeners.delete(events);
      // Não chama `player.destroy()`: ele REMOVE o iframe do DOM, e quem é
      // dono do iframe é o React. O iframe sai do DOM com o componente e o
      // WeakMap solta a entrada junto.
    },
  };
}

async function attachVimeo(
  iframe: HTMLIFrameElement,
  events: PlayerEvents,
): Promise<PlayerHandle> {
  const Vimeo = await vimeoReady();
  const player = new Vimeo.Player(iframe);
  let destroyed = false;

  player.on("timeupdate", ({ seconds, duration }) => {
    if (!destroyed) events.onTime?.(seconds, duration);
  });
  player.on("pause", ({ seconds, duration }) => {
    if (!destroyed) events.onPause?.(seconds, duration);
  });
  player.on("ended", ({ duration }) => {
    if (!destroyed) events.onEnded?.(duration);
  });
  player
    .getDuration()
    .then((d) => {
      if (!destroyed) events.onReady?.(d);
    })
    .catch(() => {});

  return {
    destroy: () => {
      destroyed = true;
      for (const e of ["timeupdate", "pause", "ended"]) player.off(e);
    },
  };
}

function safe(fn: () => number): number {
  try {
    const n = fn();
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
