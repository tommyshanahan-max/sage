#!/usr/bin/env node
/* Fill in the App Store Connect listing, from Tom's Mac.
 *
 * WHY THIS EXISTS AND NOT A PERSON AT A KEYBOARD. The listing is nine screens
 * of boxes, every one of which already has its answer written down in
 * `listing.json` next door. Typing them by hand is twenty minutes of copying
 * from one file into a browser, and the mistakes it makes are silent: a
 * description pasted with the wrong line breaks reads fine and is wrong.
 *
 * THE KEY NEVER LEAVES THE MAC. This reads `~/.appstoreconnect/private_keys/
 * AuthKey_<KEY_ID>.p8` off the disk it is run on. It is never pasted anywhere,
 * never committed, never sent to anything but Apple. That is also why this
 * script is run by Tom rather than by the machine that wrote it: the board's
 * Claude has no path to the Mac, and a key that had to travel to reach it
 * would be a key in a chat log.
 *
 * NOTHING IS SUBMITTED. This fills boxes. It attaches the build and answers
 * the encryption question, because the submission is refused without them and
 * the refusal is a vague 409 that tells you nothing. Pressing Submit stays a
 * human act.
 *
 * FOUR THINGS THE API CANNOT DO, all of them web form only:
 *   - App Privacy, the nutrition labels
 *   - EU trader status, without which the app is hidden in all 27 EU stores
 *   - Age rating
 *   - Screenshots (the API can, through a three-step upload with checksums;
 *     drag and drop is five seconds and this is not worth owning)
 * They are listed again at the end of a run so they are read rather than
 * remembered.
 *
 *   node app/store/fill-listing.mjs            # says what it would do
 *   node app/store/fill-listing.mjs --write    # does it
 */
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* ── The account. The key id and issuer are not secrets — they name a key,
      they are not the key — so they live here rather than in an environment
      variable nobody will remember to set. ─────────────────────────────── */
const KEY_ID = "NQB9NSL78X";
const ISSUER_ID = "27f759c2-092c-478d-a9ef-038927820519";
const KEY_FILE = join(homedir(), ".appstoreconnect", "private_keys", `AuthKey_${KEY_ID}.p8`);

const API = "https://api.appstoreconnect.apple.com/v1";
const WRITE = process.argv.includes("--write");
const HERE = dirname(fileURLToPath(import.meta.url));

/* ── A JWT that Apple will accept ──────────────────────────────────────────
   ES256 over P-256. Node's default signature encoding is DER and JOSE wants
   the raw r‖s pair, which is what `ieee-p1363` is: signing with the default
   produces a token Apple rejects as malformed, and the error does not say
   which part is malformed. Twenty minutes, not the twenty-four hours Apple
   allows — a short-lived token is one less thing on the disk. */
function token(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid: KEY_ID, typ: "JWT" });
  const body = b64({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" });
  const sig = createSign("SHA256").update(`${head}.${body}`)
    .sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

let JWT = "";
async function call(method, path, body) {
  const url = path.startsWith("http") ? path : API + path;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${JWT}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* Apple sent prose */ }
  if (!res.ok) {
    /* THE WHOLE ERROR, NOT THE STATUS. Apple's detail line is the only part
       that says which attribute it disliked, and a script that prints "422"
       and stops has thrown away the answer. */
    const said = json?.errors?.map((e) => `${e.title}: ${e.detail || ""}`).join("\n    ")
      || text.slice(0, 400);
    throw new Error(`${method} ${path} → ${res.status}\n    ${said}`);
  }
  return json;
}

const get = (p) => call("GET", p);
const patch = (p, type, id, attributes) =>
  WRITE ? call("PATCH", p, { data: { type, id, attributes } }) : null;

/* One line per box, so a dry run reads like a list of what is about to
   change and a real run reads like a receipt. */
const did = [];
const say = (what, value) => {
  const one = String(value).replace(/\n/g, " ").trim();
  did.push(`  ${WRITE ? "set" : "would set"}  ${what.padEnd(18)} ${one.slice(0, 64)}${one.length > 64 ? "…" : ""}`);
};

async function main() {
  const L = JSON.parse(await readFile(join(HERE, "listing.json"), "utf8"));

  if (/PUT YOUR/i.test(L.review.contactPhone)) {
    throw new Error(
      "listing.json still has the placeholder phone number in review.contactPhone.\n"
      + "    App Review rings it if they cannot get in. Put a real number there first.");
  }

  let key;
  try { key = await readFile(KEY_FILE, "utf8"); }
  catch { throw new Error(`No key at ${KEY_FILE}\n    Download the .p8 from App Store Connect → Users and Access → Integrations.`); }
  JWT = token(key);

  /* ── The app ─────────────────────────────────────────────────────────── */
  const apps = await get(`/apps?filter[bundleId]=${encodeURIComponent(L.bundleId)}`);
  const app = apps.data[0];
  if (!app) throw new Error(`No app with bundle id ${L.bundleId} on this account.`);
  console.log(`\n  ${app.attributes.name} · ${L.bundleId}\n`);

  /* ── Name and subtitle live on the appInfo, not the version ───────────
     They are the app's identity rather than this release's copy, which is
     why changing them does not need a new build — and why they are on a
     different object with its own localizations. */
  const infos = await get(`/apps/${app.id}/appInfos`);
  const info = infos.data.find((i) => i.attributes.appStoreState !== "READY_FOR_SALE") || infos.data[0];
  const infoLocs = await get(`/appInfos/${info.id}/appInfoLocalizations`);
  const infoLoc = infoLocs.data.find((l) => l.attributes.locale === L.locale);
  if (!infoLoc) throw new Error(`No ${L.locale} localization on the app info.`);
  await patch(`/appInfoLocalizations/${infoLoc.id}`, "appInfoLocalizations", infoLoc.id,
    { name: L.name, subtitle: L.subtitle });
  say("name", L.name);
  say("subtitle", L.subtitle);

  /* ── The version being prepared ──────────────────────────────────────── */
  const versions = await get(`/apps/${app.id}/appStoreVersions?limit=10`);
  const version = versions.data.find((v) =>
    ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"]
      .includes(v.attributes.appStoreState));
  if (!version) {
    throw new Error("No version open for editing. Every version on this app is submitted or released.");
  }
  const vNumber = version.attributes.versionString;

  const vLocs = await get(`/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
  const vLoc = vLocs.data.find((l) => l.attributes.locale === L.locale);
  if (!vLoc) throw new Error(`No ${L.locale} localization on version ${vNumber}.`);
  await patch(`/appStoreVersionLocalizations/${vLoc.id}`, "appStoreVersionLocalizations", vLoc.id, {
    description: L.description,
    keywords: L.keywords,
    promotionalText: L.promotionalText,
    supportUrl: L.supportUrl,
    marketingUrl: L.marketingUrl,
  });
  say("description", L.description);
  say("keywords", L.keywords);
  say("promotional text", L.promotionalText);
  say("support URL", L.supportUrl);
  say("marketing URL", L.marketingUrl);

  /* ── The build ────────────────────────────────────────────────────────
     Its version string has to match the version it is attached to: a 1.0
     binary under a 1.0.1 version is refused as invalid, and the message says
     "invalid binary" rather than "these two numbers differ". */
  const builds = await get(`/builds?filter[app]=${app.id}&limit=20&sort=-uploadedDate`);
  const build = builds.data.find((b) => b.attributes.version && b.attributes.processingState === "VALID")
    || builds.data[0];
  if (!build) {
    did.push("  no build yet — upload finished processing? Attach it and re-run.");
  } else {
    /* Export compliance, once per build. Without it the submission is
       refused with a 409 that names nothing. */
    await patch(`/builds/${build.id}`, "builds", build.id, { usesNonExemptEncryption: false });
    say("encryption", "usesNonExemptEncryption = false");
    if (WRITE) {
      await call("PATCH", `/appStoreVersions/${version.id}/relationships/build`,
        { data: { type: "builds", id: build.id } });
    }
    say("build", `${vNumber} (${build.attributes.version})`);
  }

  /* ── App Review Information ──────────────────────────────────────────
     POST if this version has never had one, PATCH if it has. The GET
     answers 404 rather than an empty body in the first case. */
  let detail = null;
  try { detail = await get(`/appStoreVersions/${version.id}/appStoreReviewDetail`); }
  catch { /* never set for this version */ }
  const R = L.review;
  const attrs = {
    contactFirstName: R.contactFirstName, contactLastName: R.contactLastName,
    contactPhone: R.contactPhone, contactEmail: R.contactEmail,
    demoAccountName: R.demoAccountName, demoAccountPassword: R.demoAccountPassword,
    demoAccountRequired: R.demoAccountRequired, notes: R.notes,
  };
  if (detail?.data?.id) {
    await patch(`/appStoreReviewDetails/${detail.data.id}`, "appStoreReviewDetails", detail.data.id, attrs);
  } else if (WRITE) {
    await call("POST", "/appStoreReviewDetails", {
      data: {
        type: "appStoreReviewDetails", attributes: attrs,
        relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } },
      },
    });
  }
  say("demo code", `${R.demoAccountName} / ${R.demoAccountPassword}`);
  say("review notes", R.notes);
  say("review contact", `${R.contactFirstName} ${R.contactLastName} · ${R.contactEmail}`);

  console.log(did.join("\n"));
  console.log(`\n  Version ${vNumber}, ${WRITE ? "written" : "not written — add --write"}.\n`);
  console.log("  Still to do by hand, because the API cannot:\n");
  console.log("    App Privacy      the nutrition labels — README.md has all eight rows");
  console.log("    EU trader        Digital Services Act; without it, hidden in 27 EU stores");
  console.log("    Age rating       None / Web access No / User content Yes → expect 17+");
  console.log("    Screenshots      drag app/store/shots/6.7-*.png in, browse first\n");
  console.log("  Then Add for Review → Submit.\n");
}

main().catch((e) => { console.error(`\n  ${e.message}\n`); process.exit(1); });
