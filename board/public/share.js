/* HANDING SOMETHING TO THE PHONE'S OWN SHARE SHEET, WITH THE LINK IN THE RIGHT
 * FIELD.
 *
 * ---------------------------------------------------------------------------
 * THE BUG THIS EXISTS TO STOP HAPPENING A FOURTH TIME
 *
 * Every share on this board was one blob: the words with the address in the
 * middle of them, handed over as `text` and nothing else. That is a message,
 * not a link.
 *
 * WhatsApp, Messenger, WeChat and everything else build their preview card
 * from the `url` field. Given only text they have nothing to fetch — so the
 * card comes out as the pasted sentence with a grey square where the picture
 * should be, and the pages' own og: tags, which are complete and correct and
 * have been the whole time, are never asked for.
 *
 * It was found and fixed once, on the room share in notes.html, and left
 * wrong in the three places nobody happened to be looking at: the invite on
 * Browse, the share offer beside it, and a group's invite. One function now,
 * because three copies of a rule are three chances for the next one to be
 * written the old way.
 *
 * ---------------------------------------------------------------------------
 * THE ADDRESS COMES OUT OF THE WORDS, and that is deliberate rather than
 * tidying. Passed in both fields it is said twice — once in the sentence and
 * once under the card — which reads like a mistake because it is one. The
 * clipboard path is the opposite and each caller still owns it: nothing is
 * going to fetch anything from a pasted string, so there the address has to
 * stay inline where it was written.
 *
 * WHAT THIS DOES NOT DECIDE. Whether to open a sheet at all is the caller's:
 * inside WeChat a page may not open one — the ⋯ menu is the only way there —
 * and every caller already has its own clipboard fallback and its own word for
 * what happened. This is the one line in the middle that kept being written
 * wrong.
 */

/** Open the share sheet with `url` in the field that builds the card.
 *
 *  Returns navigator.share's promise, so a caller keeps its own fallback: it
 *  rejects when the sheet is dismissed as well as when it is refused, and the
 *  two are not worth telling apart — a person who dismissed it did not send
 *  anything either.
 */
export function sheet({ title, words, url }) {
  const said = String(words || "");
  /* THE HOLE THE ADDRESS LEAVES BEHIND.
   *
   * Every string that mints one of these puts {url} on a line of its own, and
   * lifting it out leaves a blank line in the middle of a three-line message.
   * That is the case that matters and the first two rules handle it.
   *
   * The third is for the day somebody rewords a string and the address ends up
   * mid-sentence: "the board — {url} — the code is ABC" came out as "the board
   * —  — the code is ABC", which is worse than not having bothered. It cannot
   * fix every shape, and it is not meant to — a sentence with the address
   * taken out of it has to read as a sentence, and that is the string's job.
   * It fixes the one that a dash between two clauses leaves. */
  const text = url
    ? said.split(url).join("")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/([\u2014\u2013-])\s+\1/g, "$1")
        .trim()
    : said;
  return navigator.share(url ? { title, text, url } : { title, text });
}
