/* Six digits to an address, and nothing else ever goes out of here.
 *
 * WHY THERE IS NO npm PACKAGE UNDER THIS. The board has two dependencies and
 * it is a deliberate number: every one of them is code running on the box that
 * holds what members write, and a mail library is the classic place for a
 * supply-chain problem to arrive in a container that would otherwise never
 * need to open a socket. Sending mail is one POST. `fetch` is in the runtime.
 *
 * SHAPED LIKE RESEND because it is one JSON body and works from Tokyo, and
 * configured by URL so it is not Resend if somebody points it somewhere else:
 * any provider taking { from, to, subject, text } at a URL with a bearer token
 * works with the same three lines in .env.
 *
 * A WARNING ABOUT WHERE THESE LAND. 163, QQ and 126 are most of the Chinese
 * addresses this will ever be asked to reach, and all three are unkind to a
 * young sending domain — the code goes to the spam folder or nowhere, and the
 * member sees a board that is broken rather than a mail that is late. The page
 * says to look in the spam folder, and the key is still there underneath for
 * anybody this fails. A China-side sender (Alibaba DirectMail) is the fix when
 * there is a China-side company to hold the account.
 *
 * NOTHING IS LOGGED. Not the address, not the body, not on success and not on
 * failure: a log line with somebody's address in it is the same record as a
 * row with their address in it, and it would outlive the row by however long
 * the logs are kept. The caller gets true or false.
 */

const URL_ = (process.env.BOARD_MAIL_URL || "https://api.resend.com/emails").trim();
const KEY = (process.env.BOARD_MAIL_KEY || "").trim();
const FROM = (process.env.BOARD_MAIL_FROM || "").trim();

/** Whether mail can go out at all. The routes ask before they offer anybody a
 *  code, so a board with no mail configured says "not here" rather than
 *  swallowing the address and sending nothing. */
export const configured = () => Boolean(KEY && FROM);

/** Send one. Returns true if the provider took it, false for anything else —
 *  including a network that was not there, because the caller's only decision
 *  is whether to tell somebody to go and look in their inbox. */
export async function send({ to, subject, text }) {
  if (!configured() || !to || !subject || !text) return false;
  /* A CEILING ON HOW LONG THIS MAY HOLD A REQUEST. Somebody is watching a
     spinner on a phone; a provider having a bad afternoon must not turn that
     into a page that never answers. Ten seconds and we call it a failure. */
  const stop = AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined;
  try {
    const r = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
      body: JSON.stringify({ from: FROM, to: [String(to)], subject, text }),
      signal: stop,
    });
    return r.ok;
  } catch {
    return false;
  }
}
