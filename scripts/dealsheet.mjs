/* A deal sheet in a real room, so it can be read on a phone.
 *
 * Every screen here can be stood up locally with `make try`, except what a
 * deal feels like arriving on your own phone, in a room with somebody you
 * know, with a number on it. That is the one thing a screenshot cannot show.
 *
 *   make dealsheet WHO="Tom" WITH="Christopher"      put one in
 *   make dealsheet WHO="Tom" WITH="Christopher" OFF=1   take it away
 *
 * BOTH NAMES ARE HANDLES, which on this board is whatever the person typed
 * when they arrived — usually a first name, not always. `make who` is the
 * only place that knows; a wrong one comes back "not on this board" and looks
 * like the person is missing when they are not.
 *
 * The memo says "(example)" in its own title and the numbers are invented. A
 * sheet that reads like one somebody agreed to is a thing to be acted on a
 * week later by whoever forgot.
 */
const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error('usage: dealsheet.mjs <board url> <admin key> --who WHO --with WITH [--off]');
  process.exit(2);
}
const arg = (n, d = "") => { const i = rest.indexOf("--" + n); return i < 0 ? d : (rest[i + 1] || d); };
const who = arg("who").trim();
const With = arg("with").trim();
const off = rest.includes("--off");

const say = (...l) => { console.log(""); for (const x of l) console.log("  " + x); console.log(""); };

if (!who || !With) {
  say('Two names, both of them handles on this board:',
      '',
      '  make dealsheet WHO="Tom" WITH="Christopher"',
      '',
      '`make who` lists them. WHO is the one paying.');
  process.exit(2);
}

const r = await fetch(base + "/api/room/deal", {
  method: "POST",
  headers: { "x-admin-secret": key, "Content-Type": "application/json" },
  body: JSON.stringify({ who, with: With, off }),
});
const d = await r.json().catch(() => ({}));

if (!r.ok) {
  if (d.error === "who") {
    say("Not on this board: " + (d.miss || []).join(", "),
        "",
        "Handles are whatever the person typed when they arrived.",
        "`make who` lists them.");
  } else if (d.error === "none") {
    say("They have no room together, so there is nothing to take away.");
  } else if (d.error === "same") {
    say("Those are the same person. WHO pays, WITH does the work.");
  } else {
    say("That did not go through.");
  }
  process.exit(1);
}

if (d.off) {
  say("Taken away. The room is still there.");
  process.exit(0);
}

say("Done — " + (d.who || []).join(" and ") + " have it.",
    "",
    "Open the app and the room is in Messages. The sheet is at the top;",
    "Mo's line is in the conversation under it. The numbers are made up.",
    "",
    'Take it away again:  make dealsheet WHO="' + who + '" WITH="' + With + '" OFF=1');
