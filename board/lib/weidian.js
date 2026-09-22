/* 微店 — the shop that already has the licences.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS. aozhoubaba.com can hold the story, the face and the
 * photographs; it cannot hold WeChat Pay, because that needs an ICP filing, a
 * verified 服务号 and a 微信支付商户号 in a Chinese company's name — months,
 * not days. Weidian has all three. So the board is the shopfront and Weidian
 * is the till: a buyer reads about him here and pays there.
 *
 * THIS FILE READS. IT NEVER WRITES AN ORDER AND NEVER TOUCHES MONEY. What it
 * fetches is the catalogue, the orders that have already happened and the
 * reviews people left, so the numbers on the shopfront are counted rather
 * than typed. The buy button is a link to Weidian and that is the whole of
 * the payment integration. Anything here that started creating orders would
 * be settling for somebody else, which is the line docs/cross-border-payments
 * .md draws and the reason the money is never ours.
 *
 * THE PROTOCOL, WHICH IS TWO JSON BLOBS IN A QUERY STRING. Taken from the
 * Ruby client at github.com/yanyingwang/weidian_open rather than guessed,
 * because open.weidian.com and wiki.open.weidian.com cannot be reached from
 * this box and a signature scheme invented from memory fails silently:
 *
 *   GET /token?grant_type=client_credential&appkey=…&secret=…
 *     -> { result: { access_token, expire_in } }
 *
 *   GET /api?public=<json>&param=<json>
 *     public = { method, access_token, version: "1.0", format: "json" }
 *     param  = whatever that method takes
 *
 * Method names are dotted — vdian.order.list.get, vdian.item.list.get.
 *
 * NO SDK, for the same reason lib/stripe.js has none: this is four calls and
 * a query string, and the official package would be a dependency tree on a
 * box that has deliberately kept three.
 *
 * WHAT IS NOT KNOWN HERE, AND IS NOT GUESSED. The exact field names each
 * method answers with. They are in a wiki this machine cannot open, and a
 * mapping written from memory is the kind of wrong that shows up as an empty
 * shelf rather than an error. So `raw()` is exported, scripts/weidian.check
 * .mjs prints whatever comes back, and the mapping gets written once
 * somebody has run it against a real shop with real keys.
 * ------------------------------------------------------------------------ */
const API = "https://api.vdian.com";
const KEY = (process.env.BOARD_WEIDIAN_KEY || "").trim();
const SECRET = (process.env.BOARD_WEIDIAN_SECRET || "").trim();

/** Off unless both halves are set — the same rule as every other optional
 *  part of this box. Everything else asks here first; the calls themselves
 *  throw rather than returning null. */
export const configured = () => Boolean(KEY && SECRET);

/* Twenty seconds, as in lib/stripe.js and for the same reason: a request
   that stalls is a shelf that never draws, and anything past this is not an
   honest answer, it is a hang. */
const PATIENCE = 20_000;

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(PATIENCE) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* they sent prose */ }
  if (!res.ok) throw new Error(`weidian ${res.status}: ${text.slice(0, 300)}`);
  /* THE ENVELOPE IS NOT THE ANSWER. Weidian returns 200 with the failure
     inside `status`, so a caller that only checked res.ok would treat "your
     token expired" as a shop with nothing in it. */
  const code = json?.status?.status_code;
  if (code !== undefined && String(code) !== "0") {
    throw new Error(`weidian ${code}: ${json?.status?.status_reason || "refused"}`);
  }
  return json;
}

/* THE TOKEN, CACHED, AND REFRESHED EARLY.
   Two minutes of headroom, which is what the Ruby client uses: a token that
   expires between the check and the call fails the call, and on a catalogue
   fetch that is a blank shop rather than a retry. */
let token = "";
let until = 0;

async function accessToken() {
  if (!configured()) throw new Error("weidian is not configured");
  if (token && Date.now() < until) return token;
  const url = `${API}/token?grant_type=client_credential`
    + `&appkey=${encodeURIComponent(KEY)}&secret=${encodeURIComponent(SECRET)}`;
  const j = await get(url);
  const r = j?.result || {};
  if (!r.access_token) throw new Error("weidian: no access_token in " + JSON.stringify(j).slice(0, 200));
  token = String(r.access_token);
  until = Date.now() + (Number(r.expire_in) || 600) * 1000 - 120_000;
  return token;
}

/** One call, as the wire wants it. Exported because the check script prints
 *  what comes back and that is how the field names get learned. */
export async function raw(method, param = {}) {
  const pub = {
    method: String(method),
    access_token: await accessToken(),
    version: "1.0",
    format: "json",
  };
  const q = new URLSearchParams({ public: JSON.stringify(pub), param: JSON.stringify(param) });
  return get(`${API}/api?${q.toString()}`);
}

/** The catalogue. `page_num` is 1-based on this API, not 0. */
export const items = (page = 1, size = 50) =>
  raw("vdian.item.list.get", { page_num: String(page), page_size: String(size) });

/** Orders in a window. `order_type` is theirs — "unpay", "pay", and so on —
 *  and is left to the caller rather than guessed at here. */
export const orders = ({ page = 1, type = "", from = "", to = "" } = {}) =>
  raw("vdian.order.list.get", {
    page_num: String(page),
    ...(type ? { order_type: type } : {}),
    ...(from ? { add_start: from } : {}),
    ...(to ? { add_end: to } : {}),
  });

/** One item, for the detail a list leaves out. */
export const item = (id) => raw("vdian.item.get", { itemID: String(id) });
