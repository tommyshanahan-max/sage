// The first thing to run once QFPay keys exist. Signs a real request and
// draws a real code for one yuan.
//
//   BOARD_WALLET_QFPAY_APP_CODE=… BOARD_WALLET_QFPAY_APP_KEY=… \
//     node lib/wallet/providers/qfpay.check.mjs
//
// IT MAKES A CODE, WHICH IS NOT THE SAME AS SPENDING MONEY. A payment intent
// that nobody scans expires and costs nothing — and it is the only way to
// find out whether the signature is right, because a wrong signature is not a
// wrong number, it is a refusal that arrives in the same shape as every other
// refusal.
//
// The first line it prints is the signature over their own worked example. If
// that does not match, nothing after it can, and the fault is in qfpaySign
// rather than in the account.
import { qfpayBase, qfpaySign, createQfpayProvider } from "./qfpay.js";

/* THEIR EXAMPLE, FROM 0_Request_method.md, kept as the first check because it
   needs no account, no network and no key of ours: the document supplies both
   the input and the answer. Anything that breaks the signing rule breaks this
   line first, on this machine, in a second. */
const EXAMPLE_KEY = "3a7a3bba647fb6fbc28f6687d78212e2";
const example = qfpaySign({ address: "TST", bankaccount: "123456" }, EXAMPLE_KEY);
console.log("sign over the docs' own example:", example.sign);
console.log("  signed string:", example.base + "<key>");

const sandbox = process.env.BOARD_WALLET_QFPAY_SANDBOX !== "0";
const base = qfpayBase({ base: process.env.BOARD_WALLET_QFPAY_BASE, sandbox });
console.log("base:", base, sandbox ? "(sandbox)" : "(LIVE)");

const appCode = process.env.BOARD_WALLET_QFPAY_APP_CODE;
const appKey = process.env.BOARD_WALLET_QFPAY_APP_KEY;
if (!appCode || !appKey) {
  console.error("Set BOARD_WALLET_QFPAY_APP_CODE and BOARD_WALLET_QFPAY_APP_KEY first.");
  console.error("Everything above this line needed neither, and is the half worth reading anyway.");
  process.exit(1);
}

const p = createQfpayProvider({ appCode, appKey, sandbox, base });

try {
  const r = await p.qrPay({ amount: 100, currency: "CNY", reference: "check" + Date.now(), method: "wechat" });
  console.log("wechat code:", { id: r.id, status: r.status, qr: r.qr ? r.qr.slice(0, 60) + "…" : "(none)" });
  if (!r.qr) throw new Error("no qrcode came back — the field is named something else, and r.raw below says what");
  const s = await p.intentStatus(r.id);
  console.log("status:", s);
  console.log("OK: signing, the payment call and the query all work.");
} catch (err) {
  console.error("FAILED:", err.message);
  if (err.body) console.error("their answer:", err.body);
  process.exitCode = 1;
}
