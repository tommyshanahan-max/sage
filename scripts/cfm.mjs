// Talking to the ledger from the box.
//
// The first version of this passed JSON through make, then bash, then docker,
// then node argv — four layers of quoting for one object, and it died on the
// first apostrophe. Everything here takes plain flags and builds the JSON on
// this side, which is what scripts/waiting.mjs does and why that one works.

const [, , base, key, cmd, ...rest] = process.argv;
if (!base || !key || !cmd) {
  console.error("usage: cfm.mjs <url> <key> setup|setup-cfm|offer|offers [--who NAME ...]");
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
     is told: a name, a line, where to send somebody who accepts — and the
     story it tells on the second screen, which lives here rather than in the
     page so that the second project does not arrive reading the first one's
     pitch. */
  await post("/api/project", {
    id: "the-exchange", name: "The Exchange", zh: "交换",
    line: "The people you need in China already know each other. This is the room.",
    goTo: arg("goto", "https://liuxuesheng.io/enter"), seats: 100,
    claim: "The people you need in China already know each other.",
    sub: "Getting into that circle takes years. Usually it takes a person.",
    goal: "$500,000 in 18 months. Then a company in Singapore. All three figures at $50 a person — what rooms like this have sold for. An example, not a forecast.",
    marks: [
      { val: "$2k", when: "today" },
      { val: "$50k", when: "year one" },
      { val: "$500k", when: "10,000 people" },
    ],
  });
  await post("/api/package", {
    id: "founding", name: "Founding", project: "the-exchange",
    face: "plain", points: 500, perDay: 3,
    ask: "Bring one person worth having.|That is the whole ask.",
    why: "Fixed the day you accept. It never moves again, and everything you and your people do from here is on the record under your name.",
  });
  /* The other audience. Same ledger, different screen — the tree and the
     per-head rates for somebody whose job is forwarding things. */
  await post("/api/package", {
    id: "connector", name: "Connector", project: "the-exchange",
    face: "reach", points: 200, perDay: 10,
    ask: "Open one door.|The rest follows the people you know.",
    why: "Every person who comes through you, and every person who comes through them, counts under your name. You are not asked to manage any of it.",
  });
  console.log("\n  the-exchange · founding · connector\n");
} else if (cmd === "setup-cfm") {
  /* THE LEDGER, ON ITS OWN LEDGER.
     A share in crowdfundme is not a seat in a hundred and does not pretend to
     be one: no room to walk into, no queue, no points. It is the first stake
     offer, and it is also the proof that the boundary in lib/store.js held —
     the second project is a row and two API calls, not a rewrite. */
  await post("/api/project", {
    id: "crowdfundme", name: "crowdfundme", zh: "",
    line: "The record early backers are on, before there is a company to record them in.",
    /* Nowhere to send anybody. Accepting here ends in a sentence, which the
       offer page handles — see the `took` line in public/index.html. */
    goTo: "", seats: 0,
    claim: "Every early raise keeps its record somewhere that cannot defend itself.",
    sub: "Screenshots, a spreadsheet, and what somebody remembers being promised. Then counsel is asked to turn that into a cap table.",
    goal: "250 projects keeping their record here inside three years. The business is the ledger, not any one thing on it — and the first thing on it is already running.",
    marks: [
      { val: "1", when: "on it today" },
      { val: "25", when: "year one" },
      { val: "250", when: "projects" },
    ],
  });
  await post("/api/package", {
    id: "counsel", name: "Counsel", project: "crowdfundme",
    face: "stake",
    pct: Number(arg("pct", "10")), years: Number(arg("years", "4")),
    cliff: Number(arg("cliff", "12")),
    ask: "Make this stand up in law.|That is the whole ask.",
    why: "You already know what a record has to look like before anybody will act on it. Build that here, and the share is in the ledger itself — every project that ever runs on it, not one of them.",
  });
  console.log("\n  crowdfundme · counsel · " + arg("pct", "10") + "% over " +
    arg("years", "4") + "y, " + arg("cliff", "12") + "m cliff\n");
} else if (cmd === "offer") {
  const who = arg("who");
  if (!who) { console.error('which one? make cfm-offer WHO="their name"'); process.exit(2); }
  const d = await post("/api/offer", {
    who, project: arg("project", "the-exchange"), package: arg("pack", "founding"),
    seat: Number(arg("seat", "0")) || 0, note: arg("note"), until: arg("until"),
  });
  const o = d.offer;
  console.log("\n  " + o.who + " · " + o.project + " · " + o.package +
    (o.seat ? " · seat " + o.seat : ""));
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
      String(o.code).padEnd(8) + (o.seat ? "seat " + o.seat : "—").padEnd(9) +
      String(o.package).padEnd(11) + state);
  }
  console.log("\n  " + rows.length + " in all.\n");
} else {
  console.error("setup, setup-cfm, offer or offers.");
  process.exit(2);
}
