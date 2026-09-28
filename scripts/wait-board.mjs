/* WAIT FOR THE BOARD TO ANSWER, then get on with it.
 *
 * WHY THIS EXISTS. `make board` rebuilds the image and restarts the
 * container, and a command run straight after it lands on a port that is
 * open and a process that is not ready. Three different commands failed that
 * way in one afternoon — `make show` with a bare SocketError and a stack
 * trace, `make can-invite` with "The board did not answer. Is it up?" — and
 * every one of them worked when run again thirty seconds later.
 *
 * That is the shape of a step somebody has to learn and then remember, which
 * is the kind of step this box is supposed to delete. So the scripts wait.
 *
 * IT IS A CONNECTION PROBLEM ONLY. A board that answers 400, 403 or 404 is a
 * board that is up and has an opinion, and that is the script's business
 * rather than this one's — only a refused or dropped connection is retried.
 * Ten seconds of it, which covers a restart and is short enough that a box
 * that is genuinely down still says so while somebody is still watching.
 */
export async function boardFetch(url, opts = {}, tries = 10) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      last = err;
      /* Not on the last go round: a second of silence after the final try is
         a second somebody spends looking at nothing. */
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw last;
}
