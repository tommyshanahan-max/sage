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

/* Bumped when a shell file changes shape rather than content. v2: /browse is
 * the feed document now, and a browser holding the old standalone page would
 * serve it offline for as long as that cache lived. Activating deletes every
 * cache that is not this one. */
/* v4: the front of this place is /browse. A worker installed under v3 holds a
   shell whose first entry was /feed, and a home-screen icon added then still
   opens there. Bumping the name drops every older cache on activate. */
/* v6: the front is Messages. The app has four tabs now and /notes is the
   first; the manifest's start_url moved with it, so a home-screen icon opens
   on the conversations. /feed leaves the shell entirely — the tab is hidden
   and off.js has it off, and a worker that still caches it can serve a dead
   surface offline to somebody who cannot reach it online. */
const CACHE = "board-v6";

// The shell: enough to open and be recognisable with no network. Deliberately
// not the API — a cached /api/board is a cached set of somebody's posts, and
// those go stale in minutes and may have been taken down since.
/* /buddies came out: the file is still in public/ but nothing routes to it, so
   the entry was a 404 the old cache.add() swallowed without a word. A shell
   list is only worth having if a wrong line in it is loud. */
const SHELL = [
  "/notes", "/browse", "/cards", "/type", "/site.css", "/i18n.js", "/live.js",
  "/favicon.png", "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Individually, and never fatal: one missing file must not stop the worker
    // installing, or a typo here breaks the site for everyone who has it.
    //
    // NOT cache.add — IT FOLLOWS REDIRECTS AND KEEPS THE ANSWER UNDER THE
    // ADDRESS THAT WAS ASKED FOR. Every page in this shell sits behind the
    // door, and a browser that is not admitted gets a 302 to /enter; cache.add
    // follows it, gets a perfectly good 200, and files the password box under
    // /notes. The member that browser later becomes then meets the door every
    // time they open the app without a signal. Fetched by hand so the redirect
    // is visible and can be refused.
    await Promise.all(SHELL.map(async (u) => {
      try {
        const r = await fetch(u, { credentials: "same-origin" });
        if (r.ok && !r.redirected) await cache.put(u, r);
      } catch (e) { /* offline at install, or gone: the shell is a nicety */ }
    }));
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
        // Messages first, Browse behind it. Offline and with nothing cached
        // for this address, the app should open where it opens online — and
        // /browse stays as the fallback's fallback because a worker installed
        // before v6 has that cached and not /notes.
        const shell = await caches.match("/notes") || await caches.match("/browse");
        if (shell) return shell;
      }
      throw new Error("offline and nothing cached");
    }
  })());
});

/* ---------------------------------------------------------------------------
 * THE BUZZ
 *
 * THERE IS NOTHING IN IT AND THAT IS THE DESIGN. The server sends a push with
 * no payload at all — see board/lib/push.js — so there is nothing to parse,
 * nothing to get wrong, and nothing a lock screen can leak. One wording, and
 * the name of whoever wrote is behind the door where it belongs.
 *
 * It is also why this file needs no key and no decryption: the two hard parts
 * of web push, the encryption and the library that does it, are both absent
 * because there is no message to encrypt.
 *
 * ONE TAG, so eleven replies while somebody is asleep are one line on the lock
 * screen and not eleven. renotify so the eleventh still buzzes.
 *
 * THE WORDING IS IN ENGLISH AND CHINESE TOGETHER rather than picked. A service
 * worker has no access to the page's language — it wakes with no page at all —
 * and reading localStorage is not available to it either. Two short halves is
 * honest for a board where both languages are in every room anyway, and it is
 * better than guessing wrong on somebody's lock screen.
 */
/* THE WORKER ASKS WHAT TO SAY NOW, because there are two kinds of push.
 *
 * The note above is still true — this push carries no body and nothing is
 * encrypted — but a worker that cannot read a body also cannot tell a message
 * apart from the daily report card, and "somebody wrote to you" on an evening
 * when nobody did is the app lying on a lock screen.
 *
 * So it fetches /api/wake, which answers with the sentence for whichever kind
 * this is. `credentials: "include"` because the sign-in cookie is the only
 * credential a worker carries: it cannot read localStorage, and it wakes with
 * no page to ask.
 *
 * THE FALLBACK IS THE EXACT LINE THIS FILE USED TO SHOW, and it is reached
 * whenever anything at all goes wrong — offline, a slow answer, a box that
 * has not deployed the route yet. A push that arrives saying the old thing is
 * a worse notification; a push that arrives saying nothing is a lost message.
 *
 * Two and a half seconds. The worker is killed if it takes too long, and a
 * notification that never appeared because a fetch hung is the failure this
 * whole handler exists to avoid.
 */
const SAID = {
  title: "The Exchange 交换",
  body: "Somebody wrote to you · 有人给你留言了",
  to: "/notes",
};

async function whatToSay() {
  try {
    const stop = AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined;
    const r = await fetch("/api/wake", { credentials: "include", cache: "no-store", signal: stop });
    if (!r.ok) return SAID;
    const d = await r.json();
    if (!d || typeof d.body !== "string" || !d.body) return SAID;
    return { title: String(d.title || SAID.title).slice(0, 80),
             body: String(d.body).slice(0, 180),
             to: typeof d.to === "string" && d.to.startsWith("/") ? d.to : "/notes" };
  } catch { return SAID; }
}

self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    const say = await whatToSay();
    await self.registration.showNotification(say.title, {
      body: say.body,
      icon: "/icon-512.png",
      badge: "/favicon.png",
      /* TWO TAGS, NOT ONE. Messages collapse into each other — eleven replies
         overnight are one line — and that is right for messages and wrong
         here: a report card replacing the unread message somebody has not
         looked at yet is the app taking a notification away. */
      tag: say.to.startsWith("/notes") ? "board-note" : "board-card",
      renotify: true,
      data: { to: say.to },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    /* An open tab is focused rather than a second one opened — somebody who
       has the board open on a laptop and taps the phone notification should
       land in the conversation, not in a duplicate window. */
    /* Where the notification itself said to go. A report card is about the
       reader's own page and the numbers on it, not about a conversation, so
       sending it to /notes would land somebody on an empty inbox. */
    const to = (e.notification.data && e.notification.data.to) || "/notes";
    const want = to.split("#")[0] || "/";
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      /* MATCHED ON THE PATH, NOT WITH includes(). The card's address is
         "/#card", whose path is "/" — and includes("/") is true of every URL
         there has ever been, so the first open tab won, whichever screen it
         was on. Somebody reading their messages would have had the card's tap
         focus the inbox and do nothing else. */
      let at = "";
      try { at = new URL(c.url).pathname; } catch { at = ""; }
      if (at !== want || !("focus" in c)) continue;
      /* FOCUS ALONE IS NOT ENOUGH FOR THE CARD. Its address is a hash, and a
         hash only does anything at load — so focusing a tab already sitting
         on the home screen brings up the home screen with both panels still
         shut, which is the thing the tap was supposed to open. Navigating
         re-runs it. Only when there IS a hash, so a message still just
         focuses the inbox as it always has. */
      if (to.includes("#") && c.navigate) {
        try { return await c.navigate(to).then((x) => (x || c).focus()); } catch { /* focus below */ }
      }
      return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(to);
  })());
});
