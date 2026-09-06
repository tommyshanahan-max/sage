// The Feed's admin API, from this side of the wall.
//
// ---------------------------------------------------------------------------
// Why this exists beside studypal.js rather than inside it
//
// The two are the same shape — an origin, a shared secret, no CORS — and for a
// while The Feed's queue was reached through the Study Pal client, because the
// route names happened to match. That worked only as long as one deployment
// held both, and it is why moderating The Feed required Study Pal's key: a
// seat that should know nothing about the other product had to be handed its
// credentials to do its own job.
//
// So: one client per product, each with its own base and its own key. A seat
// configured for The Feed has BOARD_ADMIN_KEY and no STUDYPAL_ADMIN_KEY, and
// therefore cannot reach the other app at all — not because a check says so,
// but because the credential is not in the container.
// ---------------------------------------------------------------------------

const BASE = (process.env.BOARD_BASE || "").replace(/\/+$/, "");
const KEY = process.env.BOARD_ADMIN_KEY || "";

export const configured = () => Boolean(BASE && KEY);

/** Where the readers' copy lives, so the panel can send somebody to look at
 *  what they just released rather than describing it. */
export const base = () => BASE;

/** One upstream call carrying a body this side does not parse — a form with a
 *  picture in it. The bytes and the content-type arrive from the browser and
 *  leave untouched, so a photograph never has to be decoded, re-encoded or
 *  held in a string on the way through.
 *
 *  Longer timeout than `call`: this is megabytes over a network, not a row. */
export async function send(path, { method = "POST", contentType, body, timeoutMs = 60_000 } = {}) {
  if (!configured()) {
    return { status: 503, body: { error: "this seat has no Feed credentials" } };
  }
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: { "x-admin-secret": KEY, "content-type": contentType || "application/octet-stream" },
      body,
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
      body: {
        error: timedOut
          ? `no answer within ${timeoutMs / 1000}s — a large picture on a slow link`
          : (err?.message || "could not reach The Feed"),
      },
    };
  }
}

/** One upstream call. Returns the status and the parsed body, and never throws
 *  for an HTTP error — the caller passes both on, so a 401 from the board
 *  arrives here as a 401 rather than as a 500 that hides it. */
export async function call(path, { method = "GET", body, timeoutMs = 15_000 } = {}) {
  if (!configured()) {
    return { status: 503, body: { error: "this seat has no Feed credentials" } };
  }

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
    // A timeout and a refused connection are different problems, and the
    // person waiting deserves to know which.
    const timedOut = err?.name === "TimeoutError" || /aborted/i.test(err?.message || "");
    return {
      status: 504,
      body: {
        error: timedOut
          ? `no answer within ${timeoutMs / 1000}s`
          : (err?.message || "could not reach The Feed"),
      },
    };
  }
}
