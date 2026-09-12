/* How a spoken line is cut into the pieces that light up.
 *
 * WHY THIS IS ITS OWN FILE. Two things cut the same sentence the same way and
 * they are not in the same place: room.html lights the pieces one at a time on
 * the arrival, and scripts/voice.mjs turns ElevenLabs' per-character timings
 * into one start time per piece. If those two ever disagreed about where a
 * sentence breaks, every word after the first mismatch would light on the
 * wrong sound — and it would look like a timing bug rather than a splitting
 * one, which is the sort of thing that costs a day. One function, imported by
 * both, so they cannot drift.
 *
 * A UNIT IS A WORD IN ENGLISH AND A CHARACTER IN CHINESE. The first version
 * split on whitespace, which in Chinese is no split at all: 我来帮你，很快就好。
 * is one unbroken run, so the whole line was one unit and the Chinese arrival
 * flashed its sentence up complete while the English one revealed word by
 * word. Chinese is read a character at a time anyway. Same rule as lines() in
 * postcard.js.
 */

/* Han, plus the CJK punctuation that sits between it — the full-width comma
   and full stop are their own beats in a Chinese line, not part of the
   character before them. */
const HANC = "㐀-䶿一-鿿豈-﫿　-〿＀-･";

/* The Latin run has to stop at a Han character as well as at a space, or \S+
   swallows an entire Chinese sentence the moment anything Latin precedes it —
   "Simon，你已经…" is one unbroken run of non-space. */
const RE = new RegExp("[" + HANC + "]|[^\\s" + HANC + "]+\\s*", "g");

/** Cut a line into the pieces that light up, in order.
 *
 *  Each piece carries where it started in the original string, because the
 *  voice's timings are per character and the only way back from a character
 *  index to a piece is that offset.
 *
 *  @param {string} text
 *  @returns {{text: string, at: number}[]}
 */
export function beatUnits(text) {
  const out = [];
  const re = new RegExp(RE.source, "g");   // its own lastIndex
  let m;
  while ((m = re.exec(String(text)))) out.push({ text: m[0], at: m.index });
  return out;
}
