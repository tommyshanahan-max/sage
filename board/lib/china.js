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
    /** A fresh token for a merchant we have just minted an account for.
     *
     *  `by` IS THEIR IDENTITY AND IT IS NOT A BOARD IDENTITY. A payment
     *  request row wants a 32-hex hash for who is asking — the board fills
     *  it with a device hash, because on the board the asker is a member.
     *  Here they are not one and never will be: somebody arriving at these
     *  screens is a business deciding how to take money from China, and
     *  sending them through a sign-in with another product's name on it to
     *  raise an invoice is the wrong product wearing the right one's hat.
     *  So they get their own, minted once and kept beside the account. */
    async remember({ account, email }) {
      const token = randomBytes(16).toString("hex");
      const d = await read();
      d.byToken[token] = {
        account: String(account), email: String(email || ""),
        by: randomBytes(16).toString("hex"),
        name: "",
        at: new Date().toISOString(),
      };
      await write(d);
      return token;
    },

    /** The name their client reads at the top of the payment page. Asked for
     *  once, on the first request, and kept. */
    async nameIt(token, name) {
      const t = String(token || "");
      if (!/^[0-9a-f]{32}$/.test(t)) return null;
      const d = await read();
      const row = d.byToken[t];
      if (!row) return null;
      row.name = String(name || "").trim().slice(0, 64);
      await write(d);
      return row;
    },
    /* ONE TRIP TO STRIPE AND BACK, REMEMBERED.
     *
     * OAuth hands somebody to Stripe and takes them back on a URL anybody
     * could construct. `state` is the only thing between that and a link in
     * a message walking a merchant onto a stranger's account: minted here,
     * checked on return, and spent — a state that worked twice is a replay.
     *
     * Kept beside the accounts rather than in a signed cookie because it has
     * to survive the round trip in Safari, where a cookie set before leaving
     * for a third-party domain is exactly the thing ITP is suspicious of. */
    async beginLink() {
      const state = randomBytes(16).toString("hex");
      const d = await read();
      d.states = d.states && typeof d.states === "object" ? d.states : {};
      /* Anything older than an hour is somebody who wandered off mid-flow.
         Swept here so the file cannot grow for ever on abandoned attempts. */
      const cut = Date.now() - 3600 * 1000;
      for (const [k, v] of Object.entries(d.states)) {
        if (!v || Number(v.at) < cut) delete d.states[k];
      }
      d.states[state] = { at: Date.now() };
      await write(d);
      return state;
    },
    /** True once, for a state minted here within the hour. */
    async spendLink(state) {
      const t = String(state || "");
      if (!/^[0-9a-f]{32}$/.test(t)) return false;
      const d = await read();
      const row = d.states && d.states[t];
      if (!row) return false;
      delete d.states[t];
      await write(d);
      return Number(row.at) > Date.now() - 3600 * 1000;
    },
    /** The merchant behind a request row's `by`, or null.
     *
     *  The payer's page and the charge both resolve who gets the money by
     *  looking the asker up in board.people. A merchant who came through
     *  /china is not there and never will be, so the page said "has not said
     *  where the money should land" under a perfectly good amount and
     *  offered no way to pay — which is the same failure the Airwallex note
     *  above describes, arriving from the other direction. */
    async byBy(by) {
      const b = String(by || "");
      if (!/^[0-9a-f]{32}$/.test(b)) return null;
      const d = await read();
      for (const row of Object.values(d.byToken)) if (row && row.by === b) return row;
      return null;
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
