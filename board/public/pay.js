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
  /* WHICH HALF FAILED, MARKED ON THE ERROR.
   *
   * Both halves threw into one catch and the page said "your network may be
   * blocking it" for either — which is true of the first and a lie about the
   * second. A payer on a perfectly good connection was told to blame their
   * network and go and ask the seller, while the actual fault was a session
   * Stripe would not accept. Two faults, two sentences, and only one of them
   * is anything the payer can do something about.
   *
   * `.at` rather than a message string: the sentence is Stripe's and it
   * changes, and matching on it is how the last thing here rotted. */
  let Stripe;
  try {
    Stripe = await loadStripeJs();
  } catch (err) {
    err.at = "load";
    throw err;
  }
  try {
    const mounted = await Stripe(pk).createEmbeddedCheckoutPage({ clientSecret: secret });
    mounted.mount(slot);
    return mounted;
  } catch (err) {
    err.at = "mount";
    throw err;
  }
}

/** WHAT THE PHONE SAW, INTO THE BOX'S LOG.
 *
 *  Nobody can open a console on somebody else's phone, and "the payment form
 *  did not load" is the whole of what comes back from a payer — three
 *  different faults have worn that sentence in one evening and each one was
 *  found by getting the real words out of the thing that failed. This is the
 *  only place the payer's side can say them.
 *
 *  Nothing about the payer goes up: the method, where it failed, and the
 *  error's own message, clamped. keepalive because the page it is sent from
 *  may be closed a second later. Its own failure is ignored — a diagnostic
 *  that can break the screen it is diagnosing is worse than none. */
export function sayWhy({ how, at, err }) {
  /* NOT EVERYTHING THROWN IS AN ERROR WITH A MESSAGE.
   *
   * This took `err.message` and sent it, and Stripe rejects with a plain
   * object — so `why` was undefined, the route's `if (why)` dropped the line,
   * and `make pay-why` said "no payment form has failed" at somebody looking
   * at a failed payment form. The diagnostic built to stop the guessing
   * stayed silent in exactly the case it was built for, which is the same
   * shape of fault as the demo switch: a check that answers "nothing here"
   * for the wrong reason.
   *
   * So: the message where there is one, then Stripe's own nested error, then
   * whatever the thing serialises to, then its type. Something always goes. */
  const words = (e) => {
    if (typeof e === "string") return e;
    if (!e) return "threw " + String(e);
    if (e.message) return String(e.message);
    if (e.error?.message) return String(e.error.message);
    try {
      const j = JSON.stringify(e);
      if (j && j !== "{}") return j;
    } catch { /* circular, or a DOM thing */ }
    return "threw " + Object.prototype.toString.call(e);
  };
  try {
    fetch("/api/pay/why", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ how, at, why: words(err).slice(0, 300) }),
    }).catch(() => {});
  } catch { /* an old browser with no keepalive */ }
}
