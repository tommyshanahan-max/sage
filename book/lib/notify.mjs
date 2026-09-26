/* TELLING TOM A LESSON WAS BOOKED — to WeChat, where he already is.
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

export const on = () => Boolean(KEY || URL_T);

export function tell(title, body) {
  if (!on()) return;
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
