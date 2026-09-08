/* Who is waiting, and crossing them off.
 *
 * The only list on this board of people who are not on it. Treat a row as
 * something to act on and then delete: a way of reaching a stranger is not a
 * record worth keeping, and the page they typed it into says so.
 *
 *   make waiting                 who is waiting, oldest first
 *   make waiting-in ID=abc123    let in — hand them a code with `make invite`
 *   make waiting-no ID=abc123    not now
 *   make waiting-rm ID=abc123    delete the row outright
 */

const [, , base, key, ...rest] = process.argv;
if (!base || !key) {
  console.error("usage: waiting.mjs <board url> <admin key> [--in ID|--no ID|--rm ID]");
  process.exit(2);
}
const head = { "x-admin-secret": key, "Content-Type": "application/json" };
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? rest[i + 1] : ""; };
const when = (iso) => String(iso || "").slice(0, 10);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

async function mark(id, body) {
  const r = await fetch(base + "/api/waiting", {
    method: "POST", headers: head, body: JSON.stringify({ id, ...body }),
  });
  if (!r.ok) { console.error("No row with that id."); process.exit(1); }
  console.log("Done.");
}

async function main() {
  if (arg("in")) return mark(arg("in"), { done: "in" });
  if (arg("no")) return mark(arg("no"), { done: "no" });
  if (arg("rm")) return mark(arg("rm"), { remove: true });

  const d = await fetch(base + "/api/waiting", { headers: head }).then((r) => r.json());
  const rows = (d.waits || []).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  if (!rows.length) {
    console.log("Nobody is waiting.");
    return;
  }
  console.log(pad("id", 22) + pad("asked", 12) + pad("name", 16) + pad("reach", 24) + "state");
  console.log("-".repeat(88));
  for (const w of rows) {
    console.log(pad(w.id, 22) + pad(when(w.at), 12) + pad(w.name, 16)
      + pad(w.reach, 24) + (w.done === "in" ? "let in" : w.done === "no" ? "turned down" : "waiting"));
    if (w.why) console.log(pad("", 22) + "  " + w.why.replace(/\n/g, " ").slice(0, 60));
  }
  const open = rows.filter((w) => !w.done).length;
  console.log("");
  console.log(open + " waiting, " + rows.length + " rows in all.");
  console.log("Let somebody in with:  make waiting-in ID=... && make invite WHO=\"their name\"");
  console.log("A row is worth deleting once it is answered:  make waiting-rm ID=...");
}

main().catch((e) => { console.error(e && e.message ? e.message : e); process.exit(1); });
