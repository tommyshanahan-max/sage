/* The other language of every line on every card, rendered once.
 *
 * WHY. The language button switches every string on the board except the one
 * on the card, because that one is the person's own words — so a reader who
 * put the whole screen into Chinese got a Chinese screen with an English
 * paragraph in the middle of it, on the card that is the whole product.
 *
 * Each line is now rendered into the other language when it is written and
 * stored beside it, so the toggle swaps text with no call and no wait. This
 * command is for the cards that were already up when that started: one pass,
 * one call each, skipping anything already done.
 *
 * Safe to run twice. Safe to run after adding one card — it renders one card.
 *
 *   make bios
 */

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error("usage: bios.mjs <board url> <admin key>");
  process.exit(2);
}

const r = await fetch(base + "/api/bios", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
});
const d = await r.json().catch(() => ({}));

console.log("");
if (!r.ok) {
  console.log(d.error === "unconfigured"
    /* The one failure worth naming precisely: it is not broken, it is off, and
       the fix is one line in .env rather than anything in here. */
    ? "  No translation key on this board, so there is nothing to render.\n"
      + "  ANTHROPIC_API_KEY in .env is what switches it on."
    : "  That did not go through.");
  console.log("");
  process.exit(1);
}

if (!d.done.length && !d.failed.length) {
  console.log("  Nothing to do — every card with a line already has both.");
} else {
  if (d.done.length) {
    console.log("  Rendered " + d.done.length + ":");
    console.log("    " + d.done.join("  "));
  }
  if (d.failed.length) {
    console.log("");
    /* Named rather than counted. A failure here is one card reading in one
       language, which is the state it was in before — worth another run, not
       worth alarm. */
    console.log("  Did not come back (run it again):");
    console.log("    " + d.failed.join("  "));
  }
}
console.log("");
console.log("  " + d.already + " card" + (d.already === 1 ? "" : "s")
  + " had one already.");
console.log("");
