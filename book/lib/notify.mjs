/* TELLING TOM A LESSON WAS BOOKED — on his board first, WeChat optionally.
 *
 * The same channel Study Pal's new-user alert uses (study-pal repo,
 * deploy/notify-new-users.sh): Server酱, a service that turns one HTTPS call
 * into a WeChat message, keyed by the SendKey in /root/notify.env on the box.
 * That file is handed to this container by docker-compose.yml, so there is no
 * second key to get and nowhere new to put one. NOTIFY_URL, if set there
 * instead, sends anywhere else — {title} and {body} are filled in.
 *
 * WHAT GOES IN THE MESSAGE: who, when, their WeChat, and the TEACHER's room
 * link — the one thing Tom has to do with a booking is forward that to the
 * teacher, so it arrives ready to forward. The student already has theirs.
 *
 * Never throws and never waits: a booking must not fail, or hang, because a
 * notification service is slow. With no key it does nothing at all.
 */
const KEY = (process.env.SCT_KEY || "").trim();
const URL_T = (process.env.NOTIFY_URL || "").trim();
/* FIRST CHOICE: TOM'S OWN BOARD. Mo says the booking into a room called
   Bookings that only Tom is in, and the board buzzes his phone the way it
   does for any message — no outside service at all. This came second in time:
   Server酱's WeChat login opened a blank page on Tom's phone, and a channel he
   cannot sign up for is not a channel. `make book-alerts` makes the room. */
const BOARD = (process.env.BOOK_BOARD_URL || "http://board:8080").replace(/\/$/, "");
const BOARD_KEY = (process.env.BOOK_BOARD_KEY || "").trim();
const ROOM = process.env.BOOK_ALERT_ROOM || "Bookings";

export const on = () => Boolean(BOARD_KEY || KEY || URL_T);

export function tell(title, body) {
  if (BOARD_KEY) {
    // One plain line for Mo — the room is not markdown.
    const text = (title + "\n" + body).replace(/\*\*/g, "").replace(/  \n/g, "\n");
    fetch(BOARD + "/api/admin/room-say", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": BOARD_KEY },
      body: JSON.stringify({ name: ROOM, text }),
      signal: AbortSignal.timeout(10e3),
    }).then((r) => { if (!r.ok) console.log(`notify board: ${r.status} (is there a "${ROOM}" room? make book-alerts)`); })
      .catch((e) => console.log(`notify board: ${e.message}`));
  }
  if (!KEY && !URL_T) return;
  const go = KEY
    ? fetch(`https://sctapi.ftqq.com/${encodeURIComponent(KEY)}.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ title, desp: body }).toString(),
      signal: AbortSignal.timeout(10e3),
    })
    : fetch(URL_T.replace("{title}", encodeURIComponent(title)).replace("{body}", encodeURIComponent(body)),
      { signal: AbortSignal.timeout(10e3) });
  go.then((r) => { if (!r.ok) console.log(`notify: ${r.status}`); })
    .catch((e) => console.log(`notify: ${e.message}`));
}
