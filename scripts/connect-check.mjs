// CAN SOMEBODY ELSE PLUG THEIR OWN STRIPE ACCOUNT INTO THIS BOARD, asked of
// Stripe rather than reasoned about.
//
//   make whitelabel     (which runs it)
//
// THE QUESTION THIS EXISTS FOR. A partner — Daniel in Luxembourg is the first
// — wants the money to land in the Stripe account he already has, on a
// hostname of his own, running this code on this box. lib/stripe.js has had
// the OAuth half since /china/connect was built (linkUrl, linkFinish), so
// nothing needs writing. What nobody had established is whether the PLATFORM
// end is switched on: Connect is a thing an account opts into in the
// dashboard, and an account without it answers the link the same way an
// account with a wrong key does.
//
// So this asks three things that can actually be asked, and says which of
// them is in the way:
//
//   1. Is there a key here at all, and is it live money or test money.
//   2. Is Connect enabled on this platform — GET /v1/accounts is refused
//      outright for an account that is not a Connect platform, which makes
//      it the cheapest true answer available. It lists nothing and changes
//      nothing.
//   3. Is BOARD_STRIPE_CLIENT_ID set. Without it canLink() is false, the
//      first button on /china/connect is greyed, and a partner sent there
//      is sent to a dead end.
//
// IN scripts/ RATHER THAN IN board/lib, AND THAT IS THE WHOLE POINT. Only
// scripts/ is bind-mounted on the box; everything under board/ is COPYed into
// the image at build time, so a check that lives there cannot be run until
// somebody has rebuilt — which is the one moment you most want to ask whether
// the thing is configured. Mounted at /seed, the same arrangement pay-check
// already uses, it answers immediately after a git pull.
//
// It imports nothing, for the same reason.
//
// READ-ONLY, DELIBERATELY. Two GETs. It creates no account, mints no link and
// moves no money, so it is safe to run against the live key — which is the
// only configuration whose health is worth knowing.
//
// NOT ASKED HERE: whether an Australian platform may link a Luxembourg
// account. Stripe has no endpoint that answers it, and guessing at it in
// code would be a made-up answer wearing a checkmark. It is also the weaker
// half of the worry: this is OAuth over an account the partner ALREADY has
// and already runs in his own country, not Express onboarding where the
// platform opens the account. The authorise screen is what settles it, and
// it costs one click to find out.
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
const CLIENT_ID = (process.env.BOARD_STRIPE_CLIENT_ID || "").trim();
const DIRECT = (process.env.BOARD_STRIPE_DIRECT || "").trim();
const VERSION = (process.env.BOARD_STRIPE_VERSION || "").trim();

const pad = (s) => (s + " ".repeat(20)).slice(0, 20);
const line = (label, value) => console.log("  " + pad(label) + value);

async function get(path) {
  const res = await fetch("https://api.stripe.com/v1" + path, {
    headers: {
      Authorization: "Bearer " + KEY,
      ...(VERSION ? { "Stripe-Version": VERSION } : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* Stripe sent prose */ }
  return { ok: res.ok, status: res.status, json, text };
}

console.log("");

if (!KEY) {
  line("key", "none — BOARD_STRIPE_KEY is not set");
  console.log("");
  console.log("  This box cannot take a card payment at all, so there is");
  console.log("  nothing for a partner to connect to yet.");
  console.log("");
  process.exit(1);
}

line("key", /^sk_live_/.test(KEY) ? "LIVE — real money" : "test");

const me = await get("/account");
if (!me.ok) {
  line("account", `refused — ${me.json?.error?.message || me.status}`);
  console.log("");
  process.exit(1);
}
line("account", `${me.json.id}  ${me.json.country || "?"}`);
line("charges", me.json.charges_enabled ? "on" : "OFF — this account cannot take a payment");

/* THE ONE THAT ANSWERS THE PARTNER QUESTION. An account that is not a Connect
   platform is refused here, and the refusal names itself. Nothing is listed
   for a platform with no connected accounts either, which is the expected
   answer today and reads as success, not emptiness. */
/* TEN, AND THEIR IDS. It asked for one and printed "accounts already
   linked", which is the fact and not the thing anybody came for: the next
   step after somebody authorises is writing their acct_ into
   BOARD_STRIPE_DIRECT, and that id was only readable off a dashboard page —
   a place on a screen, at the end of a flow that is otherwise commands. */
const conn = await get("/accounts?limit=10");
if (conn.ok) {
  const rows = conn.json.data || [];
  line("connect", `on — ${rows.length ? rows.length + " linked" : "no accounts linked yet"}`);
  for (const a of rows) {
    /* Whose it is, in whatever the account chose to be called. An account
       mid-onboarding has none of these and is still the row somebody is
       waiting on, so it says so rather than printing an empty column. */
    const who = a.business_profile?.name || a.settings?.dashboard?.display_name
      || a.email || "(not named yet)";
    line("", `${a.id}  ${a.country || "?"}  ${who}`
      + (a.charges_enabled ? "" : "  — cannot charge yet"));
  }
} else {
  line("connect", `OFF — ${conn.json?.error?.message || conn.status}`);
}

/* The OAuth half. Its own line because a platform CAN have Connect on and
   still have no client id in .env, and that combination is the one that
   looks like everything is fine until a partner presses the button. */
if (!CLIENT_ID) {
  line("connect a partner", "no — BOARD_STRIPE_CLIENT_ID is not set");
} else if (!/^ca_/.test(CLIENT_ID)) {
  line("connect a partner", `no — "${CLIENT_ID.slice(0, 12)}…" is not a ca_ client id`);
} else {
  line("connect a partner", "yes");
}

console.log("");

/* AND THE COMMAND, WITH THE ID ALREADY IN IT. One linked account and nothing
   in BOARD_STRIPE_DIRECT is the exact state between "he authorised" and "the
   charge is his", and it is the state that looks finished and is not: the
   report still reads OUR name on the statement, OUR chargebacks, truthfully.
   So this prints the line that ends it rather than describing it. */
if (conn.ok && (conn.json.data || []).length && !DIRECT) {
  const first = conn.json.data[0];
  console.log("  Linked, but his charges are still OURS — our name on the");
  console.log("  statement, our chargebacks. This makes them his:");
  console.log("");
  console.log(`      make whitelabel ACCT="${first.id}"`);
  console.log("");
}

if (!conn.ok) {
  console.log("  Switch Connect on first:");
  console.log("    https://dashboard.stripe.com/connect/accounts/overview");
  console.log("");
} else if (!CLIENT_ID || !/^ca_/.test(CLIENT_ID)) {
  console.log("  The client id is on this page, as \"ca_…\":");
  console.log("    https://dashboard.stripe.com/settings/connect/onboarding-options/oauth");
  console.log("");
  console.log("  Then, in one line:");
  console.log("    make whitelabel ID=\"ca_…\"");
  console.log("");
} else {
  console.log("  A partner can connect the Stripe account they already have.");
  console.log("  The link to send them:  make whitelabel");
  console.log("");
}
