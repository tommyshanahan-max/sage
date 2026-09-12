/* Announcements, from the box.
 *
 * The poster is written in the app, behind the ＋, by whoever has the flag.
 * This file is the two things that cannot be done from in there: handing the
 * flag out, and reading back whether a poster actually brought anybody.
 *
 *   node announce.mjs <base> <key> can-announce [--who Tom] [--id ...] [--off]
 *   node announce.mjs <base> <key> list
 *
 * The same shape as offer.mjs beside it, and for the same reason: `node -e`
 * with backslash continuations passes the backslashes to the shell, which
 * inside single quotes does not treat them as continuations.
 */
const [, , BASE, KEY, CMD, ...rest] = process.argv;
if (!BASE || !KEY || !CMD) {
  console.error("announce.mjs <base> <key> can-announce|list [flags]");
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
      // A handle is not unique here. Say which rows rather than guessing —
      // the flag set on a row nobody uses is a button that never gets drawn
      // and a person hunting for it with nothing visibly wrong.
      console.error("  more than one page has that name. Add ID=:");
      for (const row of body.rows) {
        console.error("    ID=" + row.id + "   (" + row.state
          + (row.canAnnounce ? ", can already" : "") + ")");
      }
    } else {
      console.error("  no: " + (body.error || r.status));
    }
    process.exit(1);
  }
  return body;
};

if (CMD === "can-announce") {
  const who = arg("who");
  // No --who is a question rather than a mistake: who can do this today.
  if (!who) {
    const d = await call("/api/admin/can-announce");
    const yes = d.people.filter((p) => p.canAnnounce);
    if (!yes.length) console.log("  nobody can write an announcement yet.");
    for (const p of yes) console.log("  " + p.handle + "  (" + p.state + ")");
    process.exit(0);
  }
  const d = await call("/api/admin/can-announce", {
    method: "POST", body: JSON.stringify({ who, id: arg("id"), on: !has("off") }),
  });
  console.log("  " + d.handle + " (" + d.state + ")"
    + (d.canAnnounce ? " can write announcements — the ＋ has a new line on it."
                     : " no longer can.")
    + (d.rows > 1 ? "  [" + d.rows + " rows share that handle]" : ""));
} else if (CMD === "list") {
  const d = await call("/api/announce");
  if (!d.announces.length) { console.log("  nothing has been put up."); process.exit(0); }
  for (const a of d.announces) {
    console.log("");
    console.log("  " + a.title + (a.state === "removed" ? "   [taken down]" : ""));
    console.log("  " + BASE.replace(/\/$/, "") + "/a/" + a.code);
    /* BOTH NUMBERS AND THE SECOND IS THE ONE THAT MEANS ANYTHING. A poster
       opened four hundred times that brought nobody was the wrong poster, and
       the first figure on its own reads as a triumph. */
    console.log("  " + a.seen + " opened it, " + a.joined + " put their name down");
  }
  console.log("");
} else {
  console.error("  can-announce | list");
  process.exit(1);
}
