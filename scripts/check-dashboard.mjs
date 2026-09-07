/* Does the numbers dashboard actually finish drawing?
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 *
 * A ReferenceError halfway through a render is invisible. The lines before it
 * have already drawn, the lines after it never run, and the page looks like one
 * whose data did not arrive — so the hunt starts at the server, the network and
 * another company's API, none of which are the problem. That cost an hour, and
 * the fault was one identifier that was not in scope.
 *
 * So: run the page's own script against a stubbed DOM, call the app renderer
 * with a payload that has everything in it, and check that the figures written
 * at the END of that function got set. Anything that throws in between fails
 * this, whatever it was.
 *
 * Not a browser, and not pretending to be. It answers one question — does this
 * function reach its last line — which is the question that was hard to ask.
 *
 *   node scripts/check-dashboard.mjs
 * --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(here, "..", "analytics", "public", "index.html");
const html = readFileSync(page, "utf8");
const body = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Every id the markup defines, so getElementById answers like the real page.
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const made = new Map();
const node = (id) => {
  if (!made.has(id)) {
    const n = {
      id, textContent: "", innerHTML: "", hidden: false, className: "", style: {},
      children: [], dataset: {}, value: "", title: "",
      classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
      append: (...k) => n.children.push(...k),
      replaceChildren: (...k) => { n.children = k; },
      setAttribute: (a, v) => { n[a] = v; },
      addEventListener: () => {},
      closest: () => n,
      remove: () => {},
    };
    made.set(id, n);
  }
  return made.get(id);
};

const ctx = {
  console,
  document: {
    getElementById: (id) => (ids.includes(id) ? node(id) : null),
    createElement: () => node("made-" + Math.random()),
    createElementNS: () => node("svg-" + Math.random()),
    addEventListener: () => {},
    body: node("body"),
  },
  window: { addEventListener: () => {}, matchMedia: () => ({ matches: false, addEventListener(){} }) },
  // Never resolves, so the page's own start-up fetch makes no live call and
  // cannot race the assertions below.
  fetch: () => new Promise(() => {}),
  location: { search: "" },
  navigator: { clipboard: { writeText: async () => {} } },
  getSelection: () => ({ removeAllRanges(){}, addRange(){} }),
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  Intl, Date, Math, JSON, URL, URLSearchParams, Number, String, Object, Array, Set, Map, isNaN,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(body + "\n;globalThis.__drawApp = drawApp;", ctx);

const app = {
  count: 145, today: 6, week: 140, activeToday: 11, returningToday: 5,
  uses: [{ name: "speak", count: 523 }, { name: "ask", count: 142 }],
  usesByDay: [
    { day: "2026-09-06", uses: [{ name: "speak", count: 38 }, { name: "ask", count: 24 }] },
    { day: "2026-09-07", uses: [{ name: "speak", count: 8 }, { name: "ask", count: 4 }] },
  ],
  devices: [{ name: "speak", count: 46 }], deviceDays: 30, unit: "calls, not devices",
  screens: [], people: null, arrivals: null, places: null, sources: null, vias: null,
  url: "https://liuxuesheng.help/api/count?app=studypal",
};

ctx.__drawApp(app, [], "Asia/Shanghai");

const tiles = ["a-count", "a-today", "a-week", "a-active", "a-back"];
let bad = 0;
for (const id of tiles) {
  const v = made.get(id)?.textContent;
  const ok = v && v !== "—";
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "DASH"}  ${id.padEnd(9)} ${JSON.stringify(v)}`);
}
const when = made.get("today-when")?.textContent;
console.log(`${when ? "ok  " : "MISS"}  today-when ${JSON.stringify(when)}`);
console.log(bad ? `\n${bad} tile(s) still dashed` : "\nevery tile populated — drawApp runs to the end");
process.exit(bad ? 1 : 0);
