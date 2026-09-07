/* Empty the board: every person, every post, every photograph.
 *
 * For handing a clean app to people who have not seen it — a test group opens
 * it and is the first thing on it, rather than arriving into somebody else's
 * half-finished demo.
 *
 * WHAT IT TOUCHES. One file and one directory, both inside the board's own
 * volume: /data/board.json and /data/media. Nothing else on the box. The
 * counter — visits, daily figures, the feature votes it keeps — is a different
 * service with a different volume and is not read or written here.
 *
 * WHAT IT KEEPS BY DEFAULT. A copy, beside the original, stamped with the
 * minute. Deleting a student's photograph is not undoable and "start again" is
 * a thing people ask for twice — once meaning it and once by mistake. The copy
 * makes the second one survivable, and the script prints the one command that
 * removes it when you are sure. Pass --no-backup to skip it and have the bytes
 * genuinely gone.
 *
 * It will not run without --yes. A script that empties a database on an
 * unadorned invocation is a script somebody runs while reading the README.
 *
 * Run it through the Makefile, which mounts this read-only into the board's own
 * container:  make board-reset
 */

import { readFile, writeFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

const DIR = process.env.BOARD_DIR || "/data";
const FILE = path.join(DIR, "board.json");
const MEDIA = path.join(DIR, "media");

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const EMPTY = { posts: [], people: [], follows: [], notes: [], wants: [] };

/** Written back in the same shape the board writes, so the first request after
 *  this does not take the "no file yet" path and rebuild something different. */
async function main() {
  let board = null;
  try {
    board = JSON.parse(await readFile(FILE, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }

  let media = [];
  try {
    media = await readdir(MEDIA);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }

  const n = (x) => (Array.isArray(x) ? x.length : 0);
  console.log("On the board now:");
  console.log("  people        ", n(board?.people));
  console.log("  posts         ", n(board?.posts));
  console.log("  follows       ", n(board?.follows));
  console.log("  messages      ", n(board?.notes));
  console.log("  feature votes ", n(board?.wants));
  console.log("  photographs   ", media.length);
  console.log("");

  if (!has("--yes")) {
    console.log("Nothing has been changed.");
    console.log("This deletes all of the above. To do it:  make board-reset YES=1");
    console.log("The counter — visits and daily figures — is a different service");
    console.log("and is not touched either way.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const keep = !has("--no-backup");

  if (keep && board) {
    const to = FILE + ".before-" + stamp;
    await writeFile(to, JSON.stringify(board, null, 2));
    console.log("Copy of the old board:", to);
  }
  if (keep && media.length) {
    const to = MEDIA + ".before-" + stamp;
    await rename(MEDIA, to);
    console.log("Copy of the photographs:", to);
  } else if (media.length) {
    await rm(MEDIA, { recursive: true, force: true });
    console.log("Photographs deleted:", media.length);
  }

  await mkdir(MEDIA, { recursive: true });
  await writeFile(FILE, JSON.stringify(EMPTY, null, 2));

  const after = JSON.parse(await readFile(FILE, "utf8"));
  const left = ["posts", "people", "follows", "notes", "wants"]
    .map((k) => n(after[k])).reduce((a, b) => a + b, 0);
  const stillThere = (await readdir(MEDIA)).length;
  if (left || stillThere) {
    console.error("The board is not empty after writing it. Nothing else was done.");
    process.exit(1);
  }

  console.log("");
  console.log("The board is empty. Nobody is on it and there are no photographs.");
  if (keep) {
    console.log("");
    console.log("When you are sure, the copies go with:");
    console.log("  docker compose exec board sh -c 'rm -rf /data/*.before-* /data/media.before-*'");
  }
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
