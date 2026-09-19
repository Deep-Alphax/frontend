import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/api/alerts";

/**
 * Estado do push NESTE navegador:
 *  - `unsupported`: sem Service Worker/Push (ex.: iOS fora do app instalado);
 *  - `disabled`: o backend está sem chaves VAPID (ambiente sem push);
 *  - `denied`: o usuário bloqueou notificações — só ele desfaz, nas configs do navegador;
 *  - `off` / `on`: pode ativar / já ativo.
 */
export type PushState = "unsupported" | "disabled" | "denied" | "off" | "on";

const SW_URL = "/sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** A chave VAPID vem em base64url; o `subscribe` quer os bytes crus. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  return existing ?? navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/**
 * Pede permissão, inscreve o navegador e registra no backend. Precisa vir de
 * um GESTO do usuário (clique): navegadores barram o pedido de permissão fora
 * disso. Devolve o estado final para a UI.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const key = await getPushPublicKey();
  if (!key) return "disabled";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));
  await savePushSubscription(sub.toJSON());
  return "on";
}

/** Desinscreve ESTE navegador (os outros aparelhos do usuário seguem ativos). */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    // Backend primeiro: se ele falhar, o navegador continua inscrito e a UI
    // não mente dizendo "desligado" enquanto os pushes seguem chegando.
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}
