// The wallet's HTTP side: what the browser can ask for, and who is asking.
//
// EVERY ROUTE KNOWS WHO IS CALLING FROM THE BOARD'S OWN IDENTITY — the device
// id the rest of the board uses, resolved to a published member by
// server.js. Somebody on the waiting list, or a stranger holding a link, has
// no wallet and gets a 401 before anything here reads a file.
//
// EVERY ROUTE THAT MOVES MONEY ALSO WANTS A PASSKEY SIGNATURE for exactly that
// action (see passkeys.js). The device id says which member; the passkey says
// the member is the one holding the phone.
//
// The one exception is TEST CONFIRM: with the stand-in provider, and only when
// BOARD_WALLET_TEST_CONFIRM=1, a money route accepts `{ test: true }` instead of
// a signature, because the browsers used to try this — an in-app preview, a
// laptop without Touch ID — cannot make passkeys. It is refused outright when
// the provider is real.

import express from "express";
import { WalletError } from "./service.js";
import { providerPage } from "./pages.js";

export function createWalletRouter({ service, passkeys, provider, identify, testConfirm = false, extraState = null }) {
  const r = express.Router();
  const json = express.json({ limit: "32kb" });
  const allowTest = testConfirm && provider.isTest;

  const origin = (req) => `${req.protocol}://${req.get("host")}`;
  const rp = (req) => ({ rpID: req.hostname, origin: origin(req) });
  const back = (u) => (typeof u === "string" && /^\/wallet(?:[/?#]|$)/.test(u) ? u : "/wallet");

  const run = (fn) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const me = await identify(req);
      if (!me) return res.status(401).json({ error: "not_member", message: "Only members have a wallet." });
      const out = await fn(me, req, res);
      if (!res.headersSent) res.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof WalletError) return res.status(err.status).json({ error: err.code, message: err.message });
      // A real provider that can't do this yet says so, rather than a vague 500.
      if (err.code === "provider_not_ready") return res.status(501).json({ error: err.code, message: err.message });
      console.error("wallet", req.method, req.path, err);
      res.status(500).json({ error: "server", message: "Something went wrong. Nothing was sent." });
    }
  };

  /** Money routes: refuse unless this exact action carries a fresh signature. */
  const confirmed = async (me, req, action, ref) => {
    const c = req.body?.confirmation;
    if (allowTest && c && c.test === true) return;
    const ok = await passkeys.check(me, { action, ref, confirmation: c });
    if (!ok) throw new WalletError("confirm", "Confirm with Face ID or your phone's passcode.", 403);
  };

  /* ---- reading ---- */
  r.get("/api/wallet", run(async (me, req) => ({ ...(await service.state(me)), testConfirm: allowTest, me: { id: me.id, handle: me.handle }, ...(extraState ? await extraState(me, req) : {}) })));
  r.get("/api/wallet/activity", run((me) => service.activity(me)));
  r.get("/api/wallet/activity/:kind/:id", run((me, req) => service.detail(me, req.params.kind, req.params.id)));
  r.get("/api/wallet/room/:room", run(async (me, req) => ({ cards: await service.roomCards(me, req.params.room) })));
  r.get("/api/wallet/people", run(async (me) => ({ people: await identify.people(me) })));

  /* ---- setup ---- */
  r.post("/api/wallet/setup", json, run((me, req) => service.setup(me, { region: req.body?.region, acceptedTerms: req.body?.acceptedTerms })));
  r.post("/api/wallet/verify", json, run((me, req) => service.startVerify(me, back(req.body?.returnUrl))));
  r.post("/api/wallet/sources/connect", json, run((me, req) => service.startConnect(me, req.body?.kind, back(req.body?.returnUrl))));
  r.post("/api/wallet/sources/:id/default", json, run((me, req) => service.setDefaultSource(me, req.params.id)));
  r.post("/api/wallet/sources/:id/remove", json, run((me, req) => service.removeSource(me, req.params.id)));
  r.post("/api/wallet/payout", json, run((me, req) => service.setPayout(me, { mode: req.body?.mode, details: req.body?.details })));

  /* ---- passkeys ---- */
  r.post("/api/wallet/passkey/options", json, run((me, req) => passkeys.registrationOptions(me, rp(req))));
  r.post("/api/wallet/passkey/register", json, run(async (me, req) => {
    const out = await passkeys.register(me, { challengeId: req.body?.challengeId, response: req.body?.response });
    if (!out.ok) throw new WalletError("passkey", "That didn't work. Try again.", 400);
    return out;
  }));
  r.post("/api/wallet/confirm/options", json, run((me, req) => passkeys.confirmOptions(me, { action: String(req.body?.action || ""), ref: String(req.body?.ref || ""), ...rp(req) })));

  /* ---- moving money ---- */
  r.post("/api/wallet/quote", json, run((me, req) => service.quote(me, {
    toMemberId: req.body?.to, amount: req.body?.amount, sourceId: req.body?.source,
  })));
  r.post("/api/wallet/requests/:id/quote", json, run((me, req) => service.quoteRequest(me, req.params.id, req.body?.source)));
  r.post("/api/wallet/send", json, run(async (me, req) => {
    await confirmed(me, req, "send", req.body?.quoteId);
    return service.send(me, { quoteId: req.body?.quoteId, note: req.body?.note, reason: req.body?.reason, room: req.body?.room, returnUrl: back(req.body?.returnUrl) });
  }));
  r.post("/api/wallet/transfers/:id/accept", json, run((me, req) => service.accept(me, req.params.id)));
  r.post("/api/wallet/transfers/:id/decline", json, run((me, req) => service.decline(me, req.params.id)));
  r.post("/api/wallet/transfers/:id/cancel", json, run((me, req) => service.cancel(me, req.params.id)));
  r.post("/api/wallet/requests", json, run((me, req) => service.createRequest(me, { toMemberId: req.body?.to, amount: req.body?.amount, note: req.body?.note, room: req.body?.room })));
  r.post("/api/wallet/requests/:id/decline", json, run((me, req) => service.requestAction(me, req.params.id, "decline")));
  r.post("/api/wallet/requests/:id/cancel", json, run((me, req) => service.requestAction(me, req.params.id, "cancel")));
  r.post("/api/wallet/topup", json, run(async (me, req) => {
    await confirmed(me, req, "topup", `${req.body?.source}:${req.body?.amount}`);
    return service.topup(me, { amount: req.body?.amount, sourceId: req.body?.source, returnUrl: back(req.body?.returnUrl) });
  }));
  r.post("/api/wallet/withdraw", json, run(async (me, req) => {
    await confirmed(me, req, "withdraw", String(req.body?.amount || ""));
    return service.withdraw(me, { amount: req.body?.amount });
  }));
  r.post("/api/wallet/report", json, run((me, req) => service.report(me, { ref: req.body?.ref, reason: req.body?.reason, text: req.body?.text })));
  r.post("/api/wallet/close", json, run(async (me, req) => {
    await confirmed(me, req, "close", "wallet");
    return service.close(me);
  }));

  /* ---- the stand-in provider's own pages ---- */
  if (provider.isTest) {
    r.get("/wallet/test-provider/:ref", async (req, res) => {
      const s = provider.session(req.params.ref);
      res.set("Cache-Control", "no-store");
      if (!s) return res.status(404).send(providerPage(null));
      res.send(providerPage(s));
    });
    r.post("/wallet/test-provider/:ref", express.urlencoded({ extended: false, limit: "2kb" }), async (req, res) => {
      const out = await provider.completeSession(req.params.ref, req.body?.choice === "approve");
      const to = back(out?.returnUrl);
      res.redirect(303, to + (to.includes("#") ? "&" : "#") + "back=" + encodeURIComponent(req.params.ref));
    });
  }

  return r;
}

/** The provider's webhooks, mounted before the board's door because the
 *  provider is not a member. Only real providers have them. */
export function createWebhookRouter({ provider }) {
  const r = express.Router();
  if (typeof provider.handleWebhook !== "function") return r;
  /* A HUMAN, OR A DASHBOARD, LOOKING AT THE ADDRESS.
     Only POST was handled, so anything else fell past this router and into
     the board's invite door, which answered {"error":"invite"} — the right
     answer to a stranger asking for a page, and a frightening one to whoever
     has just pasted this address into Airwallex and opened it to check. A
     provider that pings an endpoint before accepting it would read the same
     thing. So the address says what it is. Nothing about the board, nothing
     about the account: one line, and 405 because POST is the only method
     that does anything here. */
  r.get("/api/wallet/webhooks/provider", (req, res) => {
    res.status(405).json({ ok: true, post: "This address accepts signed POSTs from the payment provider." });
  });

  r.post("/api/wallet/webhooks/provider", express.raw({ type: "*/*", limit: "256kb" }), async (req, res) => {
    try {
      const ok = await provider.handleWebhook({ raw: req.body, headers: req.headers });
      res.status(ok ? 200 : 400).end();
    } catch (err) {
      console.error("wallet webhook", err.message);
      res.status(500).end();
    }
  });
  return r;
}
