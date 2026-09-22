/* Does Weidian answer, and what does it actually say?
 *
 * One command, run once, with real keys. It exists because the field names
 * in every response are in a wiki this box cannot open, so the honest way to
 * learn them is to ask the real shop and print what comes back rather than
 * write a mapping from memory and watch it render an empty shelf.
 *
 *   make weidian-check
 *
 * Reads BOARD_WEIDIAN_KEY and BOARD_WEIDIAN_SECRET from the environment.
 * Touches nothing, writes nothing, and asks only for things that have
 * already happened.
 */
import { configured, raw, items, orders } from "../board/lib/weidian.js";

const show = (label, v) => {
  console.log("\n=== " + label + " ===");
  console.log(JSON.stringify(v, null, 2).slice(0, 2400));
};

if (!configured()) {
  console.log("\n  Not configured. Both of these have to be in .env:\n");
  console.log("    BOARD_WEIDIAN_KEY=…");
  console.log("    BOARD_WEIDIAN_SECRET=…\n");
  console.log("  They are on open.weidian.com under 管理 for the app.\n");
  process.exit(1);
}

let bad = 0;
const step = async (label, fn) => {
  try { show(label, await fn()); }
  catch (e) { bad++; console.log("\n=== " + label + " ===\nFAILED: " + e.message); }
};

/* The token first and on its own, because everything below is the same
   failure when it is wrong and a shop that says nothing is not a diagnosis. */
await step("token + one item page", () => items(1, 5));
await step("orders, most recent page", () => orders({ page: 1 }));
/* Whatever else is worth seeing goes here as a one-liner. */
await step("shop", () => raw("vdian.shop.get", {}));

console.log(bad
  ? "\n" + bad + " of 3 failed — the message above says which and why.\n"
  : "\nAll three answered. Paste this output back and the mapping gets written from it.\n");
