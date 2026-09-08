/* Take somebody out of the room, or put them back.
 *
 *   make hide WHO="Peter"     out of Browse, out of their public page
 *   make show WHO="Peter"     back
 *
 * NOTHING IS DELETED and nothing is announced. Their state goes back to held,
 * which is where every profile starts: they disappear from Browse and from
 * /p/their-name, their posts stay exactly where they are, and their own
 * profile looks the same to them as it did yesterday.
 *
 * They are not told. There is nothing in this board that tells anybody
 * anything, and "you have been hidden" is a conversation to have in a chat, in
 * your own words, or not at all.
 *
 * It goes both ways with the same command, which matters more than it sounds:
 * a control that only goes one direction gets saved for a last resort, and the
 * point of this one is that it can be used on a hunch and undone in the
 * morning.
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error('usage: person-out.mjs <board url> <admin key> --who NAME [--back]');
  process.exit(2);
}
const arg = (n) => {
  const i = rest.indexOf("--" + n);
  return i >= 0 ? rest[i + 1] : "";
};
const who = arg("who");
const back = rest.includes("--back");
if (!who) {
  console.error('Which one? make hide WHO="their name"');
  process.exit(2);
}

const r = await fetch(base + "/api/person/out", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ handle: who, back }),
});
const d = await r.json().catch(() => ({}));

if (r.status === 404) {
  console.error('Nobody here is called "' + who + '". Check with:  make who');
  process.exit(1);
}
if (!r.ok) {
  console.error("It did not go through:", r.status, d.error || "");
  process.exit(1);
}

if (back) {
  console.log(d.handle + " is back in Browse.");
  console.log("");
  console.log("Their page answers again and they appear in the deck for");
  console.log("anybody they match. Nothing about them changed while they were");
  console.log("out — the same posts, the same matches, the same profile.");
} else {
  console.log(d.handle + " is out of Browse.");
  console.log("");
  console.log("Their public page is gone too. Their posts are still on the");
  console.log("feed — take those down separately if that is what you meant:");
  console.log('  make feed-quiet WHO="' + d.handle + '"');
  console.log("");
  console.log("They have not been told, and their own profile looks the same");
  console.log("to them. Put them back with:  make show WHO=\"" + d.handle + '"');
}
