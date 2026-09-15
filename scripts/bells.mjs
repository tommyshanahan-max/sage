/* Which phones the board can reach, and how.
 *
 * WRITTEN FOR ONE QUESTION, on the evening the app is first run onto a device:
 * did the token arrive? Everything else about Apple push is visible somewhere —
 * Xcode's console says whether registration failed, apns.js logs a 403 with
 * what to check — but "the phone registered and the board has it written down"
 * is the step in the middle, and there was no way to look at it.
 *
 * A row in `pushes` is one of two things and they are counted apart, because
 * the failure being hunted is always "the web ones are fine and the app's is
 * missing":
 *
 *   sub    a browser subscription — Safari, Chrome, a home-screen install
 *   apns   a device token from the App Store build
 *
 * NOTHING THAT IDENTIFIES ANYBODY. Not the person, not the token, not the
 * endpoint: a device token names a phone and an endpoint is a URL that can be
 * pushed to. Counts and dates and nothing else — this is a diagnostic that
 * gets run over somebody's shoulder.
 *
 * Reads the raw JSON rather than going through the store, the same way
 * data-count.mjs does and for the same reason: it has to work on a file the
 * store might refuse.
 *
 *   make bells
 */
import { readFile } from "node:fs/promises";

const file = process.argv[2] || "/data/board.json";
const day = (s) => String(s || "").slice(0, 10) || "—";

try {
  const b = JSON.parse(await readFile(file, "utf8"));
  const rows = Array.isArray(b.pushes) ? b.pushes : [];
  const apns = rows.filter((r) => r && r.apns);
  const web = rows.filter((r) => r && !r.apns);
  // One person can have several — a laptop, a phone, the app. The number that
  // matters for "can we reach anybody" is people, not rows.
  const people = new Set(rows.map((r) => r && r.by).filter(Boolean));

  console.log("");
  console.log("  " + rows.length + " device" + (rows.length === 1 ? "" : "s")
    + " across " + people.size + " " + (people.size === 1 ? "person" : "people"));
  console.log("");
  console.log("    " + web.length + "  browser  (Safari, Chrome, a home-screen install)");
  console.log("    " + apns.length + "  app      (Apple, from the App Store build)");
  console.log("");

  if (!apns.length) {
    console.log("  No app tokens yet. If a build has been run onto a phone and the");
    console.log("  switch pressed, the token did not reach here — Xcode's console");
    console.log("  has the reason, and it is nearly always the Push Notifications");
    console.log("  capability missing from the target.");
    console.log("");
  } else {
    console.log("  Newest app token: " + day(apns.map((r) => r.at).sort().pop()));
    console.log("");
  }
} catch (e) {
  console.log("  no board file at " + file + " (" + e.code + ")");
}
