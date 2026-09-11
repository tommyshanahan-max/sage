/* Put somebody's email on their row, from the box.
 *
 * WHY THIS EXISTS. Signing in by email matches an address on a person's row,
 * and until now the only way to get one there was to be signed in already.
 * That is fine for everybody except the person who is locked out, who is the
 * only person who needs it. The way back code gets them in, and then leaves a
 * second errand behind it — find the settings, type the address, save — before
 * next time is easy. Somebody who has just been locked out twice in one night
 * should not be given homework.
 *
 * So the operator writes it, and the person types their address at the door
 * and asks for six digits. No key ever changes hands.
 *
 * WHAT IT IS NOT. It is not a way in. An address on a row opens nothing on its
 * own: it is the thing a code gets sent to, and the code still has to be typed
 * on the browser that wants to be them.
 *
 *   make mail WHO="Tom" ADDR="tom@example.com"
 *   make mail WHO="Tom" ADDR=""                 take it off again
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: mail.mjs <board url> <admin key> --who NAME [--mail ADDR]");
  process.exit(2);
}
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : "";
};

const who = arg("who").trim();
const mail = arg("mail").trim();
if (!who) {
  console.error('make mail WHO="their name" ADDR="them@example.com"');
  process.exit(2);
}

const r = await fetch(base + "/api/admin/mail", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ who, mail }),
});
const d = await r.json().catch(() => ({}));

if (r.status === 404) {
  console.error(`No member here called "${who}". Names are as they appear on the board.`);
  process.exit(1);
}
if (d.error === "taken") {
  console.error("Somebody else on this board already uses that address.");
  process.exit(1);
}
if (d.error === "bad") {
  console.error("That does not look like an email address.");
  process.exit(1);
}
if (!r.ok) {
  console.error("Refused: " + (d.error || r.status));
  process.exit(1);
}

if (!d.mail) {
  console.log(`\n${d.handle} has no address on their row now. They are back to`);
  console.log("their key, or a code you mint with:  make back WHO=\"" + d.handle + "\"\n");
} else {
  console.log(`\n${d.handle} → ${d.mail}\n`);
  console.log("They can now get in on any phone, any browser, at any time:");
  console.log("");
  console.log("  the door  →  that address  →  Send me a code  →  six digits");
  console.log("");
  console.log("It moves their existing page onto whatever they are holding.");
  console.log("Nothing to save, nothing to lose.");
  console.log("");
  console.log("This needs mail to be switched on — TOMSCODING_BOARD_MAIL_KEY and");
  console.log("TOMSCODING_BOARD_MAIL_FROM in .env. Without them the door says so");
  console.log("rather than swallowing the address and sending nothing.\n");
}
