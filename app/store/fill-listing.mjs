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
 * TWO THINGS THE API CANNOT DO, both of them web form only:
 *   - App Privacy, the nutrition labels
 *   - EU trader status, without which the app is hidden in all 27 EU stores
 * They are listed again at the end of a run so they are read rather than
 * remembered.
 *
 * It used to be four. The age rating and the screenshots were on that list
 * because dragging five files into a browser is five seconds — which is true
 * for somebody who can see where to drop them, and the wrong measure. Both
 * are in the API and both are done here now.
 *
 *   make listing PHONE="+61 4xx xxx xxx"       from the Mac, and that is all
 *   node app/store/fill-listing.mjs --dry      to see it without doing it
 */
import { createSign, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
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
/* WRITES UNLESS TOLD NOT TO, which is the opposite of the usual and on purpose.
   Every box this fills is overwritable and all of it was reviewed before it
   ever reached listing.json, so a preview run is a step that costs a person
   something and saves them nothing. --dry is still here for the machine that
   wrote this and cannot run it. */
const WRITE = !process.argv.includes("--dry");
const argPhone = (() => {
  const i = process.argv.indexOf("--phone");
  return i > -1 ? String(process.argv[i + 1] || "").trim() : "";
})();
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

/** The localization to write into.
 *
 *  THE LOCALE IS NOT en-US JUST BECAUSE THE COPY IS IN ENGLISH. The primary
 *  language is whatever was chosen when the app record was made, and this one
 *  is English (Australia) — so a script that insists on en-US stops on a
 *  listing that is perfectly fine and says the localization is missing, which
 *  is true and completely misleading. Ask for the named one, take the only
 *  one if it is not there, and say out loud which was used: with a single
 *  English localization there is no wrong answer, and with several there
 *  would be, so it refuses rather than guessing.
 */
function pick(rows, want, where) {
  const named = rows.find((l) => l.attributes.locale === want);
  if (named) return named;
  if (rows.length === 1) {
    console.log(`  (no ${want} on the ${where} — writing ${rows[0].attributes.locale} instead)`);
    return rows[0];
  }
  throw new Error(`No ${want} localization on the ${where}, and ${rows.length} others to choose from:\n    `
    + rows.map((l) => l.attributes.locale).join(", ")
    + `\n    Put the right one in listing.json as "locale".`);
}

/* One line per box, so a dry run reads like a list of what is about to
   change and a real run reads like a receipt. */
const did = [];
const say = (what, value) => {
  const one = String(value).replace(/\n/g, " ").trim();
  did.push(`  ${WRITE ? "set" : "would set"}  ${what.padEnd(18)} ${one.slice(0, 64)}${one.length > 64 ? "…" : ""}`);
};


/** The age rating questionnaire, without the questionnaire.
 *
 *  ANSWERS DISCOVERED, NOT LISTED. Apple has renamed and re-shaped these
 *  fields more than once — `seventeenPlus` went away, new ones arrived — and a
 *  hard-coded list of thirteen attribute names is a list that breaks silently
 *  on the day one of them is retired. So the current declaration is read
 *  first, and only the keys Apple itself just returned are written back.
 *
 *  Everything that takes a level gets NONE, because the app has none of it.
 *  The two that are not levels are the two that matter and both are argued in
 *  README.md: web access is restricted (the webview is held to this board's
 *  own hostnames), and there is user-generated content, which is what makes
 *  this 17+ and is not worth arguing down — the app carries other people's
 *  words and photographs, and a rating that pretends otherwise is the thing
 *  that gets found later.
 */
async function ageRating(versionId, infoId) {
  /* HUNG OFF TWO DIFFERENT THINGS, DEPENDING ON THE AGE OF THE ACCOUNT. The
     declaration used to belong to the version, and asking the version for it
     is what every older example does — but on this app it 404s there and sits
     on the appInfo instead, which is where it belongs: a rating is the app's,
     not this release's. Ask both rather than pick, because the wrong guess
     looks exactly like "you have no age rating" and the fix is silent. */
  let decl = null;
  for (const where of [`/appStoreVersions/${versionId}/ageRatingDeclaration`,
                       `/appInfos/${infoId}/ageRatingDeclaration`]) {
    try { const r = await get(where); if (r?.data?.id) { decl = r; break; } }
    catch { /* not on this one */ }
  }
  const now = decl?.data?.attributes || {};
  const id = decl?.data?.id;
  if (!id) { did.push("  skipped    age rating          not on the version or the app info — web form"); return; }

  /* THE 2025 QUESTIONNAIRE, WHICH IS TWENTY-SEVEN FIELDS AND THREE SHAPES.
     Most take a level. Some are yes or no. One is a URL, and that one is why
     the first attempt set nothing at all: every write is validated against the
     whole object, so an empty developerAgeRatingInfoUrl fails the URI check no
     matter which field is being written. It goes in on every call.

     THE ANSWERS ARE THE APP'S, NOT CONVENIENT ONES. It carries other people's
     words and photographs, it is a messenger, and people find each other on
     it: user content yes, messaging yes, social yes. That is what makes it 17+
     and it is not worth arguing down — a rating that pretends otherwise is the
     thing that gets found later. Web access is restricted, which is true:
     allowNavigation in capacitor.config.json holds the webview to this board's
     own hostnames.

     THE JUDGEMENT ONES ARE LEFT ALONE. ageAssurance, parentalControls,
     socialMediaAgeRestricted, koreaAgeRating and the override are claims about
     how the app polices who is on it, and this board has no age gate. Setting
     any of them from here would be answering for Tom about something he has
     not decided. They stay untouched and are named at the end.

     TYPE PROBED, NOT ASSUMED. Apple has three shapes here and no public list
     saying which field is which, so each one is tried as a level and then as
     no — one extra call for the handful that are boolean, and no guessing. */
  const INFO_URL = "https://thexchange.app/rules";
  const YES = ["userGeneratedContent", "messagingAndChat", "socialMedia"];
  /* THESE WERE HELD BACK ON A SCRUPLE THAT DID NOT SURVIVE CONTACT.
     ageAssurance, parentalControls and socialMediaAgeRestricted were left
     unset because they read like claims about how the board polices who is on
     it, and that is Tom's to answer rather than a script's. Apple refuses the
     declaration without them — and the scruple was the wrong way round
     anyway. The board has no age assurance, no parental controls and no age
     gate on the social side, so the answer to all three is no, and no is a
     statement of what is not there. Yes would have been the claim. */
  const LEAVE = ["kidsAgeBand", "ageRatingOverride", "developerAgeRatingInfoUrl"];

  /* ALL OF IT AT ONCE, AND APPLE SAYS WHERE IT IS WRONG.
     The whole declaration is validated on every write, so one field of the
     wrong type fails all twenty-two and the error names that one field —
     which is why answering them one at a time set nothing at all, twice.
     Send the lot, read the attribute out of the refusal, correct that one,
     send again. It converges in as many rounds as there are wrong guesses
     and every round is a machine talking to a machine. Nothing here is
     guessed at: the types come from Apple. */
  const body = {};
  for (const k of Object.keys(now)) {
    if (!LEAVE.includes(k)) body[k] = YES.includes(k) ? true : "NONE";
  }
  body.developerAgeRatingInfoUrl = INFO_URL;
  body.unrestrictedWebAccess = false;

  let why = "";
  let landed = false;
  const dropped = [];
  for (let round = 0; round < 40; round++) {
    try {
      await patch(`/ageRatingDeclarations/${id}`, "ageRatingDeclarations", id, body);
      landed = true;
      break;
    } catch (e) {
      why = e.message.split("\n").pop().trim();
      /* MISSING, NOT WRONG. Apple will not take a partial declaration: leave a
         field out and it asks for that one by name. Same loop, same principle
         — it says what it wants, so put it in and go again. */
      const need = /missing a required attribute:.*?'([^']+)'/i.exec(why)
        || /must provide a value for the attribute '([^']+)'/i.exec(why);
      if (need) {
        const k = need[1];
        if (k in body) break;
        body[k] = YES.includes(k) ? true : "NONE";
        continue;
      }
      const m = /attribute '([^']+)'\.?\s*Expected a (\w+)/i.exec(why);
      if (!m) break;
      const [, field, wants] = m;
      const was = body[field];
      if (wants.toUpperCase() === "BOOLEAN") body[field] = YES.includes(field);
      else if (wants.toUpperCase() === "STRING") body[field] = "NONE";
      else { delete body[field]; dropped.push(field); continue; }
      /* The correction has to actually change something, or this is a loop
         that talks to Apple forty times and learns nothing. */
      if (body[field] === was) { delete body[field]; dropped.push(field); }
    }
  }

  if (!WRITE) { say("age rating", `${Object.keys(body).length} answers`); return; }
  if (landed) {
    say("age rating", `${Object.keys(body).length} answers · info URL ${INFO_URL}`);
    if (dropped.length) did.push(`             ${dropped.length} Apple would not take: ${dropped.join(", ")}`);
  } else {
    did.push("  failed     age rating          do this one in the web form");
    did.push(`             Apple said: ${why}`);
  }
  did.push("             no age assurance, no parental controls, no age gate — all true");
}


/** The App Privacy nutrition labels.
 *
 *  THIS WAS ON THE BY-HAND LIST FOR A BAD REASON: that the API has no way to
 *  set it. It has. `appDataUsages` is a row per (category, purpose) and per
 *  (category, protection), hung off the app, and `appDataUsagesPublishState`
 *  is the switch that makes the labels live. Nobody uses it — fastlane does
 *  not — so it is easy to believe it is not there, and I said so twice before
 *  going and looking.
 *
 *  THE VOCABULARY IS FETCHED, NOT TYPED OUT. Apple owns the list of category
 *  ids and adds to it; a hard-coded "PHOTOS_OR_VIDEOS" that Apple renames is a
 *  row that silently stops being declared. So the real list comes down first
 *  and every row in listing.json is matched against it — and anything that
 *  does not match is named, with the ids that do exist printed beside it,
 *  rather than dropped.
 *
 *  EVERY ROW IS LINKED AND NONE IS TRACKING. Both of those are read off the
 *  store in README.md rather than assumed, and both are load-bearing: this
 *  board has no advertising identifier and no third-party analytics, and the
 *  handles and the age on a profile are exactly the sort of thing a label
 *  saying "name and photo" leaves out.
 *
 *  IT DOES NOT PUBLISH. The switch at the end is left alone: these labels are
 *  a legal statement about what is kept about people, and the last word on it
 *  is Tom's, not a script's at half past midnight.
 */
async function privacy(appId, L) {
  const P = L.privacy;
  if (!P?.rows?.length) return;

  let cats, purposes, protections;
  try {
    [cats, purposes, protections] = await Promise.all([
      get("/appDataUsageCategories?limit=200"),
      get("/appDataUsagePurposes?limit=200"),
      get("/appDataUsageDataProtections?limit=200"),
    ]);
  } catch (e) {
    did.push("  skipped    app privacy         no appDataUsages on this account — web form");
    did.push(`             Apple said: ${e.message.split("\n").pop().trim()}`);
    return;
  }

  const have = new Set(cats.data.map((c) => c.id));
  const missing = P.rows.map((r) => r.category).filter((c) => !have.has(c));
  if (missing.length) {
    did.push(`  failed     app privacy         Apple does not know: ${missing.join(", ")}`);
    did.push(`             it does know: ${[...have].join(", ").slice(0, 300)}`);
    return;
  }
  if (!purposes.data.some((x) => x.id === P.purpose)) {
    did.push(`  failed     app privacy         no purpose ${P.purpose}; it has: ${purposes.data.map((x) => x.id).join(", ")}`);
    return;
  }
  for (const pr of P.protections) {
    if (!protections.data.some((x) => x.id === pr)) {
      did.push(`  failed     app privacy         no protection ${pr}; it has: ${protections.data.map((x) => x.id).join(", ")}`);
      return;
    }
  }

  const already = await get(`/apps/${appId}/appDataUsages?limit=200`);
  if (already.data.length) {
    did.push(`  already    app privacy         ${already.data.length} rows declared — left alone`);
    return;
  }
  if (!WRITE) { say("app privacy", `${P.rows.length} rows`); return; }

  /* One row per (category, purpose) and one per (category, protection): the
     resource carries a category and exactly one of the other two, which is
     why eight data types are sixteen calls. */
  let made = 0;
  for (const row of P.rows) {
    const links = [
      { appDataUsagePurpose: P.purpose },
      ...P.protections.map((pr) => ({ appDataUsageDataProtection: pr })),
    ];
    for (const link of links) {
      const [kind, id] = Object.entries(link)[0];
      const type = kind === "appDataUsagePurpose" ? "appDataUsagePurposes" : "appDataUsageDataProtections";
      try {
        await call("POST", "/appDataUsages", {
          data: {
            type: "appDataUsages",
            relationships: {
              app: { data: { type: "apps", id: appId } },
              appDataUsageCategory: { data: { type: "appDataUsageCategories", id: row.category } },
              [kind]: { data: { type, id } },
            },
          },
        });
        made++;
      } catch (e) {
        did.push(`             ${row.category} · ${id}: ${e.message.split("\n").pop().trim().slice(0, 90)}`);
      }
    }
  }
  say("app privacy", `${made} rows · linked, not tracking, app functionality`);
  did.push("             NOT published — the labels are a legal statement, so you");
  did.push("             press Publish in App Store Connect after reading them");
}

/** The screenshots, uploaded rather than dragged.
 *
 *  THREE STEPS PER FILE and none of them optional: reserve a slot and Apple
 *  answers with the URLs to PUT the bytes at, the bytes go up, and then the
 *  reservation is closed with an MD5 of what was sent. Miss the last one and
 *  the screenshot exists, is empty, and blocks the submission with a message
 *  about a missing asset.
 *
 *  6.7" ONLY. Apple scales that set down for every smaller phone, and the 6.5"
 *  copies in shots/ are there for a form that wanted both.
 *
 *  ORDER IS THE ARGUMENT. `browse` first because it is the product in one
 *  frame — the card and the sentence — and the first screenshot is the one
 *  that appears in search results beside the name.
 *
 *  Nothing is uploaded twice: a set that already holds screenshots is left
 *  exactly as it is, because re-running this to fix a phone number should not
 *  quietly reorder the pictures.
 */
const SHOTS = ["browse", "notes", "cards", "room", "thread"];

async function screenshots(localizationId) {
  const dir = join(HERE, "shots");
  let have;
  try { have = await readdir(dir); }
  catch { did.push("  skipped    screenshots        no shots/ folder"); return; }

  const files = SHOTS.map((n) => `6.7-${n}.png`).filter((f) => have.includes(f));
  if (!files.length) { did.push("  skipped    screenshots        no 6.7-*.png in shots/"); return; }

  const sets = await get(`/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`);
  let set = sets.data.find((x) => x.attributes.screenshotDisplayType === "APP_IPHONE_67");

  const already = set
    ? (await get(`/appScreenshotSets/${set.id}/appScreenshots`)).data.length
    : 0;
  if (already) {
    did.push(`  already    screenshots        ${already} up there — left alone`);
    return;
  }
  if (!WRITE) { say("screenshots", `${files.length} · ${files.join(", ")}`); return; }

  if (!set) {
    const made = await call("POST", "/appScreenshotSets", {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: "APP_IPHONE_67" },
        relationships: {
          appStoreVersionLocalization: {
            data: { type: "appStoreVersionLocalizations", id: localizationId },
          },
        },
      },
    });
    set = made.data;
  }

  for (const name of files) {
    const bytes = await readFile(join(dir, name));
    const made = await call("POST", "/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileSize: bytes.length, fileName: name },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
      },
    });
    const shot = made.data;
    for (const op of shot.attributes.uploadOperations || []) {
      const headers = {};
      for (const h of op.requestHeaders || []) headers[h.name] = h.value;
      /* The bytes go straight to Apple's storage, not to the API, so this one
         carries no Authorization header — the URL is the credential and it is
         good for minutes. */
      const res = await fetch(op.url, {
        method: op.method,
        headers,
        body: bytes.subarray(op.offset, op.offset + op.length),
      });
      if (!res.ok) throw new Error(`uploading ${name} → ${res.status} ${await res.text()}`);
    }
    await call("PATCH", `/appScreenshots/${shot.id}`, {
      data: {
        type: "appScreenshots", id: shot.id,
        attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") },
      },
    });
  }
  say("screenshots", `${files.length} uploaded · ${files.join(", ")}`);
}

async function main() {
  const L = JSON.parse(await readFile(join(HERE, "listing.json"), "utf8"));

  /* THE ONE THING THIS FILE CANNOT KNOW. Everything else was decided weeks
     ago; a phone number is Tom's and is not going in a repository. It comes in
     on the command line rather than by editing JSON, because opening a JSON
     file to change one string is a text editor, a syntax to not break, and a
     save — three chances to be stopped, for one number. */
  if (argPhone) L.review.contactPhone = argPhone;
  /* AND IT HAS TO BE A REAL ONE. The example in the help is "+61 4xx xxx xxx"
     and it went in verbatim, which is exactly what an example is for and
     exactly what nobody notices: Apple accepts any string, so the failure
     would have been a reviewer ringing a number that does not exist, days
     later, with the app rejected and no reason given that points here. */
  const phone = String(L.review.contactPhone || "");
  /* EVERY EXAMPLE EVER PRINTED, BY NAME. The first example was "+61 4xx xxx
     xxx" and it went in verbatim; the guard learned to refuse x's, a number
     shaped like a number was offered instead, and that went in verbatim too.
     An example is a thing to paste — that is what makes it a good example and
     what makes it dangerous here. So the examples themselves are the
     blocklist, and any new one printed anywhere goes on this list. */
  const EXAMPLES = ["+61 4xx xxx xxx", "+61 412 345 678"];
  const bare = (t) => String(t).replace(/[^0-9a-z]/gi, "");
  if (EXAMPLES.some((e) => bare(e) === bare(phone))) {
    throw new Error(
      "That is the example number, not yours — it has been pasted in twice now.\n"
      + "    App Review rings it when they cannot get in, and a number that\n"
      + "    rings nowhere is a rejection with no reason attached.\n"
      + "    make listing PHONE=\"<your number>\"");
  }
  if (!phone || /PUT YOUR/i.test(phone) || /x{2,}/i.test(phone)) {
    throw new Error(
      'No real phone number for App Review — they ring it if they cannot get in.\n'
      + '    make listing PHONE="<the number you answer>"');
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
  const infoLoc = pick(infoLocs.data, L.locale, "app info");
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
  const vLoc = pick(vLocs.data, L.locale, `version ${vNumber}`);
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
    /* Export compliance, once per build and ONLY once. Apple refuses a second
       answer with "You cannot update when the value is already set" — and it
       is usually already set, because ITSAppUsesNonExemptEncryption in the
       Info.plist answers it at upload time. That is the good case, so it reads
       as a line saying so rather than an error stopping the run before the
       review notes are written. */
    const enc = build.attributes.usesNonExemptEncryption;
    if (enc === null || enc === undefined) {
      await patch(`/builds/${build.id}`, "builds", build.id, { usesNonExemptEncryption: false });
      say("encryption", "usesNonExemptEncryption = false");
    } else {
      did.push(`  already    encryption         answered in the build's Info.plist (${enc})`);
    }
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

  await ageRating(version.id, info.id);
  await privacy(app.id, L);
  await screenshots(vLoc.id);

  console.log(did.join("\n"));
  console.log(`\n  Version ${vNumber}, ${WRITE ? "written" : "not written — this was --dry"}.\n`);
  console.log("  Still to do by hand, because the API cannot:\n");
  console.log("    EU trader        Digital Services Act; without it, hidden in 27 EU stores\n");
  console.log("  Then Add for Review → Submit.\n");
}

main().catch((e) => { console.error(`\n  ${e.message}\n`); process.exit(1); });
