/* TAKE AN ACCOUNT BACK, AND LEAVE EVERY COPY OF THE OLD KEY OWNING NOTHING.
 *
 * WHY THIS EXISTS, AND IT IS NOT `make back`. Two people opened a chat link
 * Tom had sent and ended up holding HIS device number — his whole inbox on
 * their phone. Switching off what put it there stops the next one. It does
 * nothing about the number already sitting in two browsers: on this board a
 * device number IS the account, so those phones go on being him for ever.
 *
 * `make back` cannot fix that. It moves a person onto the browser that types
 * the code — and the browser in front of him is already holding the leaked
 * number, so it would move him onto the very number he is trying to get rid
 * of. This makes a NEW one and moves him onto that instead. Every other copy
 * is then a number that belongs to nobody.
 *
 *   make evict WHO="Tom"
 *
 * WHAT TRAVELS IS NOT THE KEY. The link carries a token that is spent by the
 * first tap and dead in fifteen minutes; the key itself is made on the server
 * at the moment of the tap and handed to exactly one browser. A key in a chat
 * log would be the same leak again, with better manners.
 *
 * ONE TAP. He is holding the phone that needs the new key, so what this prints
 * is a link to send himself — not a code to type, and not a screen to find.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: evict.mjs <board url> <admin key> --who NAME");
  process.exit(2);
}
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : "";
};

/* The public address, for the line that gets sent. Handed in by the Makefile
   off .env — the board answers on its own hostname inside the compose network
   and that is not a name anybody can tap. */
const PUBLIC = (process.env.BOARD_PUBLIC_URL || "https://thexchange.app").replace(/\/+$/, "");

const who = arg("who").trim();
if (!who) {
  console.error('make evict WHO="their name"');
  process.exit(2);
}

const r = await fetch(base + "/api/admin/handover", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ who }),
});
const d = await r.json().catch(() => ({}));

if (r.status === 404) {
  console.error(`No member here called "${who}". Names are as they appear on the board.`);
  process.exit(1);
}
if (!r.ok || !d.token) {
  console.error("Refused: " + (d.error || r.status));
  process.exit(1);
}

const line = "─".repeat(60);
const LINK = `${PUBLIC}/k/${d.token}`;
console.log("\n" + line);
console.log(LINK);
console.log(line);
console.log(`\nSend that to yourself and open it on ${d.handle}'s phone. One button.`);
console.log(`Good for ${d.mins} minutes and one tap.`);
console.log("\nOpen it in Safari or Chrome rather than inside WeChat — WeChat keeps");
console.log("its own storage, and the new key would land in the wrong browser.");
console.log("\nThe moment it is tapped, anybody else holding the old key stops being");
console.log(`${d.handle}. Nothing else changes: same page, same people, same messages.\n`);
