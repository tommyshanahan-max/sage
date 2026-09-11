/* Keep the token alive.
 *
 *   node scripts/gram/token.mjs            refresh and print
 *   node scripts/gram/token.mjs --write    refresh and put it back in .env
 *
 * A long-lived Instagram token lasts SIXTY DAYS and is refreshable any time
 * after the first day. Nothing warns you: it works, and then one morning the
 * posting stops with a message about the session. So this exists, and
 * gram-next calls it when the token is inside its last fortnight.
 *
 * IT REWRITES ONE LINE OF .env AND NOTHING ELSE. The file holds every secret
 * this box has; a script that regenerates it is a script that can lose them.
 */
import { readFile, writeFile } from "node:fs/promises";

const TOKEN = (process.env.GRAM_TOKEN || "").trim();
const ENV = process.env.GRAM_ENV || ".env";
if (!TOKEN) { console.error("GRAM_TOKEN is not set"); process.exit(1); }

const r = await fetch("https://graph.instagram.com/refresh_access_token"
  + "?grant_type=ig_refresh_token&access_token=" + encodeURIComponent(TOKEN));
const d = await r.json().catch(() => ({}));
if (!r.ok || !d.access_token) {
  console.error("refresh failed: " + (d.error?.message || r.status));
  process.exit(1);
}

const days = Math.round((d.expires_in || 0) / 86400);
console.log("refreshed, good for " + days + " days");

if (!process.argv.includes("--write")) { console.log(d.access_token); process.exit(0); }

const src = await readFile(ENV, "utf8");
const line = "GRAM_TOKEN=" + d.access_token;
const next = /^GRAM_TOKEN=.*$/m.test(src)
  ? src.replace(/^GRAM_TOKEN=.*$/m, line)
  : src.trimEnd() + "\n" + line + "\n";
await writeFile(ENV, next, "utf8");
console.log("written to " + ENV);
