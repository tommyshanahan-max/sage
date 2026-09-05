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

/** One upstream call carrying a file.
 *
 *  Separate from `call` because the two differ in the one thing that matters
 *  here: `call` sets its own content-type, and multipart's content-type
 *  carries a boundary that only the FormData encoder knows. Setting it by hand
 *  produces a request the other side cannot parse, and the failure looks like
 *  a bad payload rather than a bad header.
 *
 *  Multipart rather than base64 JSON, unlike the cover route: a cover is a
 *  small image, this carries video to 25 MB, and base64 makes that a 33 MB
 *  body for no gain. */
export async function callForm(path, form, { method = "POST", timeoutMs = 60_000 } = {}) {
  if (!KEY) return { status: 503, body: { error: "STUDYPAL_ADMIN_KEY is not set" } };

  try {
    const r = await fetch(BASE + path, {
      method,
      // No content-type: fetch derives it from the FormData, boundary and all.
      headers: { "x-admin-secret": KEY },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await r.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 2000) }; }
    return { status: r.status, body: parsed };
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || /aborted/i.test(err?.message || "");
    return {
      status: 504,
      body: { error: timedOut ? `no answer within ${timeoutMs / 1000}s` : (err?.message || "could not reach Study Pal") },
    };
  }
}

// A clip can be 25 MB and the upload is the slow part, so this gets a budget
// sized for the file rather than the one sized for reading a counter.
export const PUBLISH_TIMEOUT_MS = 120_000;

/** A call whose secret travels in the query string.
 *
 *  Study Pal's /api/public takes it that way rather than in a header. Not this
 *  side's choice, and worth one note rather than a silent accommodation: a
 *  secret in a query string is a secret in a proxy log and in a browser's
 *  history, which is exactly why this is called from the server and never from
 *  the page. The key stays on the box either way.
 *
 *  Encoded rather than concatenated: a key with a + or an & in it would
 *  otherwise arrive as a different key, and the failure would look like a
 *  wrong secret rather than a mangled one. */
export async function callWithKeyInQuery(path, { timeoutMs = 20_000 } = {}) {
  if (!KEY) return { status: 503, body: { error: "STUDYPAL_ADMIN_KEY is not set" } };
  const sep = path.includes("?") ? "&" : "?";
  const url = BASE + path + sep + "secret=" + encodeURIComponent(KEY);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    let parsed;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 2000) }; }
    return { status: r.status, body: parsed };
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || /aborted/i.test(err?.message || "");
    return {
      status: 504,
      body: { error: timedOut ? `no answer within ${timeoutMs / 1000}s` : (err?.message || "could not reach Study Pal") },
    };
  }
}
