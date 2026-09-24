/* MONEY, ON YOUR OWN PAGE — asking, sending, what is owed and the wallet, in
   one card.

   There were two money screens and neither was here. Dealio (the Money tab)
   asks somebody for money and lists what is still owed; the wallet
   (wallet-card.js) sends and receives between members and sat at the foot of
   Profile as an orange card saying "Set up your wallet". Somebody who wanted
   to be paid had two places to look and a tab to find. This is the one place,
   drawn after the AGT screen Tom liked: the totals on a dark card, the two
   buttons under them, and the list.

   EVERY BUTTON GOES STRAIGHT TO ITS SHEET — /dealio?ask=in and friends, see
   the note over ASK in dealio.html. The card is the door; the work still
   happens on the page that does it.

   NOT IN THE APP. /dealio is webOnly on the server (see the note over it in
   server.js), so in the app every one of these buttons would bounce back to
   the board. The caller does not mount it there, and the app keeps the old
   wallet card exactly as it was.

   Draws nothing for somebody the server does not know: no card is better
   than a card with a zero on it that refuses to open. */

const STYLE = `
  .mcard{margin:1.2rem 1.15rem 0;border-radius:1.3rem;padding:1.1rem 1.1rem .5rem;
    background:#151B28;color:#fff}
  @media (prefers-color-scheme:dark){.mcard{background:#1B212D;border:1px solid #232B39}}
  .mcard .mtop{display:flex;align-items:center;justify-content:space-between;
    font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.7}
  .mcard .mtot{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.8rem 0 .9rem}
  .mcard .mtot div{background:rgba(255,255,255,.08);border-radius:.9rem;padding:.65rem .8rem}
  .mcard .mtot b{display:block;font-size:1.45rem;font-weight:700;line-height:1.15;
    font-variant-numeric:tabular-nums}
  .mcard .mtot small{font-size:.8rem;opacity:.75}
  .mcard .mtot .due b{color:#F2B25C}
  .mcard .mgo{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
  .mcard .mgo.one{grid-template-columns:1fr}
  .mcard .mgo a{display:block;text-align:center;text-decoration:none;font-weight:700;
    font-size:1rem;border-radius:.9rem;padding:.85rem .5rem;color:#fff;
    background:rgba(255,255,255,.12)}
  .mcard .mgo a.ask{background:#4F7BEF}
  .mcard .mlab{margin:1.1rem 0 .1rem;font-size:.78rem;font-weight:700;
    letter-spacing:.1em;text-transform:uppercase;opacity:.6}
  .mcard a.mrow{display:flex;justify-content:space-between;align-items:center;gap:.8rem;
    padding:.75rem 0;border-top:1px solid rgba(255,255,255,.1);color:#fff;text-decoration:none}
  .mcard .mrow b{display:block;font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mcard .mrow small{display:block;font-size:.8rem;opacity:.65}
  .mcard .mrow .ma{flex:0 0 auto;text-align:right;font-size:1.05rem;font-weight:700;
    font-variant-numeric:tabular-nums}
  .mcard .mrow .ma em{display:block;font-style:normal;font-size:.68rem;letter-spacing:.08em;
    text-transform:uppercase;color:#F2B25C}
  .mcard .mrow > div:first-child{min-width:0}
  .mcard .mfoot{display:flex;flex-wrap:wrap;justify-content:space-between;column-gap:.8rem;
    border-top:1px solid rgba(255,255,255,.1);margin-top:.2rem}
  .mcard .mfoot a{color:#fff;opacity:.72;text-decoration:none;font-size:.88rem;padding:.8rem 0;white-space:nowrap}
  .mcard .mfoot a.wal{opacity:1;font-weight:600;color:#F2B25C}
`;
function style() {
  if (document.getElementById("money-card-css")) return;
  const s = document.createElement("style");
  s.id = "money-card-css";
  s.textContent = STYLE;
  document.head.append(s);
}
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; };
const link = (c, x, href) => { const a = el("a", c, x); a.href = href; return a; };

const SIGN = { cny: "¥", usd: "$", aud: "A$", hkd: "HK$", eur: "€", gbp: "£", jpy: "¥" };

/** The amount as typed, with its sign put on when it was typed without one. */
function shown(q) {
  const a = String(q.amount || "");
  return /^\d/.test(a) && SIGN[q.cur] ? SIGN[q.cur] + a : a;
}
const num = (q) => parseFloat(String(q.amount || "").replace(/[^\d.]/g, "")) || 0;

/** A total, but only when every row is in the same money. ¥2,000 plus $100 is
 *  not a number, so a mixed list is counted instead of added. */
function total(rows) {
  if (!rows.length) return { big: "0", mixed: false };
  const curs = new Set(rows.map((q) => q.cur || ""));
  if (curs.size > 1) return { big: String(rows.length), mixed: true };
  const n = rows.reduce((s, q) => s + num(q), 0);
  const sign = SIGN[[...curs][0]] || "";
  return { big: sign + Math.round(n).toLocaleString("en-US"), mixed: false };
}

const ago = (iso) => {
  const m = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (!iso || !isFinite(m)) return "";
  if (m < 60) return Math.max(1, Math.round(m)) + "m";
  if (m < 1440) return Math.round(m / 60) + "h";
  return Math.round(m / 1440) + "d";
};

export async function mountMoneyCard(container, { device, T }) {
  if (!container || !device) return;
  const get = (u) => fetch(u, { cache: "no-store", headers: { "x-board-device": device } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [st, wal] = await Promise.all([get("/api/requests"), get("/api/wallet")]);
  if (!st || !st.you) return;
  style();

  const reqs = (st.requests || []).filter((q) => !q.off);
  const open = reqs.filter((q) => q.state !== "paid");
  const dueIn = open.filter((q) => (q.way || "in") === "in");
  const month = new Date().toISOString().slice(0, 7);
  const got = reqs.filter((q) => q.state === "paid" && (q.way || "in") === "in"
    && String(q.at || "").slice(0, 7) === month);

  const card = el("section", "mcard");
  card.setAttribute("aria-label", T("pm.head"));
  const top = el("div", "mtop");
  top.append(el("span", null, T("pm.head")));
  card.append(top);

  /* THE TWO NUMBERS FIRST — what came in this month, and what is still owed
     to you — because "is anybody paying me" is why this card is opened. */
  const tot = el("div", "mtot");
  const a = total(got), b = total(dueIn);
  const t1 = el("div");
  /* A DASH, NOT A ZERO. An empty month printed a bare "0" next to ¥38,500,
     which reads as a figure that failed to load rather than as nothing having
     come in. Nothing is not a quantity; it is said in words. */
  t1.append(got.length
    ? el("b", null, a.big) : el("b", null, "\u2014"),
    el("small", null, T(got.length ? (a.mixed ? "pm.gotN" : "pm.got") : "pm.gotNone")));
  const t2 = el("div", "due");
  t2.append(el("b", null, b.big), el("small", null, T(b.mixed ? "pm.dueN" : "pm.due", { n: dueIn.length })));
  tot.append(t1, t2);
  card.append(tot);

  const canSend = st.canSend !== false;
  const go = el("div", "mgo" + (canSend ? "" : " one"));
  go.append(link("ask", T("dl.make"), "/dealio?in=1&ask=in"));
  if (canSend) go.append(link("", T("pm.send"), "/dealio?in=1&ask=out"));
  card.append(go);

  /* WHAT IS STILL OWED, three at most — the rest is one tap away on the page
     that holds all of it. */
  if (open.length) {
    card.append(el("p", "mlab", T("dl.sub")));
    for (const q of open.slice(0, 3)) {
      const r = link("mrow", undefined, "/dealio?in=1");
      const left = el("div");
      const title = q.to || q.what || T("dl.someone");
      left.append(el("b", null, title), el("small", null,
        [T(q.way === "out" ? "dl.rowOut" : "dl.rowIn"), q.what === title ? "" : q.what, ago(q.at)]
          .filter(Boolean).join(" · ")));
      const right = el("div", "ma", shown(q));
      right.append(el("em", null, T("dl.st." + q.state)));
      r.append(left, right);
      card.append(r);
    }
  }

  /* THE FOOT: where the money lands, all of it, and the wallet. The wallet
     used to be its own orange card further down; it is one line of this one
     now, and the loud one only while it still needs setting up. */
  const foot = el("div", "mfoot");
  foot.append(link("", T("dl.whereMoney") + " ›", "/dealio?in=1&ask=where"));
  if (wal) {
    foot.append(wal.wallet
      ? link("", T("pm.wallet") + " ›", "/wallet")
      : link("wal", T("pm.walletSet") + " ›", "/wallet#setup"));
  } else if (open.length > 3) {
    foot.append(link("", T("pm.all") + " ›", "/dealio?in=1"));
  }
  card.append(foot);

  container.append(card);
}
