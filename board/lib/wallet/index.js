// The wallet, assembled. server.js calls createWallet once and mounts what it
// returns; everything else about money lives in this directory.
//
// OFF UNLESS ASKED FOR. BOARD_WALLET names the provider: `test` for the
// stand-in (no money moves), `airwallex` for the real one. Unset, the routes
// answer 404 and no screen offers a wallet — the same rule as every other
// optional part of this box.

import { openLedger } from "./ledger.js";
import { createMockProvider } from "./providers/mock.js";
import { createAirwallexProvider } from "./providers/airwallex.js";
import { createWalletService } from "./service.js";
import { createPasskeys } from "./passkeys.js";
import { createWalletRouter, createWebhookRouter } from "./routes.js";
import express from "express";

export function createWallet({ dir, env = process.env, loadPeople, hashOf }) {
  const mode = String(env.BOARD_WALLET || "").toLowerCase();
  const off = express.Router();
  off.use(/^\/(api\/)?wallet(\/|$)/, (req, res) => res.status(404).json({ error: "wallet_off" }));
  if (!["test", "airwallex"].includes(mode)) return { on: false, routes: off, webhooks: express.Router(), mode: "off" };

  const provider = mode === "airwallex"
    ? createAirwallexProvider({
      clientId: env.BOARD_WALLET_AIRWALLEX_CLIENT_ID, apiKey: env.BOARD_WALLET_AIRWALLEX_API_KEY,
      webhookSecret: env.BOARD_WALLET_AIRWALLEX_WEBHOOK_SECRET, sandbox: env.BOARD_WALLET_AIRWALLEX_SANDBOX !== "0",
      publicOrigin: env.BOARD_WALLET_PUBLIC_ORIGIN, base: env.BOARD_WALLET_AIRWALLEX_BASE,
    })
    : createMockProvider({ speed: Number(env.BOARD_WALLET_TEST_SPEED || 1) });

  const ledger = openLedger(dir);

  /* Who is who, refreshed from board.json on every wallet request. The service
     looks people up synchronously, so the lookup it is given reads this. */
  const cache = { byId: new Map(), byHash: new Map(), list: [] };
  async function refresh() {
    const people = await loadPeople();
    cache.byId = new Map(); cache.byHash = new Map(); cache.list = [];
    for (const q of people) {
      if (q.state !== "published" || !q.handle) continue;
      const p = { id: q.id, by: q.by, handle: q.handle, role: ((Array.isArray(q.say) ? q.say : [])[0] || {}).me || "", photo: q.photoState === "published" ? q.photo : "" };
      cache.byId.set(p.id, p); cache.byHash.set(p.by, p); cache.list.push(p);
    }
  }
  const people = { byId: (id) => cache.byId.get(String(id || "")) || null, byHash: (h) => cache.byHash.get(String(h || "")) || null };

  const service = createWalletService({ ledger, provider, people });
  const passkeys = createPasskeys({ ledger });

  async function identify(req) {
    const by = hashOf(req);
    if (!by) return null;
    await refresh();
    return cache.byHash.get(by) || null;
  }
  /** Members you could pay, and whether each can be paid yet. */
  identify.people = async (me) => {
    const wallets = await ledger.read((d) => d.wallets);
    return cache.list
      .filter((p) => p.by !== me.by)
      .map((p) => ({ id: p.id, handle: p.handle, role: p.role, photo: p.photo, hasWallet: Boolean(wallets[p.by] && wallets[p.by].status !== "closed"), region: wallets[p.by]?.region || "" }))
      .sort((a, b) => a.handle.localeCompare(b.handle))
      .slice(0, 300);
  };

  const testConfirm = mode === "test" && env.BOARD_WALLET_TEST_CONFIRM === "1";
  const routes = createWalletRouter({ service, passkeys, provider, identify, testConfirm });
  const webhooks = createWebhookRouter({ provider });

  // Money waiting longer than 24 hours goes back to whoever sent it.
  setInterval(() => { service.expireDue().catch((e) => console.error("wallet expiry", e.message)); }, 60 * 1000).unref();

  console.log(`wallet: on, provider ${provider.name}${testConfirm ? ", test confirm allowed" : ""}`);
  return { on: true, mode, routes, webhooks, service, ledger, provider };
}
