// The first thing to run once Airwallex sandbox keys exist: log in, read a
// rate, and lock a quote. Read-only — it creates nothing that moves money.
//
//   BOARD_WALLET_AIRWALLEX_CLIENT_ID=… BOARD_WALLET_AIRWALLEX_API_KEY=… \
//     node lib/wallet/providers/airwallex.check.mjs
//
// Every call the adapter makes was written from the docs and never run. This
// is where that stops being true, one call at a time.

import { airwallexBase, createAirwallexProvider } from "./airwallex.js";

/* WHERE IT IS POINTED, FIRST. A failure that does not say which host it went
   to cannot be read — and the sandbox host is the thing most likely wrong.

   IT ASKS THE BOX WHICH ONE, rather than assuming the sandbox. It did assume,
   and once live keys existed that made this the one command that could say
   the keys were fine while testing them against a host they do not belong
   to. Same rule as everywhere else here: 0 is production, anything else is
   the sandbox. */
const sandbox = process.env.BOARD_WALLET_AIRWALLEX_SANDBOX !== "0";
const base = airwallexBase({ base: process.env.BOARD_WALLET_AIRWALLEX_BASE, sandbox });
console.log("base:", base, sandbox ? "(sandbox)" : "(LIVE)");

const clientId = process.env.BOARD_WALLET_AIRWALLEX_CLIENT_ID;
const apiKey = process.env.BOARD_WALLET_AIRWALLEX_API_KEY;
if (!clientId || !apiKey) {
  console.error("Set BOARD_WALLET_AIRWALLEX_CLIENT_ID and BOARD_WALLET_AIRWALLEX_API_KEY (sandbox keys) first.");
  process.exit(1);
}
const p = createAirwallexProvider({ clientId, apiKey, sandbox, base });

try {
  const q = await p.quote({ sell: "EUR", buy: "AUD", sellAmount: 12000 });
  console.log("quote EUR→AUD:", q);
  const q2 = await p.quote({ sell: "EUR", buy: "CNY", sellAmount: 30000 });
  console.log("quote EUR→CNY:", q2);
  /* THE PAIR THIS PRODUCT ACTUALLY RUNS ON. The two above were written to
     prove a login; this is the one whose margin decides whether being here
     beats Stripe — a yuan payment settled into a CNY account and converted
     separately. Asked last, so a refusal on it alone still leaves the two
     above as proof that the keys themselves are good. */
  const q3 = await p.quote({ sell: "CNY", buy: "AUD", sellAmount: 100000 });
  console.log("quote CNY→AUD:", q3);
  console.log("OK: login and FX quotes work against the sandbox.");
} catch (err) {
  console.error("FAILED:", err.message, err.body || "");
  process.exitCode = 1;
}
