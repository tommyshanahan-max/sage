/* WHICH PAYMENT METHODS THIS PLATFORM CAN ACTUALLY OFFER — ASKED OF STRIPE.
 *
 * WHY THIS EXISTS. The whole product is two wallets, and whether they are on
 * was a question answered by clicking around a dashboard: an Active list on
 * one page, truncated behind "View more", with WeChat Pay and Alipay not in
 * the visible half. That is exactly the shape of thing this box is not
 * allowed to hand anybody — and it is a screen, so it cannot be read back,
 * pasted, or checked by anything.
 *
 * IT ASKS THE PLATFORM AND NOT A MERCHANT, and that is the point. The charge
 * lib/stripe.js builds is a DESTINATION charge — created on this platform
 * with transfer_data.destination — and Stripe's rule for those is that the
 * platform's payment method configuration decides what can be offered. The
 * merchant's own settings do not come into it, which is why a screen telling
 * them to go and switch WeChat Pay on was removed. So this one account's
 * answer is the answer for every payment the product will ever take.
 *
 * TWO DIFFERENT NOS, AND THE FIRST ONE IS NOT A REFUSAL. `available: false`
 * means the method is not available to this account YET. `value: "off"` is a
 * switch that is simply not flipped. They read alike and mean entirely
 * different days' work, so they are printed as different words.
 *
 * THE FIRST VERSION OF THIS PRINTED "Stripe will not give this account the
 * method", and that was a sentence this script cannot say. The dashboard for
 * the same account, the same minute, showed WeChat Pay and Alipay as
 * **Pending approval** — applied for, waiting on Stripe, which is the
 * opposite conclusion. The API field does not carry the difference between
 * pending and refused; only Settings → Payment methods does. So this says
 * what it knows and names the page that knows the rest.
 *
 * NOTHING SECRET COMES BACK and nothing is written: one GET, and the key
 * comes through the environment rather than argv, which is visible in `ps`.
 *
 *   BOARD_STRIPE_KEY=… node scripts/stripe-methods.mjs
 */
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
if (!KEY) {
  console.error("\n  BOARD_STRIPE_KEY is not set, so there is nobody to ask.\n");
  process.exit(1);
}
const VERSION = (process.env.BOARD_STRIPE_VERSION || "").trim();

/* The three the product offers, in the order the payer meets them. Card is
   here because it is the fallback the payer page draws beside the two
   wallets, and a platform with only card is a different product. */
const WANT = [
  ["wechat_pay", "WeChat Pay"],
  ["alipay", "Alipay"],
  ["card", "Card"],
];

const get = async (path) => {
  const res = await fetch("https://api.stripe.com/v1" + path, {
    headers: {
      Authorization: "Bearer " + KEY,
      ...(VERSION ? { "Stripe-Version": VERSION } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* Stripe sent prose */ }
  return { res, body, text };
};

/* WHOSE ACCOUNT THIS ANSWER IS ABOUT, SAID ON THE SCREEN.
 *
 * It printed "Default (the default) · test" and nothing more, which is one
 * account's answer wearing no name. On 23 Sep the dashboard showed WeChat Pay
 * and Alipay Pending approval on one page and Enabled on another — a live
 * account and its own sandbox, two acct_ ids, both called Aozhou Baba — and
 * nothing in this command's output could have told you which of them it had
 * just asked. An answer about money that does not name the account is the
 * same failure as go-live writing the wrong variable name: every screen
 * truthful, none of them about the same thing.
 *
 * A failure here is not fatal. The methods are the answer; the name is what
 * makes it readable, and a command that refuses to answer because it could
 * not fetch a label is worse than one that says "this account". */
const who = (await get("/account")).body;

const { res, body: j, text } = await get("/payment_method_configurations");
if (!res.ok) {
  /* Stripe's own sentence, which names the thing it disliked. A status code
     on its own is the answer thrown away. */
  console.error("\n  Stripe said " + res.status + ":");
  console.error("  " + (j?.error?.message || text.slice(0, 300)) + "\n");
  process.exit(1);
}

const configs = Array.isArray(j?.data) ? j.data : [];
const mode = /^[sr]k_live/.test(KEY) ? "live" : /^[sr]k_test/.test(KEY) ? "test" : "unknown";

console.log("");
/* THE NAME AND THE ID, because a name alone does not separate an account from
   its own sandbox: both of these answer to "Aozhou Baba". */
console.log("  "
  + (who?.settings?.dashboard?.display_name || who?.business_profile?.name || "this account")
  + "   " + (who?.id || "account unknown") + "   " + mode);
console.log("");
if (!configs.length) {
  console.log("  This account has no payment method configurations at all.");
  console.log("  Nothing can be offered to a payer until it has one.");
  console.log("");
  process.exit(0);
}

for (const c of configs) {
  const name = c.name || c.id;
  /* The configuration id as well: an account and its sandbox each have a
     Default, and only the pmc_ tells the two apart on a screen. */
  console.log("  " + name + (c.is_default ? "  (the default)" : "") + "   " + c.id);
  for (const [key, label] of WANT) {
    const m = c[key];
    /* A method Stripe does not mention at all is not the same as one it
       mentions and refuses, and saying "off" for both would hide the
       difference that matters. */
    const say = !m ? "not offered on this account"
      : m.available === false ? "NOT YET — Stripe has not made it available to this account"
      : m.display_preference?.value === "on" ? "on"
      : "off — available, not switched on";
    console.log("    " + label.padEnd(12) + " " + say);
  }
  console.log("");
}

/* THE CAPABILITY, WHICH IS A DIFFERENT QUESTION FROM THE TOGGLE, AND THE ONE
 * THAT DECIDES.
 *
 * WHAT THIS MISSED. Everything above reads payment_method_configurations —
 * the display preference, which is what Settings → Payment methods shows and
 * what a person means when they say a method is "on". An account can have
 * that toggle on and not hold the capability at all, and the two are checked
 * at different moments: Checkout creates the session without looking, and
 * Stripe only asks whether the account can really process the method when the
 * payer confirms. So the failure lands on the payer's screen, as
 * `payment_intent_payment_attempt_failed · invalid_request_error`, with
 * nothing anywhere saying "this account has no Alipay".
 *
 * That is exactly what happened on 24 Sep. This command printed "BOTH WALLETS
 * ARE ON" about an account whose capabilities list had no `alipay_payments`
 * in it at all, an evening went on the four faults in front of it — a dead
 * Airwallex rail, a Connect destination, a test key, a currency — and the
 * real answer was one field this file was not reading. Stripe support found
 * it in a minute.
 *
 * The same shape as reading external_accounts off an account object that does
 * not carry it: a confident answer from the wrong field. So both are printed
 * and the disagreement is called out, because the disagreement is the bug.
 */
const caps = who?.capabilities || {};
const CAPOF = { wechat_pay: "wechat_pay_payments", alipay: "alipay_payments", card: "card_payments" };
console.log("  CAN THIS ACCOUNT ACTUALLY PROCESS THEM \u2014 the capability, not the switch:");
for (const [key, label] of WANT) {
  const st = caps[CAPOF[key]];
  console.log("    " + label.padEnd(12) + " "
    + (st === "active" ? "active"
      : st === "pending" ? "PENDING \u2014 requested, Stripe is still checking"
      : st === "inactive" ? "INACTIVE \u2014 the account holds it and cannot use it"
      : "NOT ON THIS ACCOUNT \u2014 never requested, or not granted"));
}
console.log("");

/* AND WHERE THE TWO ANSWERS DISAGREE, SAID AS THE FAULT IT IS. A method
   switched on with no capability behind it is the worst state to be in: the
   dashboard says yes, this command used to say yes, the session is created,
   and the payer is the first thing in the chain to find out. */
{
  const def0 = configs.find((c) => c.is_default) || configs[0];
  const liar = WANT.filter(([k]) => {
    const on = def0?.[k]?.display_preference?.value === "on";
    return on && caps[CAPOF[k]] !== "active";
  });
  if (liar.length) {
    console.log("  \u26a0  " + liar.map(([, l]) => l).join(" and ")
      + (liar.length > 1 ? " are" : " is") + " switched ON with no live capability behind"
      + (liar.length > 1 ? " them." : " it."));
    console.log("     The payment sheet will offer " + (liar.length > 1 ? "them" : "it")
      + " and the payment will fail when somebody");
    console.log("     presses it: payment_intent_payment_attempt_failed \u00b7 invalid_request_error.");
    console.log("     Settings \u2192 Payment methods, find it, and run the activation flow.");
    console.log("");
  }
}

/* THE SENTENCE THAT MATTERS, SAID ONCE, ABOUT THE DEFAULT CONFIGURATION —
   because that is the one a charge uses when nothing names another. */
const def = configs.find((c) => c.is_default) || configs[0];
/* A WALLET IS "ON" ONLY IF A PAYER CAN ACTUALLY PAY WITH IT. This asked the
   switch alone and answered "BOTH WALLETS ARE ON" about an account with no
   alipay_payments capability — true of the setting, false of the product, and
   the whole point of this command is the second one. */
const live = (key) => {
  const m = def?.[key];
  return Boolean(m && m.available !== false && m.display_preference?.value === "on"
    && caps[CAPOF[key]] === "active");
};
const wallets = ["wechat_pay", "alipay"].filter(live);
console.log(wallets.length === 2
  ? "  BOTH WALLETS ARE ON. A payer in WeChat can pay."
  : wallets.length === 1
  ? "  ONLY ONE WALLET IS ON (" + wallets[0].replace("_", " ") + "). Half the payers cannot pay."
  : "  NEITHER WALLET IS ON. Nobody in China can pay through this platform.");
/* AND WHETHER THAT IS TEMPORARY IS NOT IN THIS ANSWER. "Not yet" covers an
   application Stripe is still reading and one it has turned down, and those
   are a week apart in what they mean. Naming the page rather than guessing. */
if (["wechat_pay", "alipay"].some((k) => def?.[k]?.available === false)) {
  console.log("");
  console.log("  NOT YET is either pending approval or refused, and this cannot");
  console.log("  tell them apart. Settings \u2192 Payment methods says which.");
}

/* AND THE OTHER HALF: WHERE THE MONEY GOES AFTERWARDS.
 *
 * This command answered "can a payer in WeChat pay" and stopped there, which
 * is half a question. Money arriving is not money received: an account can
 * take a payment and still be unable to pay it out, and the two are set
 * separately and refused separately. Asked on the same screen because they
 * are one question to whoever is waiting to be paid — and because the answer
 * was otherwise a dashboard page, which is the thing this command exists to
 * replace.
 *
 * `who` is already fetched above; nothing extra is asked of Stripe. */
console.log("");
console.log("  PAYOUTS");
console.log("    taking money   " + (who?.charges_enabled ? "yes" : "NO"));
console.log("    paying out     " + (who?.payouts_enabled ? "yes" : "NO"));

/* WHICH BANK, in the only terms anybody can check against a statement: the
   bank's own name, the last four digits and the currency it pays in. Never
   the full number — it is on a screen somebody may be sharing. */
/* ASKED FOR SEPARATELY, BECAUSE /account DOES NOT VOLUNTEER IT.
 *
 * external_accounts is not on the account object unless it is expanded, so
 * reading who.external_accounts.data got undefined and this printed
 * "NOWHERE — no bank account on this account yet" at somebody who had one.
 * A missing field read as an empty list is the worst shape of wrong: it does
 * not look like a failure, it looks like an answer.
 *
 * A failure here says so rather than inventing an empty list. */
let banks = who?.external_accounts?.data;
let banksAsked = Array.isArray(banks);
if (!banksAsked && who?.id) {
  const got = await get("/accounts/" + who.id + "/external_accounts?object=bank_account&limit=10");
  if (got.res.ok && Array.isArray(got.body?.data)) { banks = got.body.data; banksAsked = true; }
}
banks = (banks || []).filter((a) => a.object === "bank_account");
if (!banksAsked) {
  console.log("    lands in       could not be read \u2014 Stripe would not list the bank");
} else if (!banks.length) {
  console.log("    lands in       NOWHERE \u2014 no bank account on this account yet");
} else {
  for (const a of banks) {
    console.log("    lands in       "
      + [a.bank_name || a.country, a.last4 ? "\u2022\u2022\u2022\u2022 " + a.last4 : "",
         String(a.currency || "").toUpperCase(), a.default_for_currency ? "(the default)" : ""]
        .filter(Boolean).join("  "));
  }
}

/* WHEN. A daily schedule and a manual one are a week apart for somebody
   deciding whether they can pay a supplier on Friday. */
const sch = who?.settings?.payouts?.schedule;
if (sch) {
  console.log("    when           " + (sch.interval === "manual"
    ? "only when you press Pay out funds"
    : sch.interval + (sch.delay_days != null ? ", " + sch.delay_days + " days after a payment" : "")));
}

/* WHAT STRIPE IS STILL WAITING FOR, in Stripe's own words. The dashboard puts
   this behind a banner that says "provide more information" without saying
   which; the requirement ids are the list that banner is made from. */
const need = [...new Set([...(who?.requirements?.currently_due || []),
                          ...(who?.requirements?.past_due || [])])];
if (need.length) {
  console.log("");
  console.log("    STILL WANTED BY STRIPE, and until these are in nothing moves:");
  for (const r of need.slice(0, 12)) console.log("      " + r);
  if (need.length > 12) console.log("      \u2026 and " + (need.length - 12) + " more");
} else if (who?.payouts_enabled) {
  console.log("");
  console.log("    Stripe is waiting for nothing. This account can be paid out.");
}
console.log("");
