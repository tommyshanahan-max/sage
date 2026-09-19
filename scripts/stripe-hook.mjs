/* THE WEBHOOK, MADE RATHER THAN CLICKED, AND ITS SECRET PRINTED.
 *
 * WHY THIS EXISTS. Going live needed three values off Stripe's dashboard, and
 * the third one — the webhook's signing secret — does not exist until you have
 * built the webhook, on a page, by hand, with the right URL typed into it and
 * the right event ticked. Tom is visually impaired; "find the page, press the
 * button, tick the box, copy the string" is four things on a screen and the
 * exact shape of instruction this box is not allowed to hand him.
 *
 * Stripe returns the signing secret in the reply to the create call and never
 * again, so a webhook made here is the only kind whose secret a command can
 * know. One already at this URL is deleted first: its secret is unknowable, so
 * keeping it would mean keeping a thing nothing can verify against.
 *
 * NOTHING IS PRINTED BUT THE SECRET. It goes to stdout for the calling script
 * to catch in a variable; everything a person reads goes to stderr. That
 * split is the whole safety of it — a stray console.log here would put a live
 * signing secret on somebody's screen and in their scrollback.
 *
 * The key arrives in the environment rather than in argv: argv is visible in
 * `ps` to anybody on the box for as long as the call lasts.
 *
 *   BOARD_STRIPE_KEY=sk_live_… node scripts/stripe-hook.mjs <url> [api-version]
 */
const [url, version] = process.argv.slice(2);
const KEY = (process.env.BOARD_STRIPE_KEY || "").trim();
const say = (...a) => console.error(...a);

if (!KEY || !url) {
  say("BOARD_STRIPE_KEY=sk_… node scripts/stripe-hook.mjs <url> [api-version]");
  process.exit(1);
}

const call = async (path, method = "GET", form = null) => {
  const headers = {
    Authorization: "Bearer " + KEY,
    ...(version ? { "Stripe-Version": version } : {}),
    ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
  };
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method, headers, ...(form ? { body: form } : {}),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    /* Stripe's own words. They name the thing it disliked and are the only
       useful sentence available when this goes wrong. */
    throw new Error(j?.error?.message || ("Stripe said " + r.status));
  }
  return j;
};

try {
  const have = await call("/webhook_endpoints?limit=100");
  for (const e of have?.data || []) {
    if (e.url !== url) continue;
    say("  There was already a webhook at this address. Replacing it —");
    say("  Stripe only ever shows a signing secret once, so an old one");
    say("  cannot be checked against anything.");
    await call("/webhook_endpoints/" + e.id, "DELETE");
  }

  const form = new URLSearchParams();
  form.set("url", url);
  form.set("enabled_events[]", "checkout.session.completed");
  form.set("description", "The Exchange — flips a paid row to PAID");
  if (version) form.set("api_version", version);
  const made = await call("/webhook_endpoints", "POST", form);
  const secret = String(made?.secret || "");
  if (!secret.startsWith("whsec_")) {
    say("  Stripe made the webhook but returned no signing secret.");
    process.exit(1);
  }
  say("  Webhook created: " + url);
  say("  Listening for checkout.session.completed.");
  process.stdout.write(secret);
} catch (err) {
  say("  " + err.message);
  process.exit(1);
}
