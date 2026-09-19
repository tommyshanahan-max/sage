/* WHAT THE MACHINE MAKES OF WHAT SOMEBODY SAID.
 *
 * The hard half of the voice step, testable from a terminal: no microphone,
 * no phone, no deploy in between. What can be wrong here is the reading, not
 * the recording, and the reading is the part that would quietly write a
 * number nobody said.
 *
 *   node scripts/hear.mjs <base> <admin-key> --said "twelve lessons at 200"
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("hear.mjs <base> <admin-key> --said \"...\""); process.exit(1); }
const i = rest.indexOf("--said");
const said = i >= 0 ? String(rest[i + 1] ?? "") : "";
if (!said) { console.error("hear.mjs ... --said \"what they said\""); process.exit(1); }

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/terms", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-admin-secret": key },
  body: JSON.stringify({ said }),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  console.error("\n  " + (j?.error === "unconfigured"
    ? "ANTHROPIC_API_KEY is not set, or BOARD_TERMS is off"
    : (j?.error || ("the board said " + r.status))) + "\n");
  process.exit(1);
}

const t = j.terms;
const line = (k, v) => console.log("  " + k.padEnd(12) + (v || "—"));
console.log("");
console.log("  THEY SAID   " + j.said);
console.log("");
/* The sentence first, because it is the one the person confirms and the only
   thing on this page that has to be right by itself. */
console.log("  READ BACK   " + t.say);
console.log("");
line("Amount", t.amount);
line("For", t.what);
line("When", t.when);
line("Who", t.to);
if (t.ask) { console.log(""); console.log("  IT WOULD ASK  " + t.ask); }
console.log("");
if (!t.amount) {
  console.log("  No amount — it did not invent one, which is correct.");
  console.log("");
}
