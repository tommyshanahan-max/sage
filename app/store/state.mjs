#!/usr/bin/env node
/* Where the app actually is with Apple, printed. From Tom's Mac.
 *
 * ---------------------------------------------------------------------------
 * WHY IT EXISTS. "Is it submitted?" is a question about a screen in App Store
 * Connect, and a screen is the one place an answer is no use here — it cannot
 * be read out, cannot be pasted back, and cannot be checked by the machine
 * that did the work. This asks Apple and prints four lines.
 *
 * IT WRITES NOTHING. Only GETs. Run it as often as you like, at any point in
 * a review, including while a submission is in flight.
 *
 * THE KEY NEVER LEAVES THE MAC, for the reason fill-listing.mjs gives at
 * length: the same .p8, read off the same disk, never travelling.
 *
 * WHAT THE STATES MEAN, because Apple's names are not the words a person
 * would use and the difference between two of them is the whole question:
 *   PREPARE_FOR_SUBMISSION   not submitted. Still yours to edit.
 *   WAITING_FOR_REVIEW       submitted, in the queue, nobody has looked yet.
 *   IN_REVIEW                somebody is looking now.
 *   PENDING_DEVELOPER_RELEASE  approved, waiting for you to press release.
 *   READY_FOR_SALE           live.
 *   REJECTED / METADATA_REJECTED  Apple sent it back; read the Resolution
 *                            Center. DEVELOPER_REJECTED means you pulled it.
 *
 *   make app-state
 */
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* The same key and issuer fill-listing.mjs uses — they name a key, they are
   not the key, which is why they sit in the file rather than in an
   environment variable nobody will remember to set. */
const KEY_ID = "NQB9NSL78X";
const ISSUER_ID = "27f759c2-092c-478d-a9ef-038927820519";
const KEY_FILE = join(homedir(), ".appstoreconnect", "private_keys", `AuthKey_${KEY_ID}.p8`);
const API = "https://api.appstoreconnect.apple.com/v1";
const HERE = dirname(fileURLToPath(import.meta.url));

/* ES256 with `ieee-p1363`, not Node's default DER — signing the other way
   produces a token Apple rejects as malformed without saying which part. */
function token(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" });
  const sig = createSign("SHA256").update(`${head}.${body}`)
    .sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

let JWT = "";
async function get(path) {
  const res = await fetch(path.startsWith("http") ? path : API + path,
    { headers: { Authorization: `Bearer ${JWT}` } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* Apple sent prose */ }
  if (!res.ok) {
    const said = json?.errors?.map((e) => `${e.title}: ${e.detail || ""}`).join("\n    ")
      || text.slice(0, 300);
    throw new Error(`GET ${path} → ${res.status}\n    ${said}`);
  }
  return json;
}

/* Apple's state names, in the words somebody would use to answer the question
   that made them run this. */
const PLAIN = {
  PREPARE_FOR_SUBMISSION: "not submitted — still yours to edit",
  READY_FOR_REVIEW: "not submitted — ready, waiting for you to press Submit",
  WAITING_FOR_REVIEW: "SUBMITTED — in the queue, nobody has looked yet",
  IN_REVIEW: "SUBMITTED — somebody at Apple is looking now",
  PENDING_DEVELOPER_RELEASE: "APPROVED — waiting for you to release it",
  PENDING_APPLE_RELEASE: "APPROVED — Apple is releasing it",
  PROCESSING_FOR_APP_STORE: "APPROVED — going out now",
  READY_FOR_SALE: "LIVE on the App Store",
  REJECTED: "SENT BACK by Apple — read the Resolution Center",
  METADATA_REJECTED: "SENT BACK over the listing text, not the build",
  DEVELOPER_REJECTED: "pulled by you, not by Apple",
  DEVELOPER_REMOVED_FROM_SALE: "taken off sale by you",
  INVALID_BINARY: "the build was rejected as invalid",
};

const L = JSON.parse(await readFile(join(HERE, "listing.json"), "utf8"));

let key = "";
try { key = await readFile(KEY_FILE, "utf8"); }
catch {
  console.log("");
  console.log("  No App Store Connect key on this machine, so this is not the Mac.");
  console.log("  Run it where Xcode is.");
  console.log("");
  process.exit(1);
}
JWT = token(key);

const apps = await get(`/apps?filter[bundleId]=${encodeURIComponent(L.bundleId)}`);
const app = apps.data[0];
if (!app) {
  console.log(`\n  No app with bundle id ${L.bundleId} on this account.\n`);
  process.exit(1);
}

const versions = await get(`/apps/${app.id}/appStoreVersions?limit=5`);
console.log("");
console.log("  " + app.attributes.name + " · " + L.bundleId);
console.log("");

if (!versions.data.length) {
  console.log("  No versions at all. Nothing has ever been prepared.");
  console.log("");
  process.exit(0);
}

for (const v of versions.data) {
  const st = v.attributes.appStoreState;
  console.log("  " + v.attributes.versionString + "   " + (PLAIN[st] || st));
  console.log("              (" + st + ")");

  /* THE BUILD, because "submitted" with no build attached is the failure this
     had once already: the version looks ready and the submission is refused
     with a 409 that names nothing. */
  try {
    const build = await get(`/appStoreVersions/${v.id}/build`);
    console.log("              build " + (build?.data?.attributes?.version || "—")
      + " · " + (build?.data?.attributes?.processingState || "?"));
  } catch { console.log("              no build attached"); }
  console.log("");
}

/* The two things the API cannot answer and Apple will not take a submission
   without. Printed every time rather than remembered — see the note at the
   top of fill-listing.mjs. */
console.log("  Still web-form only, and not visible from here:");
console.log("    App Privacy (the nutrition labels)");
console.log("    EU trader status");
console.log("");
