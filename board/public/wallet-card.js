/* The wallet where people already are: a card on your own page, and money in
   the rooms you talk in.

   Both ask /api/wallet first and draw nothing if it answers 404 — the wallet
   is off on this board — or 401, somebody who is not a member yet. A page
   that shows a wallet which then refuses to open is worse than a page without
   one. Everything they show links into /wallet, which does the actual work. */

const STYLE = `
  .wcard{margin:1rem 0;border-radius:16px;padding:1rem;background:var(--card,#FCFCFD);border:1px solid var(--line,#E3E6EC);display:grid;gap:.6rem;color:var(--ink,#151B28)}
  .wcard.on{background:#B8661A;color:#fff;border-color:transparent}
  @media (prefers-color-scheme:dark){.wcard.on{background:#E89A4A;color:#1A1206}}
  .wcard .wk{margin:0;font-size:.85rem;opacity:.9}
  .wcard .wv{margin:0;font-size:2rem;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
  .wcard .ws{margin:0;font-size:.9rem;opacity:.92}
  .wcard .wrow{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
  .wcard a{display:block;text-align:center;text-decoration:none;font-weight:700;border-radius:12px;padding:.7rem;border:1px solid currentColor;color:inherit}
  .wcard a.solid{background:#B8661A;color:#fff;border-color:#B8661A}
  .wcard .wdev{margin:0;font-size:.8rem;opacity:.85}
  .wmoney{flex:0 0 auto;width:2.4rem;height:2.4rem;border-radius:50%;border:1px solid var(--line,#E3E6EC);background:var(--card,#FCFCFD);color:var(--ink,#151B28);display:grid;place-items:center;cursor:pointer;font-size:1.05rem;font-weight:700}
  .wxfer{display:block;align-self:flex-start;width:15.5rem;max-width:82%;margin:.2rem 0;border-radius:1rem;overflow:hidden;text-decoration:none;background:#B8661A;color:#fff}
  .wxfer.mine{align-self:flex-end}
  .wxfer.settled{background:#FBEBD9;color:#151B28}
  @media (prefers-color-scheme:dark){.wxfer{background:#E89A4A;color:#1A1206}.wxfer.settled{background:#2B2014;color:#E9EDF5}}
  .wxfer .wt{display:block;padding:.7rem .85rem}
  .wxfer .wa{display:block;font-size:1.1rem;font-weight:700;font-variant-numeric:tabular-nums}
  .wxfer .wf{display:block;font-size:.88rem;opacity:.92}
  .wxfer .wfoot{display:block;background:var(--card,#FCFCFD);color:var(--ink-2,#4E5968);font-size:.82rem;padding:.35rem .85rem}
`;
function style() {
  if (document.getElementById("wallet-card-css")) return;
  const s = document.createElement("style");
  s.id = "wallet-card-css";
  s.textContent = STYLE;
  document.head.append(s);
}
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x !== undefined) n.textContent = x; return n; };

async function walletState(device) {
  try {
    const r = await fetch("/api/wallet", { cache: "no-store", headers: device ? { "x-board-device": device } : {} });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

/** The wallet on your own Profile page. */
export async function mountWalletCard(container, device) {
  if (!container) return;
  const st = await walletState(device);
  if (!st) return;
  style();
  const w = st.wallet;
  const card = el("section", "wcard" + (w ? " on" : ""));
  card.setAttribute("aria-label", "Wallet");
  if (!w) {
    card.append(el("p", "wk", "Wallet"));
    card.append(el("p", "ws", (st.waitingForYou || []).length
      ? `${st.waitingForYou[0].with.handle} sent you ${st.waitingForYou[0].amount.text}. Set up your wallet to accept it.`
      : "Send and receive money with people you've met here."));
    const a = el("a", "solid", "Set up your wallet");
    a.href = "/wallet#setup";
    card.append(a);
  } else {
    card.append(el("p", "wk", "Wallet"));
    card.append(el("p", "wv", w.holdsBalance ? w.balance.text : (w.payoutLabel || "Paid to your bank")));
    const waiting = w.incoming.length, asks = w.requests.filter((r) => r.direction === "in").length;
    card.append(el("p", "ws", waiting ? `${waiting} payment${waiting > 1 ? "s" : ""} waiting for you to accept`
      : asks ? `${asks} request${asks > 1 ? "s" : ""} to pay` : `${w.regionName} · ${w.currency}`));
    const rowEl = el("div", "wrow");
    for (const [text, href] of [["Send", "/wallet#send"], ["Request", "/wallet#request"]]) { const a = el("a", "", text); a.href = href; rowEl.append(a); }
    card.append(rowEl);
    const open = el("a", "", "Open wallet");
    open.href = "/wallet";
    card.append(open);
  }
  if (st.provider === "test") card.append(el("p", "wdev", "In development · test money only"));
  container.append(card);
}

/** A money button in a room's message box, and the money in that room that
 *  involves the person reading. Nobody else's payments are ever shown. */
export async function mountRoomMoney({ talk, write, room, device }) {
  if (!talk || !write || !room) return;
  const st = await walletState(device);
  if (!st) return;
  style();
  if (!write.querySelector(".wmoney")) {
    const b = el("button", "wmoney", "¥");
    b.type = "button";
    b.setAttribute("aria-label", "Send or request money");
    b.addEventListener("click", () => { location.href = `/wallet#send?room=${encodeURIComponent(room)}`; });
    write.prepend(b);
  }
  if (!st.wallet) return;
  let cards = [];
  try {
    const r = await fetch(`/api/wallet/room/${encodeURIComponent(room)}`, { cache: "no-store", headers: { "x-board-device": device } });
    if (r.ok) cards = (await r.json()).cards || [];
  } catch { /* the room still works without them */ }
  for (const c of cards.sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const out = c.direction === "out";
    const settled = !["waiting", "open", "charging"].includes(c.state);
    const a = el("a", "wxfer" + (out ? " mine" : "") + (settled ? " settled" : ""));
    a.href = `/wallet#activity/${c.kind}/${c.id}`;
    const words = c.kind === "request"
      ? (out ? `You asked ${c.with.handle} for ${c.amount.text}` : `${c.with.handle} asked you for ${c.amount.text}`)
      : (out ? `You sent ${c.with.handle} ${c.amount.text}` : `${c.with.handle} sent you ${c.amount.text}`);
    const state = { waiting: out ? "waiting for them to accept" : "tap to accept", open: out ? "waiting for them" : "tap to pay", completed: "done", paid: "paid",
      paying_out: "on its way", declined: "declined", cancelled: "cancelled", returned: "returned" }[c.state] || c.state;
    a.setAttribute("aria-label", `${words}${c.note ? ", for " + c.note : ""}. ${state.charAt(0).toUpperCase() + state.slice(1)}.`);
    const t = el("span", "wt");
    t.append(el("span", "wa", c.amount.text), el("span", "wf", c.note || (c.kind === "request" ? "Request" : "Transfer")));
    const foot = el("span", "wfoot", `${c.kind === "request" ? "Request" : "Transfer"} · ${state}`);
    t.setAttribute("aria-hidden", "true"); foot.setAttribute("aria-hidden", "true");
    a.append(t, foot);
    talk.append(a);
  }
}
