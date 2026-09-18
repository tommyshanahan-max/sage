/* THE ONE PLACE THAT KNOWS HOW STRIPE MOUNTS
 * ===========================================================================
 *
 * Two pages draw a payment now — the room (groups.html) and the deal memo
 * (memo.html) — and a third will if the memo ever leaves this board as a
 * widget. What they share is not the chrome, which is different on each, but
 * the two lines that are expensive to get wrong:
 *
 *   1. WHICH BUILD OF STRIPE.JS. The dahlia path, not v3. Same file to look
 *      at, but Stripe.js reads its version from the URL, and under v3
 *      initEmbeddedCheckout refuses any session that is not ui_mode=embedded
 *      — which the server no longer makes. The symptom of getting this wrong
 *      is not an error on the page: it is every payer silently landing on the
 *      "we could not load the payment form" fallback.
 *
 *   2. WHICH MOUNT CALL. createEmbeddedCheckoutPage, because under dahlia the
 *      old initEmbeddedCheckout throws "has been removed" before it draws
 *      anything.
 *
 * Both of those were found once, the hard way, in a build where nothing had
 * changed between working and not. Having them in two files would mean
 * finding them twice.
 */

/* Fetched the first time somebody presses a payment method and never before.
   A page that loads it on sight is a page telling js.stripe.com who is reading
   what, all day, for nothing.
   The promise is dropped on failure so a second press can try again — on a
   phone that changed network between the two presses, it will work. */
let stripeJs = null;

export function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (stripeJs) return stripeJs;
  stripeJs = new Promise((ok, no) => {
    const tag = document.createElement("script");
    tag.src = "https://js.stripe.com/dahlia/stripe.js";
    tag.async = true;
    tag.onload = () => (window.Stripe ? ok(window.Stripe) : no(new Error("no Stripe")));
    tag.onerror = () => no(new Error("blocked"));
    document.head.append(tag);
  });
  stripeJs.catch(() => { stripeJs = null; });
  return stripeJs;
}

/** Draw the checkout into `slot`. Returns the mounted thing, whose destroy()
 *  the caller owns — see the note in payFrame about a listener left on an
 *  iframe that is no longer in the document.
 *  Throws if Stripe cannot be reached or refuses the session. Every caller
 *  treats that as one case: offer the payee's own page instead. */
export async function mountCheckout(slot, { secret, pk }) {
  const Stripe = await loadStripeJs();
  const mounted = await Stripe(pk).createEmbeddedCheckoutPage({ clientSecret: secret });
  mounted.mount(slot);
  return mounted;
}
