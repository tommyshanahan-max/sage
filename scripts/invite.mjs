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
  console.log("code".padEnd(8) + "  " + "who".padEnd(16) + "  " + "made".padEnd(11) + "  state");
  for (const v of rows) {
    const state = v.off ? "taken back"
      : v.used ? "used " + when(v.usedAt)
      : "waiting";
    console.log(v.code.padEnd(8) + "  " + (v.who || "—").padEnd(16).slice(0, 16)
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
  const r = await fetch(base + "/api/invite", {
    method: "POST", headers: head, body: JSON.stringify({ who, n }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("The board refused it:", r.status, d.error || "");
    process.exit(1);
  }

  /* Printed as the message you actually send, because the failure mode of a
     bare code is somebody pasting it with no link and the person on the other
     end having nowhere to type it. */
  for (const v of d.made) {
    console.log("");
    console.log(v.who ? "For " + v.who + ":" : "Invite:");
    console.log("  " + PUBLIC + "/i/" + v.code);
    console.log("  " + v.code);
  }
  console.log("");
  console.log("One person each. Send the link and the code — either one opens the door.");
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
