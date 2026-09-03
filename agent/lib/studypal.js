// Study Pal's admin API, from this side of the wall.
//
// ---------------------------------------------------------------------------
// Why this is a proxy and not a fetch from the page
//
// The endpoints live on another origin, are gated by a shared secret, and send
// no CORS headers. That is the correct design, not an omission: opening CORS on
// a secret-gated endpoint means the secret has to reach a browser, and a secret
// in client JavaScript is not a secret — it is a published one with extra
// steps. So the key stays here, the browser talks only to us, and the header
// never travels in either direction it should not.
//
// The seat check is the other half and lives at the routes. This app has three
// roles behind one login — owner, partner, prospect — and the spec these
// routes implement was written for a product with one. A bare "is signed in"
// gate here would hand a business partner and a prospective one write and
// publish rights over a live catalogue.
// ---------------------------------------------------------------------------

const BASE = (process.env.STUDYPAL_BASE || "https://liuxuesheng.help").replace(/\/+$/, "");
const KEY = process.env.STUDYPAL_ADMIN_KEY || "";

export const configured = () => Boolean(KEY);

/** Where the reader-facing app lives, so the desk can send somebody to look at
 *  what they just published. Read from here rather than typed into the page:
 *  one place already knows it, and two would eventually disagree. */
export const base = () => BASE;

/** One upstream call. Returns the status and the parsed body, and never throws
 *  for an HTTP error — the caller passes both on, so a 401 from Study Pal
 *  arrives as a 401 here rather than as a 500 that hides it. */
export async function call(path, { method = "GET", body, timeoutMs = 15_000 } = {}) {
  if (!KEY) return { status: 503, body: { error: "STUDYPAL_ADMIN_KEY is not set" } };

  const headers = { "x-admin-secret": KEY };
  if (body !== undefined) headers["content-type"] = "application/json";

  try {
    const r = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await r.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 2000) }; }
    return { status: r.status, body: parsed };
  } catch (err) {
    // A timeout and a refused connection are different problems and the person
    // waiting deserves to know which. Named rather than collapsed to "failed".
    const timedOut = err?.name === "TimeoutError" || /aborted/i.test(err?.message || "");
    return {
      status: 504,
      body: { error: timedOut ? `no answer within ${timeoutMs / 1000}s` : (err?.message || "could not reach Study Pal") },
    };
  }
}

// Writing an episode is a model call. The spec says eight to eleven seconds,
// which is a median — the tail is what times out, so this gets its own budget
// rather than the one sized for reading a counter.
export const GENERATE_TIMEOUT_MS = 45_000;
