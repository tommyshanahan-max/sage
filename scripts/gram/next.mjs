/* Post the next one, and keep a record of what went out.
 *
 *   node scripts/gram/next.mjs          post one
 *   node scripts/gram/next.mjs --dry    say which one it would be
 *
 * WHAT "NEXT" MEANS. Not alphabetical: a feed that goes agent, brand,
 * director, founder for a fortnight is a feed somebody can predict and stop
 * opening. One at random from whatever has not gone out, which also means new
 * pairs added to the folder join the pool without any ordering to maintain.
 *
 * THE LEDGER IS THE POINT. posted.json is how this knows what has already
 * gone, and it is the only thing standing between a cron entry and the same
 * six posts every other day. It is written after Meta confirms, never before.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
const LEDGER = path.join(HERE, "posted.json");
const dry = process.argv.includes("--dry");

const seen = await readFile(LEDGER, "utf8").then(JSON.parse).catch(() => []);
const gone = new Set(seen.map((r) => r.name));
const all = (await readdir(OUT)).filter((f) => f.endsWith(".png"))
  .map((f) => f.replace(/\.png$/, ""));
const left = all.filter((n) => !gone.has(n));

if (!left.length) {
  /* NOT AN ERROR, AND NOT A REPEAT. Running dry is a thing to be told about
     once a day in a log, not a thing to paper over by posting something for
     the second time. */
  console.log(`All ${all.length} have gone out. Add pairs and run make gram.`);
  process.exit(0);
}

const pick = left[Math.floor(Math.random() * left.length)];
console.log(pick + "   (" + left.length + " left of " + all.length + ")");
if (dry) {
  spawnSync("node", [path.join(HERE, "post.mjs"), pick, "--dry"], { stdio: "inherit" });
  process.exit(0);
}

const ran = spawnSync("node", [path.join(HERE, "post.mjs"), pick], { stdio: "inherit" });
if (ran.status !== 0) process.exit(ran.status || 1);

seen.push({ name: pick, at: new Date().toISOString() });
await writeFile(LEDGER, JSON.stringify(seen, null, 2) + "\n", "utf8");
