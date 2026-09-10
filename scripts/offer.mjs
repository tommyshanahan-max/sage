/* Offers, from the box.
 *
 * WHY THIS IS A FILE AND NOT A LINE IN THE MAKEFILE. It started as
 * `node -e '...'` with backslash continuations, which make passes to the shell
 * untouched — and inside single quotes the shell does not treat a
 * backslash-newline as a continuation. Node received a literal backslash and
 * refused it. Three targets, one bug, and it only appeared on the box.
 *
 * The same shape as invite.mjs beside it: a URL, the admin key, and arguments.
 *
 *   node offer.mjs <base> <key> can-offer  --who Mia [--off]
 *   node offer.mjs <base> <key> send       --from Tom --who "Yana"
 *                                          --give "..." [--pays "..."] [--want "..."]
 *                                          [--project] [--public https://liuxuesheng.io]
 *   node offer.mjs <base> <key> list
 */
const [, , BASE, KEY, CMD, ...rest] = process.argv;
if (!BASE || !KEY || !CMD) {
  console.error("offer.mjs <base> <key> can-offer|send|list [flags]");
  process.exit(1);
}
const arg = (name, dflt = "") => {
  const i = rest.indexOf("--" + name);
  return i >= 0 && rest[i + 1] !== undefined ? rest[i + 1] : dflt;
};
const has = (name) => rest.includes("--" + name);

const call = async (path, opts = {}) => {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "x-admin-secret": KEY, ...(opts.body ? { "content-type": "application/json" } : {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (body.error === "which") {
      // Say which rows, and how to pick one. An error that leaves somebody
      // with no next move is barely better than the wrong answer.
      console.error("  more than one page has that name. Add --id:");
      for (const row of body.rows) {
        console.error("    --id " + row.id + "   (" + row.state
          + (row.canOffer ? ", can already" : "") + ")");
      }
    } else {
      console.error("  no: " + (body.error || r.status));
    }
    process.exit(1);
  }
  return body;
};

if (CMD === "can-offer") {
  const who = arg("who");
  // No --who is a question rather than a mistake: who can do this today.
  if (!who) {
    const d = await call("/api/admin/can-offer");
    const yes = d.people.filter((p) => p.canOffer);
    if (!yes.length) console.log("  nobody can make offers yet.");
    for (const p of yes) console.log("  " + p.handle + "  (" + p.state + ")");
    const dupes = {};
    for (const p of d.people) (dupes[p.handle.toLowerCase()] ||= []).push(p.state);
    for (const [h, states] of Object.entries(dupes)) {
      if (states.length > 1) console.log("  note: " + states.length + " rows named " + h + " — " + states.join(", "));
    }
    process.exit(0);
  }
  const d = await call("/api/admin/can-offer", {
    method: "POST", body: JSON.stringify({ who, id: arg("id"), on: !has("off") }),
  });
  console.log("  " + d.handle + " (" + d.state + ")"
    + (d.canOffer ? " can make offers." : " no longer can.")
    + (d.rows > 1 ? "  [" + d.rows + " rows share that handle]" : ""));
} else if (CMD === "send") {
  const give = arg("give");
  if (!arg("from") || !give) {
    console.error('  --from a member handle, --give what they would be doing');
    process.exit(1);
  }
  const d = await call("/api/admin/offer", {
    method: "POST",
    body: JSON.stringify({
      from: arg("from"), who: arg("who"), give,
      /* A job unless told otherwise. --project is the one that may go out with
         no --pays on it, and the one whose acceptance opens a few lines to
         settle the money in. */
      kind: has("project") ? "project" : "job",
      money: arg("pays"), want: arg("want"),
    }),
  });
  const host = arg("public", "https://liuxuesheng.io").replace(/\/+$/, "");
  console.log("");
  console.log("  From " + d.from + ", as " + (has("project") ? "a project" : "a job")
    + ". Send this, and nothing else:");
  console.log("  " + host + "/o/" + d.code);
  console.log("");
} else if (CMD === "list") {
  const d = await call("/api/admin/offer");
  if (!d.offers || !d.offers.length) { console.log("  none sent yet."); process.exit(0); }
  for (const o of d.offers) {
    const state = o.takenAt ? "taken by " + o.takenBy + " on " + o.takenAt.slice(0, 10)
      : o.off ? "withdrawn" : "waiting";
    console.log("  " + o.code + "  " + (o.kind === "project" ? "proj " : "job  ")
      + String(o.who || "—").padEnd(14)
      + state.padEnd(34) + (o.money || ""));
  }
} else {
  console.error("  unknown: " + CMD);
  process.exit(1);
}
