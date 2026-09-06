/* The service worker. Two jobs, and the first one predates the second.
 *
 * ---------------------------------------------------------------------------
 * 1. CLEARING UP AFTER WHOEVER WAS HERE BEFORE — do not remove this
 *
 * A service worker belongs to an ORIGIN, not to an app. Whatever was served on
 * this hostname before the board keeps its worker registered in every browser
 * that ever loaded it: sitting in front of every request, serving its own
 * cached bundles. Putting a different site on the same hostname does not
 * remove it, and the people most likely to be hurt are the ones who liked the
 * old thing enough to add it to their home screen.
 *
 * A browser checks /sw.js for a new version of whatever it has registered, so
 * this file is the only thing that can reach those installs. It takes over and
 * deletes every cache on the origin that is not its own — which is what the
 * previous version of this file did before unregistering itself. It no longer
 * unregisters, because the board now has its own use for a worker; the
 * clearing-up half is unchanged and still runs first.
 *
 * ---------------------------------------------------------------------------
 * 2. MAKING THE BOARD SURVIVE A BAD CONNECTION
 *
 * NETWORK FIRST, ALWAYS. The cache is a fallback for when the network fails,
 * never a shortcut when it works.
 *
 * This is the whole design and it is deliberate. A cache-first worker is how a
 * page gets served from somebody's disk for weeks after it changed, with no
 * way for them to know why — and on a board, where the entire content is other
 * people's newest words, showing yesterday's copy quickly is worse than
 * showing today's copy slowly. Offline is the only case where a stale answer
 * beats no answer.
 */

const CACHE = "board-v1";

// The shell: enough to open and be recognisable with no network. Deliberately
// not the API — a cached /api/board is a cached set of somebody's posts, and
// those go stale in minutes and may have been taken down since.
const SHELL = [
  "/feed", "/buddies", "/site.css", "/i18n.js", "/live.js",
  "/favicon.png", "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Individually, and never fatal: one missing file must not stop the worker
    // installing, or a typo here breaks the site for everyone who has it.
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Job one. Every cache on this origin that is not this version's, whoever
    // wrote it — the previous occupant's, and our own older ones.
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never the API, and never media. A cached post is a post that may have been
  // reported and taken down; serving it from a phone's disk would put back
  // something a person decided to remove.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      // Only successful, complete responses are worth keeping. A 404 or an
      // opaque redirect cached as the shell is how a site breaks silently.
      if (fresh && fresh.ok && fresh.type === "basic") {
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return fresh;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      // A navigation with nothing cached for it still deserves the app rather
      // than the browser's offline page, if the shell is there.
      if (req.mode === "navigate") {
        const shell = await caches.match("/feed");
        if (shell) return shell;
      }
      throw new Error("offline and nothing cached");
    }
  })());
});
