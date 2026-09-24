/* MONEY, ON YOUR OWN PAGE — asking, sending, what is owed and the wallet, in
   one card.

   There were two money screens and neither was here. Dealio (the Money tab)
   asks somebody for money and lists what is still owed; the wallet
   (wallet-card.js) sends and receives between members and sat at the foot of
   Profile as an orange card saying "Set up your wallet". Somebody who wanted
   to be paid had two places to look and a tab to find. This is the one place,
   a "Wallet" row that folds open to the two buttons and the list — see the
   note where the row is built for why it is not the dark card it started as.

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
  .mcard{margin:1.2rem 1.15rem 0;border-radius:1.1rem;background:var(--raise,#F7F8FB);
    border:1px solid var(--line,#E3E6EC);color:var(--ink,#151B28);overflow:hidden}
  .mcard summary{list-style:none;display:flex;align-items:center;gap:.75rem;
    padding:.95rem 1rem;cursor:pointer}
  .mcard summary::-webkit-details-marker{display:none}
  .mcard .mico{flex:0 0 auto;width:2.3rem;height:2.3rem;border-radius:.7rem;
    display:grid;place-items:center;background:var(--accent-soft,#E8ECF7);color:var(--accent,#3F68D8)}
  .mcard .mico svg{width:1.25rem;height:1.25rem;fill:none;stroke:currentColor;stroke-width:1.9;
    stroke-linecap:round;stroke-linejoin:round}
  .mcard .mname{flex:1;min-width:0;font-weight:600;font-size:1.05rem}
  .mcard .mowed{flex:0 0 auto;font-size:.85rem;font-weight:700;color:#8A4B0F;
    background:#FBEBD9;border-radius:99px;padding:.25rem .65rem;font-variant-numeric:tabular-nums}
  @media (prefers-color-scheme:dark){.mcard .mowed{background:#2B2014;color:#F2B25C}}
  .mcard .mchev{flex:0 0 auto;color:var(--muted,#8A939F);font-size:1.3rem;line-height:1;
    transition:transform .15s}
  .mcard[open] .mchev{transform:rotate(90deg)}
  .mcard .mbody{padding:0 1rem .4rem;border-top:1px solid var(--hair,#EAECF1)}
  .mcard .mgo{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.9rem 0 .2rem}
  .mcard .mgo.one{grid-template-columns:1fr}
  .mcard .mgo a{display:block;text-align:center;text-decoration:none;font-weight:600;
    font-size:1rem;border-radius:99px;padding:.75rem .5rem;color:var(--ink,#151B28);
    border:1px solid var(--line,#E3E6EC);background:var(--card,#FCFCFD)}
  .mcard .mgo a.ask{background:var(--accent,#3F68D8);border-color:var(--accent,#3F68D8);
    color:var(--accent-ink,#fff)}
  .mcard a.mrow{display:flex;justify-content:space-between;align-items:center;gap:.8rem;
    padding:.75rem 0;border-top:1px solid var(--hair,#EAECF1);color:inherit;text-decoration:none}
  .mcard .mgo + a.mrow{margin-top:.7rem}
  .mcard .mrow > div:first-child{min-width:0}
  .mcard .mrow b{display:block;font-size:1rem;font-weight:600;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  .mcard .mrow small{display:block;font-size:.82rem;color:var(--ink-2,#4E5968)}
  .mcard .mrow .ma{flex:0 0 auto;text-align:right;font-size:1rem;font-weight:700;
    font-variant-numeric:tabular-nums}
  .mcard .mrow .ma em{display:block;font-style:normal;font-size:.7rem;font-weight:600;
    color:var(--muted,#8A939F)}
  .mcard .mfoot{display:flex;flex-wrap:wrap;justify-content:space-between;column-gap:.8rem;
    border-top:1px solid var(--hair,#EAECF1)}
  .mcard .mfoot a{color:var(--ink-2,#4E5968);text-decoration:none;font-size:.9rem;
    padding:.8rem 0;white-space:nowrap}
  .mcard .mfoot a.wal{color:var(--accent,#3F68D8);font-weight:600}
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

  /* ONE ROW, CLOSED, AND IT OPENS DOWNWARD. The first version was a dark
     block of totals and buttons near the top of the page, and on a phone it
     was the loudest thing there — louder than the person the page is about.
     Tom's call: a quiet "Wallet" row further down, like the rows under it,
     that drops open to the buttons and the list. Closed, it still says the
     one thing worth knowing at a glance — what is owed to you — and nothing
     at all when nothing is. */
  const card = el("details", "mcard");
  const sum = el("summary");
  const ico = el("span", "mico");
  ico.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v12H3z"/>'
    + '<path d="M3 7l3-3h12l3 3"/><path d="M16 13h2"/></svg>';
  sum.append(ico, el("span", "mname", T("pm.wallet")));
  const b = total(dueIn);
  if (dueIn.length) sum.append(el("span", "mowed", b.mixed
    ? T("pm.owedN", { n: dueIn.length }) : T("pm.owed", { amount: b.big })));
  sum.append(el("span", "mchev", "\u203A"));
  card.append(sum);

  const body = el("div", "mbody");
  const canSend = st.canSend !== false;
  const go = el("div", "mgo" + (canSend ? "" : " one"));
  go.append(link("ask", T("dl.make"), "/dealio?in=1&ask=in"));
  if (canSend) go.append(link("", T("pm.send"), "/dealio?in=1&ask=out"));
  body.append(go);

  /* WHAT IS STILL OWED, three at most — the rest is one tap away on the page
     that holds all of it. */
  for (const q of open.slice(0, 3)) {
    const r = link("mrow", undefined, "/dealio?in=1");
    const left = el("div");
    const title = q.to || q.what || T("dl.someone");
    left.append(el("b", null, title), el("small", null,
      [T(q.way === "out" ? "dl.rowOut" : "dl.rowIn"), q.what === title ? "" : q.what,
        q.no ? T("rq.no", { n: String(q.no).padStart(4, "0") }) : "", ago(q.at)]
        .filter(Boolean).join(" · ")));
    const right = el("div", "ma", shown(q));
    right.append(el("em", null, T("dl.st." + q.state)));
    r.append(left, right);
    body.append(r);
  }

  /* THE FOOT: where the money lands, and the wallet — blue only while it
     still needs setting up. */
  const foot = el("div", "mfoot");
  foot.append(link("", T("dl.whereMoney") + " \u203A", "/dealio?in=1&ask=where"));
  if (wal && !wal.wallet) foot.append(link("wal", T("pm.walletSet") + " \u203A", "/wallet#setup"));
  else if (wal) foot.append(link("", T("pm.openWallet") + " \u203A", "/wallet"));
  else if (open.length > 3) foot.append(link("", T("pm.all") + " \u203A", "/dealio?in=1"));
  body.append(foot);
  card.append(body);

  container.append(card);
}
