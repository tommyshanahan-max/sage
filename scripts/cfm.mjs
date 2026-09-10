// Talking to the ledger from the box.
//
// The first version of this passed JSON through make, then bash, then docker,
// then node argv — four layers of quoting for one object, and it died on the
// first apostrophe. Everything here takes plain flags and builds the JSON on
// this side, which is what scripts/waiting.mjs does and why that one works.

const [, , base, key, cmd, ...rest] = process.argv;
if (!base || !key || !cmd) {
  console.error("usage: cfm.mjs <url> <key> setup|setup-cfm|owner|owners|grantor|stake|offer|offers|due|seal|seals|anchor|verify|anchoring|unseal|reopen|void [--who NAME ...]");
  process.exit(2);
}
const arg = (n, d = "") => {
  const i = rest.indexOf("--" + n);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : d;
};
/* The same flag more than once. Only --step needs it, and it needs it because
   a deal with three milestones has three of them and a comma-separated list
   in one string is a parser waiting to meet somebody's sentence. */
const args = (n) => {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--" + n && rest[i + 1]) out.push(rest[i + 1]);
  }
  return out;
};
const head = { "content-type": "application/json", "x-admin-secret": key };

async function get(path) {
  const r = await fetch(base + path, { headers: head });
  if (!r.ok) { console.error("The ledger refused that:", r.status); process.exit(1); }
  return r.json().catch(() => ({}));
}

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
    from: arg("from", "Tom"),
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
    claim: "Early founder deals get done on a napkin.",
    sub: "Then somebody has to remember what it said, years later, when it has become expensive to remember it wrong. We keep the record instead.",
    goal: "250 projects keeping their record here inside three years. The business is the ledger — what counsel and the tokenisation platforms get handed when a deal turns real — not any one thing on it.",
    marks: [
      { val: "1", when: "on it today" },
      { val: "25", when: "year one" },
      { val: "250", when: "projects" },
    ],
    /* The full name here, not the first one. This project's offers are stakes,
       and a stake with no named grantor is a screenshot rather than a record —
       check the spelling before anybody opens it. */
    from: arg("from", "Tom Shanahan"),
    holds: arg("holds",
      "Sole owner today. This comes out of that holding, not out of a pool set aside for it."),
  });
  await post("/api/package", {
    id: "counsel", name: "Counsel", project: "crowdfundme",
    face: "stake",
    pct: Number(arg("pct", "10")), years: Number(arg("years", "4")),
    cliff: Number(arg("cliff", "12")),
    ask: "Make this stand up in law.|That is the whole ask.",
    why: "This never does the legal work — when a deal becomes real the record is handed to the people who do. Your firm is where it gets handed to. Build the thing that feeds you, and the share is in the ledger itself: every project that ever runs on it, not one of them.",
  });
  console.log("\n  crowdfundme · counsel · " + arg("pct", "10") + "% over " +
    arg("years", "4") + "y, " + arg("cliff", "12") + "m cliff");
  console.log("  granted by " + arg("from", "Tom Shanahan") +
    " — check that spelling, it is on his offer\n");
} else if (cmd === "due") {
  /* IS THERE A MONTH SITTING UNSEALED?
   *
   * Sealing is the one thing here that does not happen by itself, and the
   * only thing holding the promise up. The offer page tells the person
   * signing that their record gets hashed and put somewhere neither side
   * controls; if nobody runs `make cfm-seal` in the first week of the month,
   * that is simply not true, and nothing anywhere says so. A promise that
   * depends on somebody remembering is not a promise.
   *
   * So this is asked on every deploy — see `make up`. Quiet when there is
   * nothing to do, loud when there is, and never fatal: a box that will not
   * deploy because of a bookkeeping reminder is a worse box.
   */
  const d = await get("/api/seals");
  const seals = (d && d.seals) || [];
  const done = new Set(seals.map((x) => x.month));
  const now = new Date();
  const out = [];
  // Back a year, and only months that have actually ended.
  for (let i = 1; i <= 12; i++) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(t.toISOString().slice(0, 7));
  }
  const missing = out.filter((m) => !done.has(m)).sort();
  // Only from the first sealed month onwards: months before this ledger
  // existed were never going to be sealed and are not a debt.
  const first = seals.length ? seals.map((x) => x.month).sort()[0] : "";
  const owed = first ? missing.filter((m) => m > first) : missing.slice(-1);
  if (!owed.length) {
    console.log("  Every finished month is sealed.");
  } else {
    console.log("\n  NOT SEALED YET: " + owed.join(", "));
    console.log("  The offer pages say these records are hashed and anchored.");
    console.log("  Until this runs, they are not:");
    for (const m of owed) console.log("      make cfm-seal MONTH=" + m);
    console.log("");
  }
} else if (cmd === "grantor") {
  /* The two things a project needs the day it makes its first stake offer:
     who is granting the share, in full, and what holding it comes out of.
     Its own command because it is the one edit you make to a project that is
     already set up, and posting the whole project again to change two fields
     is how the other eight get blanked. */
  const id = arg("id", "the-exchange");
  const d = await post("/api/project/from", {
    id, from: arg("from"), holds: arg("holds"), sig: arg("sig"),
  });
  console.log("\n  " + d.project.name + " — granted by " + (d.project.from || "(nobody named)"));
  if (d.project.holds) console.log("      " + d.project.holds);
  if (d.project.sig) console.log("      signature: /" + d.project.sig);
  console.log("");
  if (!d.project.from) {
    console.log("  A stake offer with no named grantor is a screenshot, not a record.");
    console.log('  make cfm-grantor ID=' + id + ' FROM="Your Full Name" HOLDS="..."\n');
  }
} else if (cmd === "stake") {
  /* A SHARE IN SOMETHING, WITH AN EARN-OUT.
   *
   * The `setup-cfm` command above writes one of these by hand for counsel.
   * This is the general one, because "five per cent now and more if something
   * happens" is how these deals are actually made and there was nowhere to
   * put the second half — it ended up as prose in a note, which is the napkin
   * with a nicer font.
   *
   *   --step "3|ships v1 and it is in front of users"
   *
   * A percentage, a pipe, and the thing that has to happen in the words the
   * two of you used. Repeat it for each one, up to four. Both halves matter:
   * the ledger holds them, judges neither, and issues nothing.
   */
  const id = arg("id");
  const name = arg("name");
  if (!id || !name) {
    console.error('needs both: --id aiden --name "Founding engineer"');
    process.exit(2);
  }
  /* TWO WAYS IN, AND THE SECOND ONE IS WHY. --step repeated is the readable
     form for anybody driving this directly. --steps is one string with
     semicolons in it, and it exists because the Makefile has to hand these
     through make, then sh, then docker: splitting them in the shell means a
     condition with a space in it arrives as three arguments, and a condition
     without spaces in it is not a sentence anybody wrote. Split here, where
     there is exactly one thing doing the parsing. */
  const raw = [...args("step"),
    ...arg("steps").split(";").map((t) => t.trim()).filter(Boolean)];
  const steps = raw.map((t) => {
    const at = t.indexOf("|");
    if (at < 0) {
      console.error('a step is a percentage, a pipe, then the condition: --step "3|ships v1"');
      process.exit(2);
    }
    return { pct: Number(t.slice(0, at).replace(/[^0-9.]/g, "")), on: t.slice(at + 1).trim() };
  });
  const pct = Number(arg("pct", "5"));
  await post("/api/package", {
    id, name, project: arg("project", "crowdfundme"), face: "stake",
    pct, years: Number(arg("years", "4")), cliff: Number(arg("cliff", "12")),
    steps,
    ask: arg("ask"), why: arg("why"),
  });
  const all = steps.reduce((n, m) => n + m.pct, pct);
  console.log("\n  " + arg("project", "crowdfundme") + " · " + id + " · " + pct + "% over "
    + arg("years", "4") + "y, " + arg("cliff", "12") + "m cliff");
  for (const m of steps) console.log("      +" + m.pct + "%  " + m.on);
  if (steps.length) console.log("      = up to " + Math.round(all * 10) / 10 + "% in all");
  console.log("\n  Now make the offer:");
  console.log('      make cfm-offer WHO="their name" PROJECT=' + arg("project", "crowdfundme")
    + " PACK=" + id + '\n');
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
} else if (cmd === "reopen" || cmd === "void") {
  const code = arg("code");
  if (!code) { console.error("which one? CODE=ABC123"); process.exit(2); }
  const d = await post("/api/undo", { code, how: cmd });
  if (cmd === "reopen") {
    console.log("\n  " + d.who + "'s offer is open again. Same code: " + code.toUpperCase());
    console.log("  Nothing on the record says it was accepted.\n");
  } else {
    console.log("\n  Gone: " + d.who + " · " + code.toUpperCase());
    console.log("  That code opens nothing now.\n");
  }
} else if (cmd === "owner") {
  /* A founder who is not you. The key prints once — it is stored to be
     matched and no route reads it back, so losing it means a new one. */
  const name = arg("name");
  if (!name) { console.error('who? make cfm-owner NAME="their name"'); process.exit(2); }
  const d = await post("/api/owner", { name, projects: Number(arg("projects", "1")) || 1 });
  const o = d.owner;
  console.log("\n  " + o.name + " · " + o.projects +
    (o.projects === 1 ? " project" : " projects"));
  console.log("\n      " + o.key + "\n");
  console.log("  Send them crowdfundme.app/f and that key. It is shown once —");
  console.log("  nothing here can read it back.\n");
} else if (cmd === "owners") {
  const r = await fetch(base + "/api/owners", { headers: head });
  const d = await r.json().catch(() => ({}));
  const rows = d.owners || [];
  if (!rows.length) { console.log("\n  Nobody yet.\n"); process.exit(0); }
  console.log("");
  for (const o of rows) {
    console.log("  " + String(o.name).padEnd(20).slice(0, 20) +
      (o.has + " of " + o.projects).padEnd(12) + "projects");
  }
  console.log("");
} else if (cmd === "seal") {
  /* Chained to the last one, so an old month cannot be quietly re-sealed. */
  const r = await fetch(base + "/api/seal", {
    method: "POST", headers: head, body: JSON.stringify({ month: arg("month") }),
  });
  const d = await r.json().catch(() => ({}));
  if (d.error === "early") {
    console.error("\n  " + d.month + " is not over. A month is sealed once it is,");
    console.error("  or every entry after today falls outside its own seal.\n");
    process.exit(1);
  }
  if (!r.ok) { console.error("The ledger refused that:", d.error || r.status); process.exit(1); }
  const x = d.seal;
  console.log("\n  " + x.month + " sealed · " + x.count +
    (x.count === 1 ? " entry" : " entries"));
  console.log("\n  " + x.hash + "\n");
  if (d.anchored) {
    console.log("  On Stellar " + x.net + ":");
    console.log("  https://stellar.expert/explorer/" +
      (x.net === "public" ? "public" : "testnet") + "/tx/" + x.ref);
    console.log("\n  Anybody can check that month against it without asking you.\n");
  } else if (d.why) {
    console.log("  Sealed, but the chain did not take it:");
    console.log("  " + d.why);
    console.log("\n  The seal stands. Try again with: make cfm-anchor MONTH=" + x.month + "\n");
  } else {
    console.log("  Nothing has been published anywhere. Until it is, this proves the");
    console.log("  record has not changed since — not that it could not.\n");
  }
} else if (cmd === "anchor") {
  const month = arg("month");
  if (!month) { console.error("which month? MONTH=2026-08"); process.exit(2); }
  const r = await fetch(base + "/api/anchor", {
    method: "POST", headers: head, body: JSON.stringify({ month }),
  });
  const d = await r.json().catch(() => ({}));
  if (d.error === "key") {
    console.error("\n  The value in .env is not a Stellar secret.\n  " + d.why + "\n");
    process.exit(1);
  }
  if (d.error === "off") {
    console.error("\n  Anchoring is off. Set CFM_STELLAR_SECRET in .env to turn it on.\n");
    process.exit(1);
  }
  if (d.error === "unsealed") {
    console.error("\n  " + month + " is not sealed yet. Seal it first.\n");
    process.exit(1);
  }
  if (!r.ok) { console.error("\n  The chain refused that:\n  " + (d.why || d.error) + "\n"); process.exit(1); }
  console.log("\n  " + d.month + " is on Stellar " + d.net);
  console.log("\n      " + d.ref + "\n");
  console.log("  https://stellar.expert/explorer/" +
    (d.net === "public" ? "public" : "testnet") + "/tx/" + d.ref + "\n");
} else if (cmd === "verify") {
  /* Reads the chain, not the file — a check that trusts what it is checking
     is not a check. */
  const month = arg("month");
  if (!month) { console.error("which month? MONTH=2026-08"); process.exit(2); }
  const r = await fetch(base + "/api/verify?month=" + encodeURIComponent(month));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("\n  " + (d.error === "unsealed" ? month + " is not sealed." : "no") + "\n"); process.exit(1); }
  console.log("\n  " + d.month);
  console.log("  sealed as    " + d.stored);
  console.log("  rows hash to " + d.now);
  console.log("  " + (d.matches
    ? "→ the record has not changed since it was sealed."
    : "→ THE RECORD HAS CHANGED SINCE IT WAS SEALED."));
  if (!d.anchored) {
    console.log("\n  Not on any chain, so that check is ours to make and yours to trust.\n");
  } else if (d.why) {
    console.log("\n  Could not reach the chain: " + d.why + "\n");
  } else {
    console.log("\n  chain says   " + (d.chain || "(nothing at that month)"));
    console.log("  " + (d.agrees
      ? "→ and the chain agrees. Anybody can check this without us."
      : "→ THE CHAIN DISAGREES WITH THESE ROWS."));
    console.log("\n  https://stellar.expert/explorer/" +
      (d.net === "public" ? "public" : "testnet") + "/tx/" + d.ref + "\n");
  }
} else if (cmd === "anchoring") {
  const r = await fetch(base + "/api/anchoring");
  const d = await r.json().catch(() => ({}));
  if (d.bad) {
    console.log("\n  The value in .env is not a Stellar secret.");
    console.log("  " + d.why);
    console.log("\n  Delete the line and write it again:");
    console.log("    sed -i '/^TOMSCODING_CFM_STELLAR_SECRET=/d' .env");
    console.log("    printf 'TOMSCODING_CFM_STELLAR_SECRET=%s\\n' YOUR_KEY >> .env");
    console.log("\n  Then: make up, then this again.\n");
  } else if (!d.on) {
    console.log("\n  Anchoring is off. Seals stay on this server only.");
    console.log("  Set CFM_STELLAR_SECRET (and CFM_STELLAR_NET=test) in .env.\n");
  } else {
    console.log("\n  Anchoring to Stellar " + d.net);
    console.log("  from account " + d.by);
    if (d.net === "test") {
      console.log("\n  Fund it once, free:");
      console.log("  https://friendbot.stellar.org/?addr=" + d.by + "\n");
    } else { console.log(""); }
  }
} else if (cmd === "unseal") {
  const d = await post("/api/unseal", {});
  console.log("\n  " + d.seal.month + " is open again. The seal is gone.\n");
} else if (cmd === "seals") {
  const r = await fetch(base + "/api/seals");
  const d = await r.json().catch(() => ({}));
  const rows = d.seals || [];
  if (!rows.length) { console.log("\n  No months sealed yet.\n"); process.exit(0); }
  console.log("");
  for (const x of rows) {
    console.log("  " + x.month + "  " + String(x.count).padStart(4) + "  " +
      x.hash.slice(0, 16) + "…  " + (x.ref || "not published"));
  }
  console.log("");
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
  console.error("setup, setup-cfm, owner, owners, offer, offers, seal, seals, anchor, verify, anchoring, unseal, reopen or void.");
  process.exit(2);
}
