/* MONEY, ON YOUR OWN PAGE — a wallet card and who owes you.

   There were two money screens and neither was here. Dealio (the Money tab)
   asks somebody for money and lists what is still owed; the wallet
   (wallet-card.js) sends and receives between members and sat at the foot of
   Profile as an orange card saying "Set up your wallet". This is the one
   place on Profile for both.

   IT HAS BEEN SIX SHAPES IN AN AFTERNOON, and each one lost something:
   a dark block of totals (the loudest thing on the page), a folding row (the
   numbers hidden behind a tap), a row that opened into tiles, a list, two
   buttons and a setup row (everything at once). What Tom drew last is the
   nearly this; then two tiles; then, from three options, one big number on
   white — and then, the same minute, the option beside it: a blue card like
   the ones in Apple Wallet, over a white card of the people who owe it. The invoice numbers and "where your money lands" are on the
   Money tab, one tap behind the chevron, which is where the detail of a
   thing belongs.

   Ask and Send stay, small, at the foot of the card: asking for money from
   Profile is the reason this card exists.

   NOT IN THE APP. /dealio is webOnly on the server (see the note over it in
   server.js), so in the app every link here would bounce back to the board.
   The caller does not mount it there.

   Draws nothing for somebody the server does not know: no card is better
   than a card with a zero on it that refuses to open. */

const STYLE = `
  .mbank{display:flex;flex-direction:column;justify-content:space-between;gap:.9rem;
    margin:.8rem 1.15rem 0;min-height:10rem;padding:1.1rem 1.15rem;border-radius:1.25rem;
    color:#fff;text-decoration:none;background:linear-gradient(135deg,#1B2A8C,#3F68D8);
    box-shadow:0 8px 24px rgba(27,42,140,.25)}
  .mbank .mbtop{display:flex;justify-content:space-between;font-weight:600;opacity:.92}
  .mbank small{display:block;font-size:.85rem;opacity:.8}
  .mbank b{display:block;font-size:2.3rem;font-weight:800;line-height:1.1;
    font-variant-numeric:tabular-nums}
  .mbank .mbfoot{display:flex;gap:1.2rem;font-size:.85rem;opacity:.9}
  .mbank .mbfoot:empty{display:none}
  .mcard{margin:.7rem 1.15rem 0;border-radius:1.1rem;background:var(--card,#fff);
    color:var(--ink,#151B28);padding:.4rem 1rem .9rem;
    box-shadow:0 1px 3px rgba(21,27,40,.05),0 6px 18px rgba(21,27,40,.06)}
  .mcard a.mrow{display:flex;align-items:center;gap:.8rem;padding:.7rem 0;
    color:inherit;text-decoration:none}
  .mcard a.mrow + a.mrow{border-top:1px solid var(--hair,#EAECF1)}
  .mcard .mface{flex:0 0 auto;width:2.6rem;height:2.6rem;border-radius:50%;color:#fff;
    display:grid;place-items:center;font-weight:600;font-size:1.1rem}
  .mcard .mrow b{flex:1;min-width:0;font-size:1.02rem;font-weight:500;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  .mcard .mamt{flex:0 0 auto;font-size:1rem;font-variant-numeric:tabular-nums}
  .mcard .mpill{flex:0 0 auto;font-size:.8rem;font-weight:600;color:#C2561B;
    background:#FDE6D6;border-radius:.45rem;padding:.2rem .5rem}
  .mcard .mgo{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.6rem}
  .mcard .mgo.one{grid-template-columns:1fr}
  .mcard .mgo a{display:block;text-align:center;text-decoration:none;font-weight:600;
    font-size:.95rem;border-radius:99px;padding:.65rem .5rem;white-space:nowrap;
    color:var(--ink,#151B28);border:1px solid var(--line,#E3E6EC)}
  .mcard .mgo a.ask{background:var(--accent,#3F68D8);border-color:var(--accent,#3F68D8);
    color:var(--accent-ink,#fff)}
  .mcard a.mset{display:block;margin-top:.7rem;text-align:center;font-size:.88rem;
    font-weight:600;color:var(--accent,#3F68D8);text-decoration:none}
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

/** Soft colours, one per name, so the same person is the same circle. */
const TINT = ["#6FA8E8", "#F2A07B", "#6CC49A", "#9C92E0", "#E88A9B", "#5DB3C4"];
const tint = (name) => TINT[[...String(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % TINT.length];
/** "C" for Christopher, "RT" for Ray Tan — two letters when there are two names. */
const initials = (name) => String(name).trim().split(/\s+/).slice(0, 2)
  .map((w) => [...w][0] || "").join("").toUpperCase() || "?";

export async function mountMoneyCard(container, { device, T }) {
  if (!container || !device) return;
  const get = (u) => fetch(u, { cache: "no-store", headers: { "x-board-device": device } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [st, wal] = await Promise.all([get("/api/requests"), get("/api/wallet")]);
  if (!st || !st.you) return;
  style();

  const reqs = (st.requests || []).filter((q) => !q.off);
  const incoming = reqs.filter((q) => (q.way || "in") === "in");
  const dueIn = incoming.filter((q) => q.state !== "paid");
  const paidIn = incoming.filter((q) => q.state === "paid");
  const month = new Date().toISOString().slice(0, 7);
  const paidMonth = paidIn.filter((q) => String(q.at || "").slice(0, 7) === month);
  // An empty tile in the money this person usually asks in — "¥0", not "0".
  const cur = (reqs[0] && reqs[0].cur) || "cny";

  /* A CARD, LIKE THE ONES IN APPLE WALLET — Tom's pick of three, after
     one big number on white. Blue, the size of a bank card: "Owed to you"
     and the amount, large; earned and this month along the foot. It is the
     way to the Money tab, where the invoice numbers and the rest live.
     Under it, one white card with the people who owe it and the buttons.
     Nothing owed, and the big number is what came in this month instead.
     Mixed currencies are counted, never added — see total(). */
  const owed = total(dueIn, cur), got = total(paidMonth, cur), all = total(paidIn, cur);
  const bank = link("mbank", undefined, "/dealio?in=1");
  const top = el("div", "mbtop");
  top.append(el("span", null, T("pm.wallet")), el("span", null, T("site.title")));
  const mid = el("div");
  mid.append(el("small", null, T(dueIn.length ? (owed.mixed ? "pm.reqsOwed" : "pm.owedTo") : "pm.inMonth")),
    el("b", null, dueIn.length ? owed.big : got.big));
  const foot = el("div", "mbfoot");
  if (!all.mixed) foot.append(el("span", null, T("pm.earnedAll", { amount: all.big })));
  if (dueIn.length && !got.mixed) foot.append(el("span", null, T("pm.thisMonth", { amount: got.big })));
  bank.append(top, mid, foot);
  container.append(bank);

  const card = el("section", "mcard");

  if (dueIn.length) {
    for (const q of dueIn.slice(0, 3)) {
      const r = link("mrow", undefined, "/dealio?in=1");
      const name = q.to || q.what || T("dl.someone");
      const face = el("span", "mface", initials(name));
      face.style.background = tint(name);
      r.append(face, el("b", null, name), el("span", "mamt", shown(q)),
        el("span", "mpill", T("dl.st." + q.state)));
      card.append(r);
    }
  }

  const canSend = st.canSend !== false;
  const go = el("div", "mgo" + (canSend ? "" : " one"));
  go.append(link("ask", T("dl.make"), "/dealio?in=1&ask=in"));
  if (canSend) go.append(link("", T("pm.send"), "/dealio?in=1&ask=out"));
  card.append(go);

  /* Only while there is something to set up; after that it is behind the
     chevron with everything else. */
  if (wal && !wal.wallet) card.append(link("mset", T("pm.walletSet") + " ›", "/wallet#setup"));

  container.append(card);
}
