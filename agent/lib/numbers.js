// The figures, in Sage's own head rather than only on a page.
//
// ---------------------------------------------------------------------------
// Why this exists
//
// The dashboard has always been a link. Sage could tell you it was there and
// could not tell you what it said, so "how are we doing" got an answer about
// where to click. That is a worse answer than the numbers, and the numbers are
// two containers away over a network this seat is already on.
//
// So the same analytics endpoint the masthead reads is read again here and
// folded into the system prompt. Not the whole payload: a dozen figures a
// person would actually open the page for, plus the handful of rules that stop
// them being read wrongly. A model given a raw analytics dump will average
// something, and the averaged thing will be wrong in a way that sounds
// confident.
//
// Who gets it is decided by the caller, from canSeeNumbers in role.js — the
// owner always, a partner while the grant is on, a prospect never. The token
// is not in the prospect's container at all, so the check and the missing
// credential both have to fail before a figure reaches the wrong seat.
// ---------------------------------------------------------------------------

const URL_BASE = process.env.AGENT_NUMBERS_URL || "";
const TOKEN = process.env.AGENT_NUMBERS_TOKEN || "";

export const configured = () => Boolean(URL_BASE);

// A minute. The dashboard itself caches the upstream app read for the same
// span, so asking more often than this returns the same numbers over a slower
// path — and a conversation is many turns, each of which would otherwise be
// its own round trip.
const TTL_MS = 60_000;
let cache = { at: 0, text: null };

/** Whole days between an ISO day and today, or null. Used to say how old the
 *  product is, which is what makes a structural zero legible as one. */
function daysSince(day) {
  if (!day) return null;
  const then = Date.parse(day + "T00:00:00Z");
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** Top few of a ranked list, as "speak 350 (41 people)". */
function rank(list, people, limit = 5) {
  if (!Array.isArray(list) || !list.length) return null;
  const who = new Map((people || []).map((p) => [p.name, p.count]));
  return list.slice(0, limit).map((i) => {
    const n = who.get(i.name);
    return `${i.name} ${i.count}${n === undefined ? "" : ` (${n} people)`}`;
  }).join(", ");
}

/** The figures as a block for the system prompt, or "" if there are none.
 *
 *  Never throws. A counter having a bad minute must not stop a seat answering
 *  — it means Sage opens without the figures, the way it always used to. */
export async function brief() {
  if (!URL_BASE) return "";
  if (Date.now() - cache.at < TTL_MS) return cache.text || "";

  let data;
  try {
    const r = await fetch(URL_BASE + "/api/stats?days=14", {
      headers: TOKEN ? { authorization: "Bearer " + TOKEN } : {},
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new Error("counter said " + r.status);
    data = await r.json();
  } catch {
    // Cached as empty for the window, so a counter that is down does not get
    // a request per turn on top of whatever is already wrong with it.
    cache = { at: Date.now(), text: "" };
    return "";
  }

  const app = data.app || null;
  const site = data.today || null;
  const lines = [];

  if (app) {
    lines.push(`- The app (${app.url ? new URL(app.url).hostname : "the app"}): `
      + `${app.count} people have ever opened it, ${app.today} of them today. `
      + `${app.activeToday} used it today, ${app.returningToday} of those had been before.`);

    const p = app.people;
    if (p && p.total) {
      lines.push(`- Coming back: ${p.returned} of ${p.total} have ever returned `
        + `(${pct(p.returned, p.total)}%). ${p.onceOnly} came once and not again.`);
      const age = daysSince(p.firstFrom);
      if (age !== null) {
        lines.push(`- The app has been recording arrivals for ${age} day${age === 1 ? "" : "s"}`
          + `, since ${p.firstFrom}.`);
      }
    }

    const uses = rank(app.uses, app.devices);
    if (uses) {
      lines.push(`- Most used, counted in calls: ${uses}.`
        + (app.deviceDays ? ` The people figures cover the last ${app.deviceDays} days.` : ""));
    }
    const screens = rank(app.screens, null, 4);
    if (screens) lines.push(`- Screens opened: ${screens}.`);
  }

  if (site) {
    lines.push(`- The site today: ${site.devices} people, ${site.fresh} of them new.`);
  }

  if (!lines.length) {
    cache = { at: Date.now(), text: "" };
    return "";
  }

  const text = `

# Where the numbers stand

Read fresh at the start of this turn, from the same counter the dashboard uses.
The full picture is at /numbers/ on this seat.

${lines.join("\n")}

## Reading them without being wrong

- Feature figures count calls, not people. 350 speaks is not 350 speakers, and
  the people figure beside it covers a shorter window, so the two are not a
  ratio and one does not divide into the other.
- Whether people came back matters more than the total. A total only ever
  rises, so it cannot tell you anything has gone wrong.
- "Came back today" cannot include anyone who arrived today, so on the day of
  a share it is low for arithmetic reasons rather than for bad ones.
- Where a figure needs more time than the product has had — people still
  around after a week, on an app that is four days old — say so rather than
  reporting the zero. It is the calendar, not the audience.

## When a conversation opens

The first time you reply in a conversation, before anything else: welcome them
back, give the handful of figures that actually moved, and say what you make of
them in a sentence or two. An appraisal, not a recital — which number is the
one worth looking at today, and whether it is good, flat or a problem. Say it
plainly, including when it is dull; a week where nothing moved is worth being
told in one line rather than dressed up.

Keep the whole opening short, six lines at the outside. They can ask for more,
and they will if it is interesting. Do not repeat this on later turns.
`;

  cache = { at: Date.now(), text };
  return text;
}
