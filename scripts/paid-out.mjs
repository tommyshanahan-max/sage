/* THAT TRANSFER IS SENT — cross it off.
 *
 *   node scripts/paid-out.mjs <base> <admin-key> --who Mei
 *
 * A list that cannot be crossed off prints the same payment next week, and
 * the week after somebody sends it twice.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("paid-out.mjs <base> <admin-key> --who Mei"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const who = arg("who");

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/paid-out", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({ who }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + (String(j?.error || "").startsWith("not on this board")
    ? "Not on this board: " + who + ". `make who` has the handles."
    : "the board said " + r.status) + "\n");
  process.exit(1);
}
console.log("");
console.log(j.n
  ? "  " + who + " — " + j.amount + " marked sent, across " + j.n + (j.n === 1 ? " order." : " orders.")
  : "  " + who + " was not owed anything.");
console.log("");
