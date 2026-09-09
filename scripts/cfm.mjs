// Talking to the ledger from the box.
//
// The first version of this passed JSON through make, then bash, then docker,
// then node argv — four layers of quoting for one object, and it died on the
// first apostrophe. Everything here takes plain flags and builds the JSON on
// this side, which is what scripts/waiting.mjs does and why that one works.

const [, , base, key, cmd, ...rest] = process.argv;
if (!base || !key || !cmd) {
  console.error("usage: cfm.mjs <url> <key> setup|offer|offers [--who NAME ...]");
  process.exit(2);
}
const arg = (n, d = "") => {
  const i = rest.indexOf("--" + n);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : d;
};
const head = { "content-type": "application/json", "x-admin-secret": key };

async function post(path, body) {
  const r = await fetch(base + path, { method: "POST", headers: head, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("The ledger refused that:", d.error || r.status); process.exit(1); }
  return d;
}

if (cmd === "setup") {
  /* Once, on a new box. The ledger knows nothing about The Exchange until it
     is told: a name, a line, and where to send somebody who accepts. */
  await post("/api/project", {
    id: "the-exchange", name: "The Exchange", zh: "交换",
    line: "The people you need in China already know each other. This is the room.",
    goTo: arg("goto", "https://liuxuesheng.io/enter"), seats: 100,
  });
  await post("/api/package", {
    id: "founding", name: "Founding", project: "the-exchange",
    face: "plain", points: 500, perDay: 3,
  });
  /* The other audience. Same ledger, different screen — the tree and the
     per-head rates for somebody whose job is forwarding things. */
  await post("/api/package", {
    id: "connector", name: "Connector", project: "the-exchange",
    face: "reach", points: 200, perDay: 10,
  });
  console.log("\n  the-exchange · founding · connector\n");
} else if (cmd === "offer") {
  const who = arg("who");
  if (!who) { console.error('which one? make cfm-offer WHO="their name"'); process.exit(2); }
  const d = await post("/api/offer", {
    who, project: "the-exchange", package: arg("pack", "founding"),
    seat: Number(arg("seat", "0")) || 0, note: arg("note"), until: arg("until"),
  });
  const o = d.offer;
  console.log("\n  " + o.who + " · seat " + o.seat + " · " + o.package);
  console.log("\n      " + o.code + "\n");
  console.log("  Send them crowdfundme.app and that code. It opens their offer");
  console.log("  and nobody else's.\n");
} else if (cmd === "offers") {
  const r = await fetch(base + "/api/offers", { headers: head });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("The ledger refused that."); process.exit(1); }
  const rows = d.offers || [];
  if (!rows.length) { console.log("\n  No offers yet.\n"); process.exit(0); }
  console.log("");
  for (const o of rows) {
    const state = o.tookAt ? "accepted" : (o.openedAt ? "opened" : "not opened");
    console.log("  " + String(o.who).padEnd(16).slice(0, 16) +
      String(o.code).padEnd(8) + ("seat " + o.seat).padEnd(9) +
      String(o.package).padEnd(11) + state);
  }
  console.log("\n  " + rows.length + " in all.\n");
} else {
  console.error("setup, offer or offers.");
  process.exit(2);
}
