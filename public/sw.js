/*
 * Service worker do Deep Alpha — SÓ Web Push (alertas).
 *
 * Não faz cache nem intercepta `fetch` de propósito: um SW que cacheia vira
 * fonte de "o site não atualiza" e de dado velho de sessão. Aqui ele só
 * mostra a notificação e abre o site no clique.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Deep Alpha", body: event.data ? event.data.text() : "" };
  }

  const title = typeof data.title === "string" ? data.title : "Deep Alpha";
  // Só caminho RELATIVO do nosso site: o payload vem do nosso backend, mas o
  // SW não abre origem de terceiros nem que o payload peça.
  const url =
    typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//")
      ? data.url
      : "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      // PNG: SVG não é aceito como ícone de notificação em todo SO (Android).
      icon: "/brand/notification-icon.png",
      badge: "/brand/notification-badge.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      // Reaproveita uma aba do site já aberta em vez de abrir outra.
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const tab of tabs) {
        if (new URL(tab.url).origin === self.location.origin && "focus" in tab) {
          await tab.focus();
          if ("navigate" in tab) await tab.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
