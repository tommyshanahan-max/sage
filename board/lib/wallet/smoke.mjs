// DEVELOPMENT ONLY — the two payments the wallet was designed around, run over
// HTTP against a board started with BOARD_WALLET=test and BOARD_WALLET_TEST_CONFIRM=1,
// seeded with dev-seed.mjs. It walks every hand-off page the way a browser would.
//
//   node lib/wallet/smoke.mjs http://localhost:8091

const BASE = process.argv[2] || "http://localhost:8091";
const DEV = { mikko: "dev-device-mikko-fi", mia: "dev-device-mia-au", wei: "dev-device-wei-cn" };
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(who, path, body) {
  const res = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "x-board-device": DEV[who], "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${who} ${path} → ${res.status} ${d.error}: ${d.message}`);
  return d;
}
async function approve(url) {
  const page = await fetch(BASE + url);
  if (!page.ok) throw new Error(`hand-off page ${url} → ${page.status}`);
  const res = await fetch(BASE + url, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "choice=approve" });
  if (res.status !== 303) throw new Error(`hand-off ${url} → ${res.status}`);
  await sleep(50);
}
const confirmation = { test: true };

async function ready(who, region, extra = {}) {
  const st = await api(who, "/api/wallet");
  if (!st.wallet) await api(who, "/api/wallet/setup", { region, acceptedTerms: true });
  if ((await api(who, "/api/wallet")).wallet.verified !== "verified") await approve((await api(who, "/api/wallet/verify", { returnUrl: "/wallet#verify" })).url);
  if (extra.card && !(await api(who, "/api/wallet")).wallet.sources.length) await approve((await api(who, "/api/wallet/sources/connect", { kind: "card", returnUrl: "/wallet#sources" })).url);
  if (extra.bank) await api(who, "/api/wallet/payout", { mode: "bank", details: extra.bank });
  return api(who, "/api/wallet");
}

const people = async (who) => (await api(who, "/api/wallet/people")).people;

try {
  const mikko = await ready("mikko", "FI", { card: true });
  await ready("mia", "AU", { bank: { accountName: "Mia Nguyen", bsb: "062-000", accountNumber: "12345678" } });
  await ready("wei", "CN", { bank: { accountName: "王伟", bankName: "China Merchants Bank", accountNumber: "6225881234567890" } });
  log("set up:", mikko.wallet.regionName, "card", mikko.wallet.sources[0].label);

  const list = await people("mikko");
  const mia = list.find((p) => p.handle === "Mia"), wei = list.find((p) => p.handle === "Wei");

  // Finland → Australia, to Mia's bank.
  let q = await api("mikko", "/api/wallet/quote", { to: mia.id, amount: "120", source: mikko.wallet.sources[0].id });
  log("FI→AU quote:", q.send.text, "+", q.fee.text, "=", q.total.text, "→", q.receive.text, "at", q.rateText);
  let s = await api("mikko", "/api/wallet/send", { quoteId: q.quoteId, note: "Script read-through", room: "film", confirmation, returnUrl: "/wallet#sent" });
  if (s.next) { log("  bank approval page:", s.next); await approve(s.next); }
  await api("mia", `/api/wallet/transfers/${s.id}/accept`, {});
  await sleep(3500);
  let d = await api("mia", `/api/wallet/activity/transfer/${s.id}`);
  log("  Mia sees:", d.state, d.amount.text, "→", d.payoutTo, "|", d.timeline.map((x) => x.state).join(" → "));

  // Finland → China, with a reason, through review.
  q = await api("mikko", "/api/wallet/quote", { to: wei.id, amount: "300", source: mikko.wallet.sources[0].id });
  log("FI→CN quote:", q.total.text, "→", q.receive.text, "reason required:", q.reasonRequired);
  s = await api("mikko", "/api/wallet/send", { quoteId: q.quoteId, reason: "Consulting fee", confirmation, returnUrl: "/wallet#sent" });
  if (s.next) await approve(s.next);
  await api("wei", `/api/wallet/transfers/${s.id}/accept`, {});
  d = await api("wei", `/api/wallet/activity/transfer/${s.id}`);
  log("  Wei right after accepting:", d.state, "|", d.timeline.map((x) => x.state).join(" → "));
  await sleep(9500);
  d = await api("wei", `/api/wallet/activity/transfer/${s.id}`);
  log("  Wei later:", d.state, d.amount.text, "→", d.payoutTo, "|", d.timeline.map((x) => x.state).join(" → "));

  // The room shows it to the two people involved and nobody else.
  log("room cards — Mikko:", (await api("mikko", "/api/wallet/room/film")).cards.length, "Wei:", (await api("wei", "/api/wallet/room/film")).cards.length);

  // Without confirmation, money doesn't move.
  q = await api("mikko", "/api/wallet/quote", { to: mia.id, amount: "5", source: mikko.wallet.sources[0].id });
  try { await api("mikko", "/api/wallet/send", { quoteId: q.quoteId }); log("FAIL: sent without confirmation"); process.exitCode = 1; }
  catch (e) { log("no confirmation →", e.message.split(" → ")[1]); }

  const res = await fetch(BASE + "/api/wallet");
  log("no device →", res.status);
  log("OK");
} catch (err) {
  console.error("SMOKE FAILED:", err.message);
  process.exitCode = 1;
}
