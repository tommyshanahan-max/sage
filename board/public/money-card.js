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
  .mcard .mbody{padding:.2rem 1rem 1rem;border-top:1px solid var(--hair,#EAECF1)}
  /* OPENED, IT IS THE MOCKUP TOM DREW: "Owed", a white list of people with a
     face, the amount and a chevron, the two buttons under it, and the wallet
     as a row of its own. */
  .mcard .mtiles{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin:.9rem 0 .3rem}
  .mcard .mtiles div{background:var(--card,#fff);border:1px solid var(--line,#E3E6EC);
    border-radius:.9rem;padding:.75rem .4rem;text-align:center;min-width:0}
  .mcard .mti{display:block;color:var(--accent,#3F68D8)}
  .mcard .mti svg{width:1.3rem;height:1.3rem;fill:none;stroke:currentColor;stroke-width:2;
    stroke-linecap:round;stroke-linejoin:round}
  .mcard .mtiles div:first-child .mti{color:#2A9D63}
  .mcard .mtiles .pend .mti,.mcard .mtiles .pend b{color:#B8661A}
  .mcard .mtiles small{display:block;font-size:.75rem;color:var(--ink-2,#4E5968);margin:.3rem 0 .1rem}
  .mcard .mtiles b{display:block;font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mcard .mtiles em{display:block;font-style:normal;font-size:.7rem;color:var(--muted,#8A939F)}
  .mcard .mohead{display:flex;justify-content:space-between;align-items:baseline;margin:.9rem .1rem .5rem}
  .mcard .mohead b{font-size:1.05rem}
  .mcard .mohead a{font-size:.88rem;font-weight:600;color:var(--accent,#3F68D8);text-decoration:none}
  .mcard .mrow .mamt{flex:0 0 auto;font-weight:700;font-variant-numeric:tabular-nums}
  .mcard .mlist{background:var(--card,#fff);border-radius:1rem;overflow:hidden;
    box-shadow:0 1px 3px rgba(21,27,40,.06),0 6px 18px rgba(21,27,40,.06)}
  .mcard .mlist a.mrow{padding:.85rem 1rem;border-top:1px solid var(--hair,#EAECF1)}
  .mcard .mlist a.mrow:first-child{border-top:0}
  .mcard .mface{flex:0 0 auto;width:2.6rem;height:2.6rem;border-radius:50%;color:#fff;
    display:grid;place-items:center;font-weight:700;font-size:1.15rem}
  .mcard .mrow .mid{flex:1;min-width:0}
  .mcard .mrow .mchv{flex:0 0 auto;color:var(--muted,#8A939F);font-size:1.4rem;line-height:1}
  .mcard .mi{display:inline-grid;place-items:center}
  .mcard .mi svg{width:1.15rem;height:1.15rem;fill:none;stroke:currentColor;stroke-width:2;
    stroke-linecap:round;stroke-linejoin:round}
  .mcard .mgo a{display:flex!important;align-items:center;justify-content:center;gap:.4rem;
    white-space:nowrap;font-size:.95rem!important;
    border-radius:.9rem!important;padding:.85rem .5rem!important}
  .mcard .mgo a.ask{background:var(--card,#fff)!important;color:var(--ink,#151B28)!important;
    border:1.5px solid var(--line,#D5DAE3)!important}
  .mcard .mgo a.snd{background:#0B2A7A!important;color:#fff!important;border-color:#0B2A7A!important}
  .mcard a.mset{display:flex;align-items:center;gap:.8rem;margin-top:.8rem;padding:.85rem 1rem;
    border-radius:1rem;background:var(--hair,#EAECF1);color:inherit;text-decoration:none}
  .mcard a.mset .mico{width:2.4rem;height:2.4rem}
  .mcard a.mset b{display:block;font-size:1rem}
  .mcard a.mset small{display:block;font-size:.85rem;color:var(--ink-2,#4E5968)}
  .mcard a.mset > span:nth-child(2){flex:1;min-width:0}
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
  let a = String(q.amount || "");
  /* Commas on a bare run of digits — "2,000", never "2000". Anything typed
     with its own separators is left exactly as it was. */
  if (/^\d+$/.test(a)) a = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return /^\d/.test(a) && SIGN[q.cur] ? SIGN[q.cur] + a : a;
}
/** One colour per name, so the same person is the same circle every time. */
const TINT = ["#3F68D8", "#E0A13A", "#2A9D63", "#7268C4", "#D4485C", "#2F8C9E"];
const tint = (name) => TINT[[...String(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % TINT.length];
const SVG = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  wallet: '<path d="M3 7h18v12H3z"/><path d="M3 7l3-3h12l3 3"/><path d="M16 13h2"/>',
};
const icon = (k) => {
  const i = el("span", "mi");
  i.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + SVG[k] + "</svg>";
  return i;
};
const num = (q) => parseFloat(String(q.amount || "").replace(/[^\d.]/g, "")) || 0;

/** A total, but only when every row is in the same money. ¥2,000 plus $100 is
 *  not a number, so a mixed list is counted instead of added. */
function total(rows, cur = "") {
  if (!rows.length) return { big: (SIGN[cur] || "") + "0", mixed: false };
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
  const paidIn = reqs.filter((q) => q.state === "paid" && (q.way || "in") === "in");
  const month = new Date().toISOString().slice(0, 7);
  const paidMonth = paidIn.filter((q) => String(q.at || "").slice(0, 7) === month);

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

  /* THREE NUMBERS ACROSS THE TOP — earned, in this month, pending. Added up
     only within one currency; a mixed list is counted instead, and the tile
     says "paid" or "requests" so a count never passes for an amount. */
  const tiles = el("div", "mtiles");
  const tile = (cls, ico, label, rows, sub) => {
    // An empty tile in the money this person usually asks in — "¥0", not "0".
    const t = total(rows, (reqs[0] && reqs[0].cur) || "cny");
    const d = el("div", cls);
    const i = el("span", "mti");
    i.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ico + "</svg>";
    d.append(i, el("small", null, label), el("b", null, t.big));
    const under = t.mixed ? T("pm.nPaid", { n: rows.length }) : sub;
    if (under) d.append(el("em", null, under));
    tiles.append(d);
  };
  tile("", '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>', T("pm.earned"), paidIn, "");
  tile("", '<path d="M12 4v12"/><path d="M6 11l6 6 6-6"/><path d="M5 20h14"/>', T("pm.inMonth"), paidMonth, "");
  tile("pend", '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', T("pm.pending"), dueIn,
    dueIn.length ? T(dueIn.length === 1 ? "pm.req1" : "pm.reqN", { n: dueIn.length }) : "");
  body.append(tiles);

  /* OWED — the people, not the buttons. What is owed is why this was
     opened; the buttons are for next time. */
  if (open.length) {
    const oh = el("div", "mohead");
    oh.append(el("b", null, T("pm.owedHead")), link("", T("pm.all") + " \u203A", "/dealio?in=1"));
    body.append(oh);
    const list = el("div", "mlist");
    for (const q of open.slice(0, 3)) {
      const r = link("mrow", undefined, "/dealio?in=1");
      const title = q.to || q.what || T("dl.someone");
      const face = el("span", "mface", [...title][0].toUpperCase());
      face.style.background = tint(title);
      const mid = el("div", "mid");
      mid.append(el("b", null, title));
      /* Its state and its invoice number under the name; the amount on the
         right, where the eye goes for a number. */
      mid.append(el("small", null, [T("dl.st." + q.state),
        q.no ? T("rq.no", { n: String(q.no).padStart(4, "0") }) : ""].filter(Boolean).join(" \u00b7 ")));
      r.append(face, mid, el("span", "mamt", shown(q)), el("span", "mchv", "\u203A"));
      list.append(r);
    }
    body.append(list);
  }

  const canSend = st.canSend !== false;
  const go = el("div", "mgo" + (canSend ? "" : " one"));
  const ask = link("ask", undefined, "/dealio?in=1&ask=in");
  ask.append(icon("plus"), el("span", null, T("dl.make")));
  go.append(ask);
  if (canSend) {
    const snd = link("snd", undefined, "/dealio?in=1&ask=out");
    snd.append(icon("send"), el("span", null, T("pm.send")));
    go.append(snd);
  }
  body.append(go);

  /* WHERE THE MONEY LANDS, AS A ROW OF ITS OWN — and while the wallet still
     needs setting up, that is what the row says under it. */
  const set = link("mset", undefined, wal && !wal.wallet ? "/wallet#setup" : "/dealio?in=1&ask=where");
  const sico = el("span", "mico");
  sico.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + SVG.wallet + "</svg>";
  const stx = el("span");
  stx.append(el("b", null, T("dl.whereMoney")));
  if (wal && !wal.wallet) stx.append(el("small", null, T("pm.walletSet")));
  set.append(sico, stx, el("span", "mchv", "\u203A"));
  body.append(set);
  card.append(body);

  container.append(card);
}
