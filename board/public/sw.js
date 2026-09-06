/* A service worker whose only job is to remove itself.
 *
 * WHY THIS FILE EXISTS AND WHY IT MUST NOT BE DELETED
 *
 * A service worker belongs to an ORIGIN, not to an app. Whatever was served
 * here before this board keeps its worker registered in every browser that
 * ever loaded it: sitting in front of every request, serving its own cached
 * bundles, updating on its own schedule. Putting a different site on the same
 * hostname does not remove it. The people most likely to be hurt are the ones
 * who liked the old thing enough to add it to their home screen.
 *
 * A browser checks /sw.js for a new version of whatever it has registered. So
 * this is the one file that can reach those installs — but only if it is
 * served at exactly this path, on that hostname, and differs from the old one.
 * It registers, takes over, throws away every cache on the origin, and
 * unregisters itself. After that the browser has no worker here and the board
 * is served the ordinary way.
 *
 * It is harmless on an origin that never had one: nothing is registered, so
 * nothing ever asks for this, and the board itself never registers it.
 *
 * Delete it and anyone still carrying the old worker keeps being served a dead
 * app from their own disk, with no way to know why and nothing they can do
 * about it short of clearing site data.
 */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Every cache on this origin, whoever wrote it. Enumerated rather than
    // matched by prefix on purpose: the point is to leave nothing behind, and
    // a prefix means knowing what the previous occupant called things.
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    // Reload whatever is open, so somebody looking at a stale page from the
    // old app gets this one now rather than whenever they next happen back.
    for (const client of await self.clients.matchAll({ type: "window" })) {
      try { client.navigate(client.url); } catch { /* some clients cannot */ }
    }
  })());
});

// Nothing is intercepted while this is briefly in control. Having no fetch
// handler at all would behave the same way, but saying so is the point of the
// file: it serves nothing, it only clears up.
