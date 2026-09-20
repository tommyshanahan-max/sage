// A real WeChat Pay code, or the exact reason there isn't one.
//
//   BOARD_WALLET_AIRWALLEX_CLIENT_ID=… BOARD_WALLET_AIRWALLEX_API_KEY=… \
//     node lib/wallet/providers/airwallex.wechat.mjs [amount-in-yuan]
//
// This prints the WHOLE next_action, not the one field the adapter expects.
// The adapter's request shape is a reading of Airwallex's docs and has never
// run; the check that told us the FX margin was 0.88% and not 0.50% only
// found that out by looking at what actually came back. Same discipline here.
import { createAirwallexProvider } from "./airwallex.js";

const clientId = process.env.BOARD_WALLET_AIRWALLEX_CLIENT_ID;
const apiKey = process.env.BOARD_WALLET_AIRWALLEX_API_KEY;
if (!clientId || !apiKey) {
  console.error("Set BOARD_WALLET_AIRWALLEX_CLIENT_ID and BOARD_WALLET_AIRWALLEX_API_KEY (sandbox) first.");
  process.exit(1);
}

const yuan = process.argv[2] || "2400";
const base = process.env.BOARD_WALLET_AIRWALLEX_BASE || "https://api.sandbox.airwallex.com";
const p = createAirwallexProvider({ clientId, apiKey, sandbox: true, base });

console.log("base:", base);
console.log("asking for a WeChat code for ¥" + yuan);

try {
  const r = await p.wechatQr({ amount: String(Number(yuan) * 100), currency: "CNY", reference: "12 lessons" });
  console.log("\nintent:", r.id, "status:", r.status);
  console.log("\nnext_action, whole:");
  console.log(JSON.stringify(r.raw, null, 2));
  console.log("\nwhat the adapter would draw:", r.qr ? r.qr.slice(0, 120) : "(nothing — the field is named something else)");
  if (!r.qr) console.error("\nThe code is in that object somewhere. Say which key and the adapter changes to match.");
} catch (err) {
  console.error("\nFAILED:", err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
}
