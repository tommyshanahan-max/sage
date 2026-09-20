// CAN THIS ACCOUNT PAY ANYBODY? The one question the whole subcontractor
// build rests on, asked before a day is spent on it.
//
//   BOARD_WALLET_AIRWALLEX_CLIENT_ID=… BOARD_WALLET_AIRWALLEX_API_KEY=… \
//     node lib/wallet/providers/airwallex.payout.mjs
//
// It makes a beneficiary out of test bank details and attempts a one-dollar
// local transfer to it. Sandbox money, so nothing real moves — but the
// refusal, if there is one, is the real one: transfers and beneficiaries are
// separately activated on an Airwallex account, and a sole trader whose
// application is still in review may have neither.
//
// It prints whatever comes back rather than the field the adapter expects.
// That is how "webqr" was found to be "qrcode", and it is the only way to
// learn anything from a call nobody has made before.
import { airwallexBase, createAirwallexProvider } from "./airwallex.js";

const base = airwallexBase({ base: process.env.BOARD_WALLET_AIRWALLEX_BASE, sandbox: true });
const clientId = process.env.BOARD_WALLET_AIRWALLEX_CLIENT_ID;
const apiKey = process.env.BOARD_WALLET_AIRWALLEX_API_KEY;
if (!clientId || !apiKey) {
  console.error("\n  Set the sandbox keys first.\n");
  process.exit(1);
}
console.log("base:", base);
const p = createAirwallexProvider({ clientId, apiKey, sandbox: true, base });

/* A REAL-SHAPED AUSTRALIAN ACCOUNT, and an obviously fake one. 083-004 is a
   valid NAB BSB and the number is nine threes: enough for the schema to
   accept, impossible to mistake for somebody's. */
const details = {
  accountName: "Ray Chen",
  accountNumber: "333333333",
  bsb: "083004",
};

let ben = null;
try {
  ben = await p.createBeneficiary({ currency: "AUD", country: "AU", details });
  console.log("\n  beneficiary:", JSON.stringify(ben));
} catch (err) {
  console.error("\n  BENEFICIARY REFUSED");
  console.error("  " + err.message);
  if (err.body) console.error("  " + JSON.stringify(err.body));
  console.error("\n  Nothing can be paid out until this call works.\n");
  process.exit(1);
}

try {
  const out = await p.payout({
    amount: 100, currency: "AUD",
    beneficiaryId: ben.beneficiaryId,
    reference: "Dealio test payout",
  });
  console.log("  transfer:", JSON.stringify(out));
  console.log("\n  OK: this account can create a beneficiary and send it money.\n");
} catch (err) {
  console.error("\n  TRANSFER REFUSED");
  console.error("  " + err.message);
  if (err.body) console.error("  " + JSON.stringify(err.body));
  console.error("\n  The beneficiary was made, so it is the transfer capability that is off.\n");
  process.exit(1);
}
