/* X, BY HAND, INCLUDING THE SIGNATURE.
 *
 * UNTESTED AGAINST X. Written from their reference; no app existed when it was
 * written. Read the OAuth section below before changing anything in it — a
 * signature that is wrong by one character is a 401 with no hint about which
 * character.
 *
 * WHY OAUTH 1.0a AND NOT A BEARER TOKEN. App-only bearer auth cannot post: it
 * has no user to post as. Posting is OAuth 1.0a with four values — the app's
 * key and secret, and Tom's own access token and secret — all four of which X
 * hands over in one screen when the app is created. OAuth 2.0 user-context is
 * the other option and it brings a refresh dance and an expiring token; four
 * static strings and 30 lines of HMAC is the cheaper trade for one poster.
 *
 * WHY THE UPLOAD IS CHUNKED. The simple upload caps at 5MB and video does not
 * fit in it. INIT, then APPEND per 4MB slice, then FINALIZE, then wait for the
 * processing to say succeeded — a video is not postable the instant the bytes
 * land, and posting too early fails with a media id that "does not exist".
 *
 * WHAT MAY STOP THIS DEAD, and it is not code: on X's free tier posting is
 * allowed but media upload generally is not. If the upload answers 403 with a
 * message about access level, that is a subscription decision for Tom, not a
 * bug to fix here — so the error says exactly that rather than "failed".
 */
import { createHmac, randomBytes } from "node:crypto";

const UPLOAD = "https://upload.twitter.com/1.1/media/upload.json";
const TWEETS = "https://api.x.com/2/tweets";
const CHUNK = 4 * 1024 * 1024;
const PATIENCE = 30_000;

export function configured() {
  return Boolean(
    process.env.POST_X_KEY && process.env.POST_X_SECRET &&
    process.env.POST_X_TOKEN && process.env.POST_X_TOKEN_SECRET,
  );
}

/* RFC 3986, not encodeURIComponent. The difference is ! * ' ( ) — left alone
   by encodeURIComponent and required to be escaped here. Every "signature does
   not match" that is not a clock problem is this. */
const enc = (s) => encodeURIComponent(String(s)).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/** The Authorization header for one request. `params` must contain every
 *  oauth_* value AND every query parameter, because the signature covers both;
 *  it must NOT contain the body when the body is multipart, because X excludes
 *  that. Getting that split wrong is the other 401. */
function sign(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: process.env.POST_X_KEY,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: process.env.POST_X_TOKEN,
    oauth_version: "1.0",
  };
  const all = { ...oauth, ...params };
  const base = [
    method.toUpperCase(),
    enc(url),
    enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join("&")),
  ].join("&");
  const key = `${enc(process.env.POST_X_SECRET)}&${enc(process.env.POST_X_TOKEN_SECRET)}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(", ");
}

async function form(url, fields) {
  const body = new URLSearchParams(fields);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: sign("POST", url, fields), "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(PATIENCE),
  });
  const text = await res.text();
  let d = null;
  try { d = text ? JSON.parse(text) : null; } catch { /* X sent prose */ }
  if (!res.ok) {
    if (res.status === 403 && /access level|not permitted|client-not-enrolled/i.test(text)) {
      throw new Error("x refused: this account's API tier does not include media upload");
    }
    if (res.status === 401) throw new Error("x refused the signature or the token — see post/README.md");
    throw new Error(`x ${res.status}: ${(d?.errors?.[0]?.message || text).slice(0, 200)}`);
  }
  return d;
}

/** Post a video. Returns { id, url }. */
export async function upload({ file, say }) {
  const { stat } = await import("node:fs/promises");
  const { open } = await import("node:fs/promises");
  const size = (await stat(file)).size;

  const init = await form(UPLOAD, {
    command: "INIT", total_bytes: String(size), media_type: "video/mp4", media_category: "tweet_video",
  });
  const id = init?.media_id_string;
  if (!id) throw new Error("x gave no media id");

  /* APPEND is multipart and its body is NOT part of the signature, so the
     signed params here are only the oauth ones plus nothing else. */
  const fh = await open(file, "r");
  try {
    let index = 0;
    for (let at = 0; at < size; at += CHUNK) {
      const buf = Buffer.alloc(Math.min(CHUNK, size - at));
      await fh.read(buf, 0, buf.length, at);
      const fd = new FormData();
      fd.append("command", "APPEND");
      fd.append("media_id", id);
      fd.append("segment_index", String(index));
      fd.append("media", new Blob([buf]));
      const res = await fetch(UPLOAD, { method: "POST", headers: { Authorization: sign("POST", UPLOAD) }, body: fd });
      if (!res.ok) throw new Error(`x append ${index} ${res.status}: ${(await res.text()).slice(0, 160)}`);
      index++;
    }
  } finally {
    await fh.close();
  }

  const fin = await form(UPLOAD, { command: "FINALIZE", media_id: id });

  /* X transcodes before the video can be posted. processing_info says how long
     to wait and it is not optional: posting early fails with an error about a
     media id that does not exist, which sounds like the upload failed when it
     did not. */
  let info = fin?.processing_info;
  while (info && (info.state === "pending" || info.state === "in_progress")) {
    await new Promise((r) => setTimeout(r, Math.max(1, Number(info.check_after_secs) || 5) * 1000));
    const url = `${UPLOAD}?command=STATUS&media_id=${id}`;
    const res = await fetch(url, {
      headers: { Authorization: sign("GET", UPLOAD, { command: "STATUS", media_id: id }) },
    });
    const d = await res.json().catch(() => ({}));
    info = d?.processing_info;
    if (info?.state === "failed") throw new Error(`x could not process the video: ${info?.error?.message || ""}`);
  }

  /* The post. v2 takes JSON and a bearer-style OAuth 1.0a header over the URL
     with no query parameters, so the signature covers the oauth values alone. */
  const res = await fetch(TWEETS, {
    method: "POST",
    headers: { Authorization: sign("POST", TWEETS), "Content-Type": "application/json" },
    body: JSON.stringify({ text: String(say || "").slice(0, 280), media: { media_ids: [id] } }),
    signal: AbortSignal.timeout(PATIENCE),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`x post ${res.status}: ${(d?.detail || d?.title || "").slice(0, 200)}`);
  const tweet = d?.data?.id;
  if (!tweet) throw new Error("x accepted the post but returned no id");
  return { id: tweet, url: `https://x.com/i/status/${tweet}` };
}
