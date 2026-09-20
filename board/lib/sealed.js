/* SOMETHING THE BOARD FILE HOLDS BUT CANNOT READ ON ITS OWN
 * ===========================================================================
 *
 * The rule beside `payout` in store.js is that no account number is ever
 * kept: details go to Airwallex, an id comes back, and a board that does not
 * hold a number cannot lose one.
 *
 * A storefront's representative is in mainland China, and Airwallex will not
 * take a yuan beneficiary yet (note 2 in providers/airwallex.js: local yuan
 * payouts are documented for goods trade with declarant and order data, and
 * a commission is not on that list). So there is nowhere to send the card
 * number to — and without it nobody can be paid at all.
 *
 * So the number stays here, sealed: AES-256-GCM under a key that lives in a
 * file beside the board rather than inside it. What that buys is narrow and
 * worth saying plainly — the board file travels (a backup, a copy pulled
 * down to look at something, a paste into a terminal) and the key does not,
 * so a copy of the board is not a list of bank cards. Against somebody who
 * already has the box it buys nothing.
 *
 * THE KEY MAKES ITSELF. A secret that has to be put in .env by hand, once
 * per machine, with nothing checking it happened, is a secret that will be
 * missing on the day it matters.
 *
 * The moment Airwallex takes a CNY beneficiary, the number is sent once, the
 * id comes back, and the sealed field is dropped — back to the rule.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let KEY = null;

function key(dir) {
  if (KEY) return KEY;
  const f = join(dir, "payout.key");
  try {
    const got = Buffer.from(String(readFileSync(f, "utf8")).trim(), "base64");
    if (got.length === 32) { KEY = got; return KEY; }
  } catch { /* not there yet, or unreadable — make one */ }
  KEY = randomBytes(32);
  /* 0600 and written once. If two processes race here one of them loses its
     key and the rows it sealed stop opening, which is why this is called at
     start-up as well as on the way past. */
  writeFileSync(f, KEY.toString("base64"), { mode: 0o600 });
  return KEY;
}

/** Called at boot so the file exists before two requests can race for it. */
export function ready(dir) { key(dir); }

export function seal(dir, text) {
  const s = String(text ?? "");
  if (!s) return "";
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(dir), iv);
  const out = Buffer.concat([c.update(s, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), out].map((b) => b.toString("base64")).join(".");
}

/** The number back, or "" — a sealed field that will not open is a row to
 *  leave alone, never an exception thrown at whoever happened to ask. */
export function unseal(dir, blob) {
  const parts = String(blob || "").split(".");
  if (parts.length !== 3) return "";
  try {
    const [iv, tag, out] = parts.map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(dir), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(out), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}
