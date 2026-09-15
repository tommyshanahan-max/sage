// The first thing to run once Airwallex sandbox keys exist: log in, read a
// rate, and lock a quote. Read-only — it creates nothing that moves money.
//
//   BOARD_WALLET_AIRWALLEX_CLIENT_ID=… BOARD_WALLET_AIRWALLEX_API_KEY=… \
//     node lib/wallet/providers/airwallex.check.mjs
//
// Every call the adapter makes was written from the docs and never run. This
// is where that stops being true, one call at a time.

import { createAirwallexProvider } from "./airwallex.js";

const clientId = process.env.BOARD_WALLET_AIRWALLEX_CLIENT_ID;
const apiKey = process.env.BOARD_WALLET_AIRWALLEX_API_KEY;
if (!clientId || !apiKey) {
  console.error("Set BOARD_WALLET_AIRWALLEX_CLIENT_ID and BOARD_WALLET_AIRWALLEX_API_KEY (sandbox keys) first.");
  process.exit(1);
}
const p = createAirwallexProvider({ clientId, apiKey, sandbox: true });

try {
  const q = await p.quote({ sell: "EUR", buy: "AUD", sellAmount: 12000 });
  console.log("quote EUR→AUD:", q);
  const q2 = await p.quote({ sell: "EUR", buy: "CNY", sellAmount: 30000 });
  console.log("quote EUR→CNY:", q2);
  console.log("OK: login and FX quotes work against the sandbox.");
} catch (err) {
  console.error("FAILED:", err.message, err.body || "");
  process.exitCode = 1;
}
