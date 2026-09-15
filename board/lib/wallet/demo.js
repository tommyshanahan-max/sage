// The wallet as a public demo, for somewhere with no members to log in as —
// crowdfundme.app/wallet.
//
// EVERY VISITOR GETS THEIR OWN SANDBOX. A cookie names it; inside it are four
// invented people — a new member, Mikko in Helsinki, Mia in Sydney, Wei in
// Shanghai — with wallets already set up, a balance, a card, and a request
// waiting. The visitor picks who to be and can switch, so a payment sent as
// Mikko can be accepted as Mia a moment later. Nobody sees anybody else's
// sandbox, and nothing is written to disk: sandboxes live in memory and are
// dropped after a few hours or when there are too many.
//
// The engine is the real one — service.js, the same rules, the same refunds —
// against the stand-in provider. Only who-is-who is different.

import express from "express";
import { randomBytes, createHmac } from "node:crypto";
import { openLedger } from "./ledger.js";
import { createMockProvider } from "./providers/mock.js";
import { createWalletService } from "./service.js";
import { createWalletRouter } from "./routes.js";

export const PERSONAS = [
  { key: "you", handle: "You", role: "New member · no wallet yet", region: "" },
  { key: "mikko", handle: "Mikko", role: "Director · Helsinki", region: "FI" },
  { key: "mia", handle: "Mia", role: "Producer · Sydney", region: "AU" },
  { key: "wei", handle: "Wei", role: "Director · Shanghai", region: "CN" },
];
const member = (p) => ({ id: `demo${p.key}`.padEnd(20, "0").slice(0, 20), by: `demo_${p.key}`, handle: p.handle, role: p.role });
const settle = () => new Promise((r) => setTimeout(r, 15));

async function seed(svc, provider) {
  const M = Object.fromEntries(PERSONAS.map((p) => [p.key, member(p)]));
  const pass = async (url) => { await provider.completeSession(url.split("/").pop(), true); await settle(); };
  const ready = async (key, region) => { await svc.setup(M[key], { region, acceptedTerms: true }); await pass((await svc.startVerify(M[key], "/wallet")).url); };

  await ready("mikko", "FI");
  await pass((await svc.startConnect(M.mikko, "card", "/wallet")).url);
  const mikkoCard = (await svc.state(M.mikko)).wallet.sources[0].id;
  const top = await svc.topup(M.mikko, { amount: "300", sourceId: mikkoCard, returnUrl: "/wallet" });
  if (top.next) await pass(top.next);

  await ready("mia", "AU");
  await svc.setPayout(M.mia, { mode: "bank", details: { accountName: "Mia Nguyen", bsb: "062000", accountNumber: "12345678", bankName: "Bank account" } });
  await svc.setPayout(M.mia, { mode: "wallet" });
  await pass((await svc.startConnect(M.mia, "card", "/wallet")).url);
  const miaCard = (await svc.state(M.mia)).wallet.sources[0].id;
  await svc.topup(M.mia, { amount: "120", sourceId: miaCard, returnUrl: "/wallet" });

  await ready("wei", "CN");
  await svc.setPayout(M.wei, { mode: "bank", details: { accountName: "王伟", bankName: "China Merchants Bank", accountNumber: "6225881234567890" } });

  await svc.createRequest(M.mia, { toMemberId: M.mikko.id, amount: "80", note: "Script coverage" });
  await settle();
}

export function createDemoHost({ secret = randomBytes(16).toString("hex"), max = 300, ttlMs = 6 * 3600 * 1000 } = {}) {
  const boxes = new Map(); // sid -> { router, used, ready }
  const sign = (v) => createHmac("sha256", secret).update(v).digest("hex").slice(0, 24);

  function sidOf(req, res) {
    const raw = /(?:^|;\s*)wallet_demo=([^;]+)/.exec(req.get("cookie") || "");
    if (raw) {
      const [id, mac] = decodeURIComponent(raw[1]).split(".");
      if (id && mac && sign(id) === mac) return id;
    }
    const id = randomBytes(12).toString("hex");
    const secure = req.secure || req.get("x-forwarded-proto") === "https";
    res.append("Set-Cookie", `wallet_demo=${id}.${sign(id)}; Path=/; Max-Age=${Math.floor(ttlMs / 1000)}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
    return id;
  }

  function sweep() {
    const now = Date.now();
    for (const [k, b] of boxes) if (now - b.used > ttlMs) boxes.delete(k);
    while (boxes.size > max) {
      const oldest = [...boxes.entries()].sort((a, b) => a[1].used - b[1].used)[0];
      boxes.delete(oldest[0]);
    }
  }

  function makeBox() {
    const ledger = openLedger(null);
    const provider = createMockProvider({ speed: 0.5 });
    const people = new Map(PERSONAS.map((p) => [p.key, member(p)]));
    const byId = new Map([...people.values()].map((m) => [m.id, m]));
    const byHash = new Map([...people.values()].map((m) => [m.by, m]));
    const service = createWalletService({ ledger, provider, people: { byId: (id) => byId.get(id) || null, byHash: (h) => byHash.get(h) || null } });

    const identify = async (req) => people.get(String(req.get("x-board-device") || "")) || people.get("you");
    identify.people = async (me) => {
      const wallets = await ledger.read((d) => d.wallets);
      return PERSONAS.map(member).filter((m) => m.by !== me.by)
        .map((m) => ({ id: m.id, handle: m.handle, role: m.role, hasWallet: Boolean(wallets[m.by] && wallets[m.by].status !== "closed"), region: wallets[m.by]?.region || "" }));
    };
    const passkeys = { check: async () => false, confirmOptions: async () => ({ needsPasskey: true }), registrationOptions: async () => { throw new Error("no passkeys in the demo"); }, register: async () => ({ ok: false }) };
    const router = createWalletRouter({
      service, passkeys, provider, identify, testConfirm: true,
      extraState: async (me) => ({ demo: { as: PERSONAS.find((p) => member(p).by === me.by)?.key || "you", personas: PERSONAS.map((p) => ({ key: p.key, handle: p.handle, role: p.role })) } }),
    });
    const box = { router, used: Date.now(), ready: seed(service, provider).catch((e) => console.error("wallet demo seed", e.message)) };
    return box;
  }

  const router = express.Router();
  router.post("/api/wallet/demo/reset", (req, res) => {
    const sid = sidOf(req, res);
    boxes.delete(sid);
    res.json({ ok: true });
  });
  router.use(async (req, res, next) => {
    if (!/^\/(api\/)?wallet(\/|$)/.test(req.path)) return next();
    const sid = sidOf(req, res);
    let box = boxes.get(sid);
    if (!box) { box = makeBox(); boxes.set(sid, box); sweep(); }
    box.used = Date.now();
    await box.ready;
    box.router(req, res, next);
  });
  return { router, size: () => boxes.size };
}
