// DEVELOPMENT ONLY — the public demo host, exercised over HTTP without
// crowdfundme: two visitors, separate sandboxes, a payment sent as Mikko and
// accepted as Mia inside one of them.
//   node lib/wallet/demo.check.mjs
import express from "express";
import { createDemoHost } from "./demo.js";

const app = express();
const host = createDemoHost({ secret: "check" });
app.use(host.router);
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;
const jar = { a: "", b: "" };
async function call(who, as, path, body) {
  const res = await fetch(base + path, { method: body ? "POST" : "GET", redirect: "manual",
    headers: { cookie: jar[who], "x-board-device": as, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.get("set-cookie"); if (set) jar[who] = set.split(";")[0];
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status} ${d.error} ${d.message}`);
  return d;
}
const ok = (cond, msg) => { console.log((cond ? "ok  " : "FAIL") + " " + msg); if (!cond) process.exitCode = 1; };
try {
  const mikko = await call("a", "mikko", "/api/wallet");
  ok(mikko.demo?.as === "mikko", "visitor A is Mikko");
  ok(mikko.wallet.balance.text === "€300.00", "Mikko starts with €300 (" + mikko.wallet.balance.text + ")");
  ok(mikko.wallet.requests.length === 1, "Mikko has Mia's request waiting");
  const you = await call("a", "", "/api/wallet");
  ok(you.wallet === null && you.demo.as === "you", "no persona → the new member, no wallet");
  const people = (await call("a", "mikko", "/api/wallet/people")).people;
  const mia = people.find((p) => p.handle === "Mia");
  const q = await call("a", "mikko", "/api/wallet/quote", { to: mia.id, amount: "50", source: "wallet" });
  const s = await call("a", "mikko", "/api/wallet/send", { quoteId: q.quoteId, note: "Coffee", confirmation: { test: true } });
  ok(s.state === "waiting", "sent from Mikko's balance: " + q.total.text + " → " + q.receive.text);
  await call("a", "mia", `/api/wallet/transfers/${s.id}/accept`, {});
  const miaAfter = await call("a", "mia", "/api/wallet");
  ok(miaAfter.wallet.balance.text !== "A$120.00", "Mia accepted into her balance: " + miaAfter.wallet.balance.text);
  const other = await call("b", "mikko", "/api/wallet");
  ok(other.wallet.balance.text === "€300.00", "visitor B's Mikko is untouched: " + other.wallet.balance.text);
  await call("a", "mikko", "/api/wallet/demo/reset", {});
  const again = await call("a", "mikko", "/api/wallet");
  ok(again.wallet.balance.text === "€300.00", "reset starts visitor A again");
  ok(host.size() === 2, "two sandboxes in memory");
} catch (err) { console.error("CHECK FAILED:", err.message); process.exitCode = 1; }
server.close();
setTimeout(() => process.exit(), 50);
