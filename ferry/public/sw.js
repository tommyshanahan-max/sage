/* The service worker: what makes this a thing on a home screen rather than a
 * page, and the only place a notification can be drawn from.
 *
 * IT CACHES THE SHELL AND NOT ONE WORD OF ANYBODY'S CONVERSATION. The page,
 * the icons and the manifest — four files that never change between visits.
 * Every request to /api/ goes to the network and is never stored: a cache of
 * replies would be a copy of the room sitting in a place the page's own
 * promise says nothing about, and "encrypted on the server" means little if
 * the browser quietly keeps the plaintext beside it.
 *
 * WHAT A NOTIFICATION MAY SAY. Nothing, because nothing is what this knows.
 * The server cannot read the line it is telling you about — it has no key —
 * so the push carries no payload at all and the wording here is fixed. That
 * is a limitation and it is also the honest shape: a lock screen is the least
 * private surface a phone has, and a product that cannot leak a message there
 * is better than one that promises not to.
 */

const SHELL = "ferry-shell-v1";
const FILES = ["/", "/app.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== location.origin) return;
  // Never the rooms. See above.
  if (url.pathname.startsWith("/api/")) return;

  /* A room's address is /r/<id> and every one of them is the same page, so the
     shell answers for all of them — which is also what makes the app open
     instantly on a phone with no signal, showing the conversation it already
     has decrypted in its own storage. */
  const want = url.pathname.startsWith("/r/") ? "/" : url.pathname;
  e.respondWith((async () => {
    const hit = await caches.match(want);
    if (hit) {
      // Freshened in the background, so a deploy reaches an installed app on
      // its second open rather than never.
      e.waitUntil((async () => {
        try {
          const live = await fetch(want, { cache: "no-store" });
          if (live && live.ok) (await caches.open(SHELL)).put(want, live.clone());
        } catch { /* offline, which is when the cache is doing its job */ }
      })());
      return hit;
    }
    return fetch(e.request);
  })());
});

/* THE PUSH CARRIES NOTHING, so there is nothing to parse and nothing to get
   wrong. One wording, one tag so a burst of replies is one notification
   rather than eleven, and the room id only as the thing to open. */
self.addEventListener("push", (e) => {
  let room = "";
  try { room = (e.data && e.data.json().room) || ""; } catch { /* no payload */ }
  e.waitUntil(self.registration.showNotification("Ferry", {
    body: "Somebody wrote to you.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "ferry-" + (room || "room"),
    renotify: true,
    data: { room },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const room = (e.notification.data && e.notification.data.room) || "";
  const to = room ? "/r/" + room : "/";
  e.waitUntil((async () => {
    /* THE KEY IS NOT IN THIS ADDRESS and must not be — a service worker has no
       business holding one. An already-open tab is focused instead wherever
       there is one, and a cold open lands on a room this device already
       remembers the key for. */
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if (c.url.includes(to) && "focus" in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(to);
  })());
});
