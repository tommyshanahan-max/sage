/* CHINA BUSINESS SOLUTIONS — the merchant's Stripe account, and nothing else.
 *
 * The six screens under /china are a widget: static files, relative links, no
 * knowledge of this board. This file is the only server-side thing they need,
 * and it exists because a "Connect Stripe" button that goes nowhere is a
 * drawing of a product.
 *
 * ITS OWN FILE, beside board.json rather than in it. Whoever fills in these
 * screens is not a member of the board and may never be: they arrived at a
 * page about taking payment from China. Putting them in b.people would make
 * every reader of a person row handle a kind of row that has no handle, no
 * sentence and no face — see the note over the ledger file for the same
 * argument made about a different prototype. One file, one purpose, deletable.
 *
 * WHAT IS STORED. A random token that lives in a cookie, the Stripe account
 * id it stands for, and the e-mail the merchant typed. No key, no bank, no
 * document: Stripe collects all of that on its own pages and hands back an id.
 *
 * THE TOKEN IS NOT THE ACCOUNT ID. It would have been simpler to put acct_…
 * straight in the cookie, and then anybody who guessed or saw another
 * merchant's id could read whether that merchant had finished setting up.
 * That is somebody else's business, so the cookie carries a value that means
 * nothing anywhere else.
 */
import { randomBytes } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";

export function openChina(dir) {
  const FILE = path.join(dir, "china.json");

  async function read() {
    try {
      const d = JSON.parse(await readFile(FILE, "utf8"));
      return d && typeof d === "object" && d.byToken ? d : { byToken: {} };
    } catch { return { byToken: {} }; }
  }

  /* Through a temporary file and a rename, so an interrupted write leaves the
     previous version rather than half of this one. Same rule as store.save. */
  async function write(d) {
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(d, null, 2) + "\n", "utf8");
    await rename(tmp, FILE);
  }

  return {
    /** A fresh token for a merchant we have just minted an account for. */
    async remember({ account, email }) {
      const token = randomBytes(16).toString("hex");
      const d = await read();
      d.byToken[token] = { account: String(account), email: String(email || ""), at: new Date().toISOString() };
      await write(d);
      return token;
    },
    /** The account behind a cookie, or null. Never throws on a bad value. */
    async find(token) {
      const t = String(token || "");
      if (!/^[0-9a-f]{32}$/.test(t)) return null;
      const d = await read();
      return d.byToken[t] || null;
    },
  };
}
