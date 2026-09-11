/* Invites: make them, list them, take one back.
 *
 * A code is six characters somebody types on a phone, in a hurry, out of a
 * WeChat message — so the alphabet has no O, no zero, no I and no one in it.
 * Those are the four that get read back wrong, and a code that cannot be
 * mistyped is worth more than one with two extra bits of entropy.
 *
 * THE LABEL IS FOR YOU. It never reaches the person spending the code: it is
 * how you know who did not turn up, and how one invite is taken back without
 * touching the others.
 *
 *   make invite WHO="Mei"        one code for Mei
 *   make invite WHO="Mei" N=3    three
 *   make invites                 what is out there, and what became of it
 *   make invite-off CODE=K7M2QP  take one back
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: invite.mjs <board url> <admin key> [--who NAME] [--n 3] [--list] [--off CODE]");
  process.exit(2);
}
const arg = (name) => {
  const i = rest.indexOf("--" + name);
  return i >= 0 ? rest[i + 1] : "";
};
const head = { "x-admin-secret": key, "Content-Type": "application/json" };

/* The public address, for the line you paste into a chat. BOARD_PUBLIC_URL if
 * it is set, because the board answers on its own hostname and is reached over
 * the compose network by another name entirely. */
const PUBLIC = (process.env.BOARD_PUBLIC_URL || "https://liuxuesheng.io").replace(/\/+$/, "");

const when = (iso) => (iso ? String(iso).slice(0, 10) : "");

async function list() {
  const d = await fetch(base + "/api/invite", { headers: head }).then((r) => r.json());
  const rows = d.invites || [];
  if (!rows.length) {
    console.log("No invites yet.  make invite WHO=\"their name\"");
    return;
  }
  console.log("code".padEnd(8) + "  " + "from".padEnd(16) + "  " + "made".padEnd(11) + "  state");
  for (const v of rows) {
    /* WHO WALKED IN ON IT, and it is the whole point of reading this list.
       The row has always known — see the note on /api/invite — and the line
       said "used 2026-09-10" and stopped, which answers a question nobody
       asks. A code was used; the name is what you wanted. */
    /* RUN OUT COMES BEFORE WAITING, because a row that says "waiting" about a
       code nobody can spend is the list lying quietly. A live one says when it
       stops, in hours while that is the useful unit and in days after. */
    const left = v.until ? Date.parse(v.until) - Date.now() : 0;
    const inWords = !v.until ? ""
      : left <= 0 ? "expired"
      : left < 36 * 3600e3 ? "expires in " + Math.max(1, Math.round(left / 3600e3)) + "h"
      : "expires in " + Math.round(left / 86400e3) + "d";
    const state = v.off ? "taken back"
      : v.used ? "used " + when(v.usedAt) + (v.usedName ? " by " + v.usedName : "")
      : inWords || "waiting";
    /* `who` is the label typed when it was minted. A member making one out of
       their own header types nothing, so that column was blank on exactly the
       rows where somebody inside did the vouching. Their name stands in. */
    console.log(v.code.padEnd(8) + "  " + (v.who || v.fromName || "—").padEnd(16).slice(0, 16)
      + "  " + when(v.at).padEnd(11) + "  " + state);
  }
  const spare = rows.filter((v) => !v.used && !v.off).length;
  console.log("");
  console.log(spare + " still to give out.");
}

async function main() {
  if (rest.includes("--list")) return list();

  const off = arg("off");
  if (off) {
    const r = await fetch(base + "/api/invite?code=" + encodeURIComponent(off),
      { method: "DELETE", headers: head });
    if (!r.ok) { console.error("No invite with that code."); process.exit(1); }
    console.log(off + " will not let anybody in now. The row stays, so who had it stays.");
    return;
  }

  const who = arg("who");
  const n = Number(arg("n")) || 1;
  /* HOW LONG IT LASTS. Nothing by default — see the note on /api/invite — and
     a number of hours when this code is for one person tonight. */
  const hours = Number(arg("hours")) || 0;
  /* WHO IT IS FOR, which is not the same as WHO. `who` is the label on the
     invite row — whoever vouched — and it is what the door says on the way
     in. This is the name of the person receiving it, and it goes in the link
     rather than in the board: it greets them and nothing else, so it is never
     stored, never checked, and opens nothing. */
  const forWhom = arg("for");
  const r = await fetch(base + "/api/invite", {
    method: "POST", headers: head, body: JSON.stringify({ who, n, hours }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("The board refused it:", r.status, d.error || "");
    process.exit(1);
  }

  /* Printed as the message you actually send, because the failure mode of a
     bare code is somebody pasting it with no link and the person on the other
     end having nowhere to type it. */
  /* The link carries the two names when there are two names. A door that
     opens with "Welcome, Christopher — Keith asked me to let you in" is a
     different arrival from a password box, and it costs nothing but a query
     string. Neither name is a credential; the code still is. */
  const q = [
    forWhom ? "for=" + encodeURIComponent(forWhom) : "",
    who ? "from=" + encodeURIComponent(who) : "",
  ].filter(Boolean).join("&");
  const link = PUBLIC + "/enter" + (q ? "?" + q : "");

  /* ONE BLOCK, WRITTEN THE WAY IT IS ACTUALLY SENT.
   *
   * This printed a heading, a link and a code on three lines, and what happens
   * next is somebody copying them one at a time into WeChat at midnight —
   * which on a bad night means pasting them into the terminal instead. The
   * message is the thing being made here, so the tool makes the message.
   *
   * The lines below the rule are not part of it. Everything between the rules
   * is what goes in the chat. */
  const lasts = hours
    ? " It works for " + hours + (hours === 1 ? " hour" : " hours") + " and lets one person in, once."
    : " It lets one person in, once.";
  for (const v of d.made) {
    console.log("");
    console.log("─".repeat(60));
    if (forWhom) {
      console.log(forWhom + " — this is the board I mentioned. It is invite only,");
      console.log("so here is your way in. " + lasts.trim());
      console.log("");
    }
    console.log(link);
    console.log(v.code);
    console.log("─".repeat(60));
  }
  console.log("");
  console.log("Everything between the rules is the message. Send the code with the"
    + " link — the link on its own opens nothing.");
  if (hours) {
    console.log("It stops working on its own at "
      + new Date(Date.now() + hours * 3600e3).toISOString().slice(0, 16).replace("T", " ")
      + " UTC. Nothing to remember.");
  }
  if (!forWhom) {
    console.log("");
    console.log('Name them and the door greets them by it:  make invite WHO="you" FOR="their name"');
  }
  if (!hours) {
    console.log('Give it a life:  make invite WHO="you" FOR="them" HOURS=24');
  }
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
