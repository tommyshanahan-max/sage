/* Can this box reach Study Pal's counter?
 *
 * The app figures on the numbers page are fetched live from another machine.
 * When that fetch fails they all empty at once, and the page cannot say why —
 * so this asks the question directly, from inside the container that actually
 * makes the call, with the same address and the same key.
 *
 *   make app-check
 * -------------------------------------------------------------------------- */

const tries = [
  ["count", process.env.ANALYTICS_APP_COUNT_URL, null],
  ["usage", process.env.ANALYTICS_APP_USAGE_URL, process.env.ANALYTICS_APP_USAGE_KEY],
];

for (const [name, url, key] of tries) {
  if (!url) {
    console.log(`${name.padEnd(6)} not configured — no address set for it`);
    continue;
  }
  // The address is printed without its query string: it can carry an app name,
  // and one day it will carry something that should not be on a screen.
  let shown = url;
  try { const u = new URL(url); shown = u.origin + u.pathname; } catch { /* print it raw */ }

  const began = Date.now();
  try {
    const r = await fetch(url, {
      headers: key ? { "x-admin-secret": key } : {},
      signal: AbortSignal.timeout(8000),
    });
    const body = (await r.text()).slice(0, 160).replace(/\s+/g, " ");
    const ms = Date.now() - began;
    console.log(`${name.padEnd(6)} ${r.status}  ${ms}ms  ${shown}`);
    if (r.status === 401 || r.status === 403) {
      console.log("       the app refused the key — it was rotated on that side, not here");
    }
    console.log(`       ${body}`);
  } catch (err) {
    const ms = Date.now() - began;
    const why = err?.name === "TimeoutError" ? "no answer within 8s" : (err?.message || String(err));
    console.log(`${name.padEnd(6)} FAILED  ${ms}ms  ${shown}`);
    console.log(`       ${why}`);
  }
}
