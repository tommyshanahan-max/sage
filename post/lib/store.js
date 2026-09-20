/* THE RECORD OF WHAT WENT WHERE.
 *
 * One file, /data/post.json, and it is the only thing standing between Tom and
 * posting the same video to the same platform twice. So it is written the way
 * board/lib/store.js writes the board: through a temporary file and a rename,
 * so an interrupted write leaves the previous version rather than half of this
 * one, and serialised by a promise chain, because two commands running at once
 * that both read-change-write leave whichever finished last as the only one
 * stored.
 *
 * WHY A FILE AND NOT A DATABASE. The whole of this is a few hundred jobs a
 * year. A database on this box is a container, a backup story and a migration
 * the first time a column changes; a JSON file is `cat` when something looks
 * wrong at eleven at night.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const DIR = process.env.POST_DIR || "/data";
export const FILE = path.join(DIR, "post.json");

const EMPTY = { jobs: [], version: 1 };

/** Shape-checked on the way in, so a hand-edited file cannot take the tool
 *  down — a missing key is an empty list, not a crash at 2am. */
function clean(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    jobs: Array.isArray(d.jobs) ? d.jobs.filter((j) => j && typeof j.id === "string") : [],
  };
}

export async function load() {
  try {
    return clean(JSON.parse(await fs.readFile(FILE, "utf8")));
  } catch (err) {
    /* No file yet is the normal state on install day, and it is not an error.
       Anything else is, and swallowing it would mean quietly starting from an
       empty record — which is how a video gets posted twice. */
    if (err.code === "ENOENT") return { ...EMPTY };
    throw err;
  }
}

export async function save(data) {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(clean(data), null, 2));
  await fs.rename(tmp, FILE);
}

/* Serialised writes. Same idiom as the board and the wallet ledger: every
   change goes on one promise chain, so a read-change-write can never interleave
   with another one. */
let chain = Promise.resolve();

export function change(fn) {
  const run = chain.then(async () => {
    const data = await load();
    const out = await fn(data);
    await save(data);
    return out;
  });
  chain = run.catch(() => {});
  return run;
}
