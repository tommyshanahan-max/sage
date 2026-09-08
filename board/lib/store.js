// The board's own record: what was posted, what became of it, and the files.
//
// ---------------------------------------------------------------------------
// Why files rather than a database
//
// The same call the rest of this platform makes. A JSON file in a Docker volume
// is legible with `cat`, copied with `cp`, and backed up by anything that can
// copy a directory. At the scale this starts at — a noticeboard for foreigners
// in one city — a database is a dependency to run, back up and migrate in
// exchange for query patterns nobody has yet.
//
// The day it stops being enough is a day with a number attached to it, and the
// shape below is deliberately the shape a row would take.
// ---------------------------------------------------------------------------

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import path from "node:path";

/** Where a post can be. Four, and each is a different fact:
 *
 *   held      — waiting for a person. The default for anything new, until a
 *               check exists that can judge it.
 *   published — live on the board.
 *   refused   — turned away, with a reason. Kept, because "was refused and
 *               why" is the answer to a question somebody will ask.
 *   removed   — was live, taken down. Different from never having existed. */
export const STATES = ["held", "published", "refused", "removed"];

/** Ids are generated here and never taken from a caller: they become
 *  filenames, and a filename decided by a stranger is a path decided by a
 *  stranger. */
export const newId = () => randomUUID().replace(/-/g, "").slice(0, 20);

/** The shape stored, from whatever arrives. Anything malformed costs its own
 *  row rather than the file. */
/* ---------------------------------------------------------------------------
 * The waiting list
 *
 * The one place this board hears from somebody who is not in it. It exists
 * because a door with nothing outside it is a door nobody knocks on: the
 * public page shows one post and a number, and this is where the number comes
 * from.
 *
 * WHAT IT HOLDS, AND WHY THAT IS A DECISION AND NOT A FORM. A way to reach
 * somebody who is not a member is exactly the kind of data this board has
 * spent its life not holding — so it is one field, it is visible to nobody but
 * whoever runs the box, and the honest thing to do with a row is act on it and
 * delete it. Nothing here is ever shown on the board, and no member can read
 * the list.
 * ------------------------------------------------------------------------- */
/* WHAT SOMEBODY OUTSIDE SAYS THEY ARE COMING FOR.
 *
 * Four, not thirteen. The board's own rooms are the vocabulary of somebody who
 * is already in it — a stranger who has never seen the place cannot be asked
 * to choose between "a model or creative looking for an agent" and "an agent
 * or manager looking for people". Film & TV holds both sides of that, and both
 * sides of it will pick it.
 *
 * It is a bucket for whoever reads the list, not a field on a profile. Once
 * somebody is in they pick their real rooms themselves; this only decides
 * which pile they are in while they wait, and that is the whole point of it —
 * a room admitted together is a room that is warm on the morning they arrive,
 * instead of six people each landing in an empty feed one at a time.
 */
export const WAITROOMS = ["film", "invest", "raise", "trade", "other"];

export function cleanWait(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, n);
  const name = s(raw.name, 40);
  const reach = s(raw.reach, 80);
  if (!name || !reach) return null;
  return {
    id: /^[a-f0-9]{20}$/.test(String(raw.id || "")) ? String(raw.id) : newId(),
    name,
    // One way to be reached, in whatever shape they typed it. Not validated
    // into an email: half of the people this is for do not use one.
    reach,
    // Why they want in, in their own words. The only thing a member vouching
    // for a stranger has to go on.
    why: s(raw.why, 300),
    at: s(raw.at, 40) || new Date().toISOString(),
    // The browser that asked, so one person cannot fill the list on their own.
    by: s(raw.by, 64),
    // Let in, or turned down. The row stays until somebody deletes it, so the
    // same person is not asked twice.
    done: ["", "in", "no"].includes(raw.done) ? raw.done : "",
    // Which pile they are in while they wait. "other" when they did not say —
    // a stranger who skipped the question is not a stranger to leave off the
    // list.
    room: WAITROOMS.includes(raw.room) ? raw.room : "other",
  };
}

export function cleanPost(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  /* Line endings normalised on the way in. A post made through the operator's
     multipart route arrives with CRLF — that is what multipart does to a
     textarea — and everything downstream that looks for a blank line by
     matching "\n\n" quietly finds nothing. Stored text has one kind of
     newline in it. */
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  return {
    id,
    at: s(raw.at, 40) || new Date().toISOString(),
    state: STATES.includes(raw.state) ? raw.state : "held",
    // Who it goes out as. A handle rather than an account id, because there
    // are no accounts yet and a handle is the thing a reader sees either way.
    handle: s(raw.handle, 40).replace(/^@+/, ""),
    // The words. `note` in the app's own vocabulary, kept as `note` so the
    // admin panel and the migration read the same field name everywhere.
    note: s(raw.note, 2000),
    // The same sentence in three scripts, where somebody supplied them.
    zh: s(raw.zh, 2000), py: s(raw.py, 2000), en: s(raw.en, 2000),
    photo: /^[a-f0-9]{20}$/.test(String(raw.photo || "")) ? String(raw.photo) : "",
    clip: /^[a-f0-9]{20}$/.test(String(raw.clip || "")) ? String(raw.clip) : "",
    topic: s(raw.topic, 40),
    /* SHOWN OUTSIDE THE DOOR. One post at a time, set from the box and never
       from a page, because it moves something written for the people in here
       to a page anybody can read. See the note on featuring in post-feature.mjs
       for what may be featured and what needs asking first. */
    featured: raw.featured === true,
    /* Where a post invites the reader to go, from a list of two.
     *
     * A result posted to the feed is worth nothing to anybody reading it
     * unless they can do the thing it is a result of, and a URL typed into
     * words is a URL nobody taps. An allowlist rather than a path: this field
     * is written from a page, and a field written from a page that becomes a
     * link is how somebody sends the whole board somewhere else. */
    go: ["/type", "/level"].includes(String(raw.go || "")) ? String(raw.go) : "",
    // Where it was taken. Rounded to four decimals — about eleven metres —
    // before it is stored, which is enough to say "this restaurant" and not
    // enough to say "this table".
    lat: typeof raw.lat === "number" ? Math.round(raw.lat * 1e4) / 1e4 : null,
    lon: typeof raw.lon === "number" ? Math.round(raw.lon * 1e4) / 1e4 : null,
    // A reply points at a post; a like is a row whose whole content is the
    // pointer. A report is the third of these: a row saying somebody thinks
    // this should not be up, with their reason in `why`. All three are
    // ordinary posts, joined on these, so nothing here needs a second store.
    re: /^[a-f0-9]{20}$/.test(String(raw.re || "")) ? String(raw.re) : "",
    like: /^[a-f0-9]{20}$/.test(String(raw.like || "")) ? String(raw.like) : "",
    report: /^[a-f0-9]{20}$/.test(String(raw.report || "")) ? String(raw.report) : "",
    // Why it was held, refused or taken down — and on a report, why somebody
    // flagged it. Emptied on a published post, because a published post has no
    // reason to give; a report keeps its own, since the reason IS the report.
    why: (raw.state === "published" && !raw.report) ? "" : s(raw.why, 400),
    // Which device wrote it. A hash, never the id itself: it answers "is this
    // the same person again" without answering "who".
    by: s(raw.by, 64),

    /* Somebody joining the study-buddy list, announced on the board.
     *
     * The facts rather than a sentence, and that is the whole point. A post
     * saying "Marc is looking for a study buddy" would be in whichever
     * language this server was written in, for ever, for every reader — the
     * rule this codebase already keeps everywhere else is that prose chosen on
     * the server is prose in one language. So the post carries what is true
     * and the page writes the sentence, in whichever language it is being read
     * in. The person's own words stay their own words in `note`. */
    looking: Boolean(raw.looking),
    campus: s(raw.campus, 60),
    free: Array.isArray(raw.free)
      ? [...new Set(raw.free.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [],
  };
}

/** A device id, hashed before it touches disk. The browser makes up a random
 *  one; this makes sure the file never holds the form that came over the
 *  wire. */
export const hashDevice = (id, salt) =>
  id ? createHash("sha256").update(String(salt) + ":" + String(id)).digest("hex").slice(0, 32) : "";

/* ---------------------------------------------------------------------------
 * People
 *
 * A study-buddy profile. It is a different shape from a post and gets its own
 * list rather than being forced into one: a post is a thing somebody said, a
 * profile is a standing description of a person, and the two have almost no
 * fields in common.
 *
 * WHAT A PROFILE MAY NOT CARRY, and why it is enforced here rather than asked
 * for politely in the form.
 *
 * A searchable directory of foreign exchange students — many of them young,
 * newly arrived, and not yet reading the language — is a useful thing and also
 * exactly the shape of a targeting list. So a profile carries what MATCHES
 * somebody (level, what they are working towards, which days, what they will
 * trade, which campus) and nothing that FINDS them. No WeChat id, no phone, no
 * email, no address, no room number, no timetable.
 *
 * People swap those privately once both sides have decided they want to. That
 * is a decision made twice, by two people, off this server — which is the only
 * version of it that is theirs.
 *
 * The check below is a filter, not a wall: somebody determined will get a
 * WeChat id past it by spelling it out in words. It is here to stop the
 * ordinary case, which is not an attacker but a nineteen-year-old pasting
 * their number in because every other app asked them to.
 * ------------------------------------------------------------------------- */

/** Things that are somebody's way of being reached, in the forms people
 *  actually type them. Matched loosely on purpose — a false positive costs a
 *  sentence rewritten, a false negative costs a phone number on a public page. */
const CONTACT_SHAPED = [
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,                 // an email
  /(?:\+?86[\s-]?)?1[3-9]\d{9}/,                       // a mainland mobile
  /\+\d[\d\s().-]{7,}/,                                 // any international number
  // Split from the line below because \b is ASCII-only in JavaScript: it never
  // matches beside a Chinese character, so \b微信\b can never fire. Caught by
  // the test, not by reading — which is why the test exists.
  /\b(?:wechat|weixin|vx|wx|qq|whatsapp|line|kakao|telegram|tg|instagram|ig|snap(?:chat)?)\b\s*[:：]?\s*[\w.@_-]{3,}/i,
  /(?:微信|微信号|威信|扣扣|企鹅号)\s*[:：]?\s*[\w.@_-]{2,}/,
  /\b(?:my|add)\s*(?:wechat|weixin|vx|wx|qq)\b/i,
  /加\s*(?:微信|我|一下)/,
  /(?:^|\s)@[\w.]{3,}/,                                 // an @handle for somewhere else
  /\d{3,4}\s?(?:室|号楼|栋|单元)/,                        // a room or building number
];

/** Whether some text is asking to be contacted off the board. Returns the
 *  first thing that matched, so the person can be told which bit to change
 *  rather than being told "no" about the whole paragraph. */
export function contactShaped(text) {
  const t = String(text || "");
  for (const re of CONTACT_SHAPED) {
    const m = t.match(re);
    if (m) return m[0].trim().slice(0, 60);
  }
  return "";
}

/* An Instagram handle, out of whatever somebody pasted.
 *
 * instagram.com/them, @them, them, or the whole share URL with a query string
 * on the end — because what people actually put in a box like this is the link
 * their phone gave them when they pressed share. One field, four shapes, one
 * thing stored.
 *
 * Their own rules for a handle are letters, digits, full stops and
 * underscores, up to thirty. Anything else becomes nothing rather than an
 * error: this is an optional line on a profile, and a save that failed because
 * of it would cost somebody their name and their photograph as well.
 */
function igHandle(v) {
  let t = String(v ?? "").trim();
  if (!t) return "";
  const link = /(?:instagram\.com|instagr\.am)\/+([^/?#\s]+)/i.exec(t);
  /* A link carries a path and a query and the handle is one segment of it; a
     typed handle carries neither. Splitting both on whitespace would take the
     first word of "not a handle" and keep it, which is worse than keeping
     nothing — somebody would have a profile pointing at a stranger. */
  t = link ? link[1] : t.replace(/^@+/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : "";
}

/* A LinkedIn profile, out of whatever somebody pasted.
 *
 * WHY THIS FIELD AND NOT A GENERAL "WEBSITE". This board stopped being the
 * students board and became a place for people connecting in China, and the
 * thing a business contact wants to look up before answering is not an
 * Instagram grid. LinkedIn is the one identity people already publish on
 * purpose — real name, employer, history, findable by design — so putting it
 * here is somebody doing the thing LinkedIn is for, not leaking something.
 *
 * IT IS STILL A REAL DISCLOSURE and it is optional for that reason. A profile
 * here carries what matches somebody and nothing that finds them; a LinkedIn
 * is a find-me link, and the form says so before the box rather than after.
 *
 * linkedin.com/in/them, /in/them/, the whole share URL with a query on the
 * end, or just the slug. Their own rules for a vanity name are letters,
 * digits and hyphens, 3 to 100. Anything else becomes nothing rather than an
 * error, the same as igHandle: this is an optional line, and a save that
 * failed because of it would cost somebody their name and their photograph
 * as well.
 *
 * Company and school pages are not people, so only /in/ is taken.
 */
function inHandle(v) {
  let t = String(v ?? "").trim();
  if (!t) return "";
  const link = /(?:linkedin\.com|linkedin\.cn)\/+in\/+([^/?#\s]+)/i.exec(t);
  t = link ? link[1] : t.replace(/^@+/, "").replace(/\/+$/, "");
  return /^[A-Za-z0-9-]{3,100}$/.test(t) ? t : "";
}

/* ---------------------------------------------------------------------------
 * Invites
 *
 * A code is six characters somebody types on a phone, in a hurry, from a
 * WeChat message. So the alphabet has no O, no zero, no I and no one in it:
 * those are the four that get read back wrong, and a code that cannot be
 * mistyped is worth more than a code with two extra bits of entropy.
 *
 * 30^6 is about 730 million, and five tries an hour per browser makes walking
 * it hopeless. That is the whole security model, and it is enough for a board
 * whose contents are already public to read.
 *
 * One use. The row keeps the hash of the browser that spent it, so "already
 * used" can tell somebody whether it was them.
 * ------------------------------------------------------------------------- */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Six characters from that alphabet, uppercased, or "" if it is not one. */
export const cleanCode = (v) => {
  const t = String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length !== 6) return "";
  for (const ch of t) if (!CODE_ALPHABET.includes(ch)) return "";
  return t;
};

export function newCode() {
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export function cleanInvite(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = cleanCode(raw.code);
  if (!code) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  return {
    code,
    // Who it was given to, for the person handing them out. Never shown to the
    // person redeeming it — it is a note to self, not a name badge.
    who: s(raw.who, 40),
    at: s(raw.at, 40) || new Date().toISOString(),
    // Who it came from, when a member made it out of their own header rather
    // than the operator making it from the box. It is what lets the list read
    // as who brought whom.
    by: /^[a-f0-9]{32}$/.test(String(raw.by || "")) ? String(raw.by) : "",
    // The browser that spent it, and when. Empty until somebody does.
    usedBy: /^[a-f0-9]{32}$/.test(String(raw.usedBy || "")) ? String(raw.usedBy) : "",
    usedAt: s(raw.usedAt, 40),
    // Taken back without deleting the row, so the record of who had it stays.
    off: Boolean(raw.off),
  };
}

/** The levels offered. A closed list because it is what matching sorts on, and
 *  free text turns "HSK 4" into four spellings that never meet. */
export const LEVELS = ["Just starting", "HSK 1-2", "HSK 3", "HSK 4", "HSK 5", "HSK 6", "Beyond HSK"];

/* ---------------------------------------------------------------------------
 * What somebody is looking for, and who it pairs with
 *
 * ELEVEN BOXES, SEVEN PAIRINGS. A tick box on its own cannot decide a match,
 * because half of these do not pair with themselves: two investors are not a
 * match, an investor and somebody raising money are. So the table below is the
 * unit, not the box — and it is here, in one place, rather than being implied
 * by a name in a template somewhere.
 *
 * THEY ARE NOT KINDS OF PEOPLE. A first-year language student can be raising
 * money for something; somebody hiring can also want a study partner. That is
 * why a person may hold three of them and why the list is written as things
 * somebody wants this term rather than as categories somebody belongs to.
 *
 * WHY THREE AND NOT MORE. Not modesty about the form — arithmetic. Three picks
 * out of seven pairings means two people overlap somewhere about nine times in
 * ten, which is what makes the wall below cheap. Let somebody tick everything
 * and the overlap is certain, the wall stops meaning anything, and so does the
 * notification.
 */
/* ---------------------------------------------------------------------------
 * THE SENTENCE
 *
 * "I am a Director looking for an Agent."
 *
 * The rooms below came first and they encode two things at once: a topic and a
 * side. `talent` means "a model or creative looking for an agent" and `agent`
 * means "an agent or manager looking for people" — which is why their labels
 * are sentences rather than words, why there are thirteen of them when there
 * are really six topics, and why somebody joining has to read two long
 * descriptions of the same room and pick the one that is about them.
 *
 * Two dropdowns say the same thing and need no explaining, because the
 * sentence IS the rule: you come up for people who are what you are looking
 * for, and who are looking for what you are. Nobody has to learn what a room
 * is.
 *
 * SIDES ARE FOR READING, NOT FOR MATCHING. They group the list so it is
 * scannable — the people who make the work, then the people who back it or
 * take people on — and they decide nothing. A director looking for a writer is
 * two people on the same side and a perfectly good pair; a rule that forbade
 * it would be the model getting in the way of the truth.
 *
 * THE ROOM IS DERIVED, NEVER ASKED. A pair lands in the first room both halves
 * belong to, and everything downstream — the feed filter, the /r/ doors, the
 * matching table above — goes on working on rooms without knowing any of this
 * happened. That is the whole reason it is built this way round: the sentence
 * is a better question, not a different product.
 */
export const ROLES = {
  // The people who make the work.
  director:  { side: "make", rooms: ["talent"] },
  writer:    { side: "make", rooms: ["talent"] },
  performer: { side: "make", rooms: ["talent"] },
  crew:      { side: "make", rooms: ["talent", "job"] },
  founder:   { side: "make", rooms: ["raise", "cofound", "hire"] },
  /* THE FACTORY IS ON THE MAKING SIDE, and it is the half of this board
     with the most people behind it: somebody arrives in China looking for a
     manufacturer, and the manufacturer is looking for an agent or a
     distributor. That is the same shape as a director looking for an agent,
     so it is the same sentence and not a second product. It lands in the
     buy/sell rooms, which already existed. */
  maker:     { side: "make", rooms: ["sell", "buy"] },
  student:   { side: "make", rooms: ["job", "study", "lang"] },
  // The people who back it, or take people on.
  agent:     { side: "back", rooms: ["agent"] },
  producer:  { side: "back", rooms: ["agent", "talent"] },
  brand:     { side: "back", rooms: ["agent", "buy"] },
  investor:  { side: "back", rooms: ["invest"] },
  lawyer:    { side: "back", rooms: ["agent", "invest", "hire"] },
  recruiter: { side: "back", rooms: ["hire"] },
  // The other end of a factory: somebody buying, and somebody who moves it.
  buyer:       { side: "back", rooms: ["buy", "sell"] },
  distributor: { side: "back", rooms: ["buy", "sell"] },
};

export const ROLEKEYS = Object.keys(ROLES);

/** The room a sentence lands in: the first one both halves belong to, and
 *  "new" — the room for somebody who has just turned up — when they share
 *  none. Never asked for, never stored twice; see the note above. */
/** What a person's rooms are: derived from their sentences when they have
 *  any, and otherwise whatever they ticked before the sentence existed. One
 *  place, so a profile cannot end up with a sentence saying one thing and a
 *  room saying another. */
function roomsFor(raw) {
  const said = (Array.isArray(raw?.say) ? raw.say : [])
    .map((x) => roomOfPair(String(x?.me || ""), String(x?.want || "")))
    .filter(Boolean);
  if (said.length) return [...new Set(said)].slice(0, 3);
  return Array.isArray(raw?.rooms)
    ? [...new Set(raw.rooms.map((r) => String(r)).filter((r) => ROOMS.includes(r)))].slice(0, 3)
    : [];
}

export function roomOfPair(me, want) {
  const a = ROLES[me], b = ROLES[want];
  if (!a || !b) return "";
  for (const r of a.rooms) if (b.rooms.includes(r)) return r;
  // No overlap is not an error. "A student looking for an investor" is a real
  // sentence and the honest place to put it is the room for people who have
  // just arrived and do not fit anywhere yet.
  return a.rooms[0] || "new";
}

export const ROOMS = [
  "lang", "study", "new", "host", "job", "hire", "cofound", "raise", "invest",
  "buy", "sell", "talent", "agent",
];

/** Which box answers which. A room missing from here answers itself. */
const ANSWERS = { new: "host", host: "new", job: "hire", hire: "job",
                  raise: "invest", invest: "raise", buy: "sell", sell: "buy",
                  talent: "agent", agent: "talent" };

/** The room key somebody has to have ticked for this one to pair with it. */
export const answerTo = (room) => ANSWERS[room] || room;

/* WHERE, AND WHO THEY WANT. The board is one side of an exchange and the other
 * side is everywhere else, so this is two questions and not one: where you are
 * settles what you are to somebody else, and who you want settles what they
 * are to you. Both default to the answer that matches everybody, so a person
 * who never touches either is never excluded by them. */
export const WHERES = ["cn", "out"];
export const WANTS = ["cn", "out", "any"];

/** Whether each side is in the half of the world the other asked for. */
export const scopeFits = (a, b) =>
  (a.wants === "any" || a.wants === (b.where || "cn"))
  && (b.wants === "any" || b.wants === (a.where || "cn"));

/** Every room two people share, as pairs of what each of them ticked. */
export function sharedRooms(a, b) {
  const mine = new Set(Array.isArray(a?.rooms) ? a.rooms : []);
  const theirs = new Set(Array.isArray(b?.rooms) ? b.rooms : []);
  const out = [];
  for (const room of mine) {
    if (theirs.has(answerTo(room))) out.push({ mine: room, theirs: answerTo(room) });
  }
  return out;
}

/** Whether these two are a match at all: something shared, and both in the
 *  half of the world the other asked for. Following is not checked here — that
 *  is the caller's half, and it is the half that means consent. */
export const roomsMatch = (a, b) => sharedRooms(a, b).length > 0 && scopeFits(a, b);

/** A date-or-week keyed count, kept to the newest `keep` keys. Anything that
 *  is not a plain positive number under a plausible key is dropped: this
 *  object is written from a page. */
function dayCounts(raw, keep) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const rows = Object.entries(raw)
    .filter(([k, v]) => /^\d{4}-(?:\d{2}-\d{2}|W\d{2})$/.test(k)
      && Number.isFinite(Number(v)) && Number(v) > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-keep);
  const out = {};
  for (const [k, v] of rows) out[k] = Math.min(1e6, Math.round(Number(v)));
  return out;
}

export function cleanPerson(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  /* Line endings normalised on the way in. A post made through the operator's
     multipart route arrives with CRLF — that is what multipart does to a
     textarea — and everything downstream that looks for a blank line by
     matching "\n\n" quietly finds nothing. Stored text has one kind of
     newline in it. */
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  const days = Array.isArray(raw.free)
    ? [...new Set(raw.free.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [];
  return {
    id,
    at: s(raw.at, 40) || new Date().toISOString(),
    state: STATES.includes(raw.state) ? raw.state : "held",
    handle: s(raw.handle, 40).replace(/^@+/, ""),
    level: LEVELS.includes(raw.level) ? raw.level : LEVELS[0],
    // Where they study, as an area. Never a pin, never a live position: which
    // campus is useful for matching, where somebody is right now is not, and it
    // is the single most dangerous field a student app can have.
    campus: s(raw.campus, 60),
    // What they are working towards, in their own words. The thing somebody
    // reads to decide whether to ask.
    goal: s(raw.goal, 600),
    trade: s(raw.trade, 120),
    // Somewhere to be found that is not this board. See igHandle above for
    // what arrives in this box and what is kept out of it.
    ig: igHandle(raw.ig),
    // The other one people already publish on purpose. See inHandle above for
    // what arrives in this box and what is kept out of it.
    li: inHandle(raw.li),
    // Optional, and never asked for on the first screen. Digits only, and two
    // of them: a field that will take a sentence becomes one.
    age: String(raw.age ?? "").replace(/\D/g, "").slice(0, 2),
    // The type sort's four letters, if they chose to put them up. Checked
    // against the sixteen rather than stored as text: this field is written
    // from a page, and a field written from a page will one day be written
    // from something else.
    type: /^[EI][SN][TF][JP]$/.test(String(raw.type || "").toUpperCase())
      ? String(raw.type).toUpperCase() : "",
    // Where four questions put them. "ZH 6" or "EN 3", and nothing else —
    // written from a page, and a field written from a page will one day be
    // written from something else.
    levelBand: /^(ZH|EN) ([1-9]|10)$/.test(String(raw.levelBand || "").toUpperCase())
      ? String(raw.levelBand).toUpperCase() : "",
    speaks: Array.isArray(raw.speaks)
      ? raw.speaks.slice(0, 6).map((x) => s(x, 40)).filter(Boolean) : [],
    free: days,
    // How long they have been here — the one thing that says whether they are
    // asking or answering.
    here: s(raw.here, 40),
    // A face and a cover. Both optional, both ids into the media store, and
    // both held for a person the same way a post is: a photograph is the one
    // thing on a profile that cannot be taken back once somebody has saved it,
    // so it does not go public before somebody has looked.
    photo: /^[a-f0-9]{20}$/.test(String(raw.photo || "")) ? String(raw.photo) : "",
    cover: /^[a-f0-9]{20}$/.test(String(raw.cover || "")) ? String(raw.cover) : "",
    // Whether those two have been through the queue. Kept apart from `state`
    // because the words are useful long before the picture is: a profile can be
    // live and readable while its photograph is still waiting.
    photoState: STATES.includes(raw.photoState) ? raw.photoState : "held",
    /* HOW MANY PEOPLE OPENED THIS PAGE, AND HOW MANY CAME BACK.
     *
     * Two counters and NO READING HISTORY. `views` is a date to a number,
     * `regs` an ISO week to a number, and neither of them holds an identity —
     * so nothing here can answer "who looked at whose page", which is the
     * question this board has spent its whole life unable to answer and the
     * one worth far more to somebody else than it is to its owner.
     *
     * WHAT MAKES A DISTINCT COUNT POSSIBLE WITHOUT ONE. The reader's own
     * browser knows which pages it has opened and when — it already keeps
     * blocking that way. It reports at most one visit per page per day and at
     * most one "I have become a regular here" per page per week, so a bucket
     * counts PEOPLE rather than page loads without anybody's identity being
     * written down. The weekly reset is what keeps the regulars figure from
     * drifting upward for ever: somebody who stops coming back falls out of it
     * on their own.
     *
     * Thirty days and eight weeks. Enough for a sparkline and a comparison
     * with last week, and not a year of somebody's traffic sitting in a file.
     */
    views: dayCounts(raw.views, 30),
    regs: dayCounts(raw.regs, 8),
    /* EVERY LEVEL THEY HAVE HELD, AND WHEN. Eight of them, which is more weeks
     * than anybody will move in.
     *
     * It is here so that one thing can be said out loud each week — that
     * somebody's Chinese went from three to five — without the board keeping a
     * score of anybody. It is only ever written when they press "put this on my
     * page", so it describes a number they chose to make public, and it says
     * nothing about how often they open the app or what they answered. */
    bands: Array.isArray(raw.bands)
      ? raw.bands
        .filter((b) => b && /^(ZH|EN) ([1-9]|10)$/.test(String(b.band || "").toUpperCase()))
        .slice(-8)
        .map((b) => ({ band: String(b.band).toUpperCase(), at: String(b.at || "").slice(0, 40) }))
      : [],
    // Whether they want to be found. Off unless asked for: posting on the
    // board must not put somebody in a directory of students, and one tap
    // takes them back out. This is the difference between a board that has
    // profiles and a board that is a list of people.
    looking: raw.looking === true,
    /* What they are looking for. Three at most — see ROOMS above for why that
       number and not a bigger one. Unknown keys are dropped rather than
       refused: this field is written from a page, and a page written today is
       read by a copy of itself from six months ago. */
    /* THE SENTENCE, AND THE ROOMS IT LANDS IN.
     *
     * `say` is up to three "I am a X looking for a Y" pairs — the only thing
     * anybody is asked, and the first thing they are asked. `rooms` is derived
     * from them and kept in the record so that every part of this board that
     * already works on rooms — the feed filter, the /r/ doors, sharedRooms and
     * the matching table above — goes on working without knowing the question
     * changed.
     *
     * Somebody who joined before the sentence existed keeps the rooms they
     * ticked: `say` is empty for them, and the derivation leaves those rooms
     * alone rather than emptying a profile to prove a point. */
    say: (Array.isArray(raw.say) ? raw.say : [])
      .map((x) => ({ me: String(x?.me || ""), want: String(x?.want || "") }))
      .filter((x) => ROLES[x.me] && ROLES[x.want])
      .filter((x, i, all) =>
        all.findIndex((y) => y.me === x.me && y.want === x.want) === i)
      .slice(0, 3),
    rooms: roomsFor(raw),
    // Which side of the exchange they are standing on, and which side they
    // want. Both fall back to the answer that excludes nobody.
    where: WHERES.includes(raw.where) ? raw.where : "cn",
    wants: WANTS.includes(raw.wants) ? raw.wants : "any",
    why: (raw.state === "published") ? "" : s(raw.why, 400),
    by: s(raw.by, 64),
  };
}

/* One person following another.
 *
 * A row, not a field on either side: a list on the follower grows unbounded
 * and a list on the followed is a public roll-call of who is interested in
 * whom. Rows are cheap to add, cheap to remove, and cheap to count without
 * ever handing anybody the set.
 *
 * `by` is the follower's device hash, `who` is the followed person's id. The
 * asymmetry is deliberate: a follower has no profile necessarily, and should
 * not need one to read somebody. */
export function cleanFollow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by || "").slice(0, 64);
  const who = String(raw.who || "");
  if (!by || !/^[a-f0-9]{20}$/.test(who)) return null;
  return { by, who, at: String(raw.at || "").slice(0, 40) || new Date().toISOString() };
}

/** How many people follow this person. A count, never the set — who follows
 *  whom among foreign students is a social graph, and publishing one is a
 *  different product from the one this is. */
/* ---------------------------------------------------------------------------
 * Cards
 *
 * THIS IS THE ONE PLACE THE PROFILE RULE IS BROKEN, AND IT IS BROKEN ON
 * PURPOSE. Read the note above cleanPerson first: a profile carries what
 * matches somebody and nothing that finds them, because a directory of foreign
 * students with contact details on it is a targeting list. That rule stands.
 *
 * A card is the exception, and these are the walls around it:
 *
 *   - It is a list of its own, keyed by device hash. It is never part of a
 *     person, so no route that returns people can return it by accident.
 *   - It reaches one other person only when FOUR things are true: they follow
 *     each other, they share a room, the owner pressed give, and the reader is
 *     the person it was given to.
 *   - Giving can be taken back, which stops the next read. It cannot stop the
 *     last one. The screen says so before the button, not after.
 *
 * WHAT IT STILL COSTS, said plainly because the privacy page has to say it
 * too: the server now holds a WeChat id for everybody who fills one in, and
 * whoever runs the box can read the file. That was not true of this board
 * yesterday. It is the price of the feature and not a detail of it.
 * ------------------------------------------------------------------------- */

/** Somebody's own card. `by` is their device hash — the card belongs to a
 *  device, like a post does, because that is the only identity here. */
export function cleanCard(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by || "").slice(0, 64);
  if (!by) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  return {
    by,
    // A WeChat id is what people in China actually swap. Kept as typed, minus
    // the decoration a phone adds: people paste "微信：mei_2024" and mean the
    // second half of it.
    wechat: s(raw.wechat, 60).replace(/^\s*(?:wechat|weixin|vx|wx|微信号?|威信)\s*[:：]?\s*/i, "").trim(),
    // One line they write themselves. An email, a company, a website, when to
    // message them. Free text on purpose: a phone-number field on a board of
    // exchange students is a field worth not having.
    line: s(raw.line, 200),
    at: s(raw.at, 40) || new Date().toISOString(),
  };
}

/** One person handing their card to one other. `by` is the giver's device
 *  hash, `who` is the receiving person's id — the same shape as a follow, for
 *  the same reason: a row is cheap to add, cheap to revoke, and never a list
 *  hanging off either end of it. */
export function cleanGrant(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by || "").slice(0, 64);
  const who = String(raw.who || "");
  if (!by || !/^[a-f0-9]{20}$/.test(who)) return null;
  return {
    by, who,
    at: String(raw.at || "").slice(0, 40) || new Date().toISOString(),
    // Taken back rather than deleted, so "they had it and stopped" and "they
    // never had it" stay different things — the first one matters to a report.
    off: raw.off === true,
  };
}

/* ---------------------------------------------------------------------------
 * Leaving a conversation
 *
 * A private room is only safe if getting out of it is one press and needs no
 * explanation. This is that press: one row, written by the person leaving,
 * naming the person they are leaving. Either side may write one and it shuts
 * the thread for BOTH — a room one person cannot leave is not a room they
 * chose to be in.
 *
 * WHY IT IS A ROW AND NOT A DELETION. What was already said stays said; both
 * people keep what they have read, and a report about it still works. Leaving
 * ends the conversation, it does not erase the evidence of it, which is the
 * difference between leaving and covering something up.
 *
 * The person left is never told who pressed it. They see a closed thread,
 * which is the same thing they would see if the other person simply stopped —
 * and "she blocked you" is a sentence that starts arguments and protects
 * nobody. Same reason blocking is never sent to us at all.
 */
export function cleanShut(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by || "").slice(0, 64);
  const who = String(raw.who || "").slice(0, 64);
  if (!by || !who || by === who) return null;
  return { by, who, at: String(raw.at || "").slice(0, 40) || new Date().toISOString() };
}

export const followersOf = (follows, id) =>
  follows.reduce((n, f) => n + (f.who === id ? 1 : 0), 0);

/* ---------------------------------------------------------------------------
 * A note: one private message from one person to one other.
 *
 * WHY THIS EXISTS, AND WHY IT IS THE ONLY PLACE A CONTACT DETAIL IS ALLOWED
 *
 * The board strips WeChat ids, phone numbers and emails out of everything
 * public, and it is right to: anyone can read a board without posting, so a
 * public contact detail becomes a standing list of newly-arrived foreign
 * students that anybody can harvest and nobody can take back.
 *
 * But the study-buddy list is a list of people who want to be contacted, and
 * for weeks it had no way for anyone to do it. A directory you cannot act on
 * gives somebody nothing to come back for.
 *
 * A note is the narrow way through. It goes to exactly one person, it is never
 * on the board, and there is no thread to abuse: you send one, they either
 * answer with theirs or they never do, and after that the two of them are
 * talking on WeChat like everyone here already is. Nobody broadcasts anything,
 * and an exchange takes both of them agreeing.
 *
 * WHAT IS NOT DONE TO A NOTE, and it is worth being explicit
 *
 * It is not held for review, because a private message read by a moderator
 * before delivery is not a private message. It is not filtered for contact
 * details, because carrying one is the entire point.
 *
 * What holds instead is that a note is reportable by the person who received
 * it. Reporting hands the text to the queue — and that is the only way a note
 * is ever read by anybody but the two people concerned.
 * ------------------------------------------------------------------------- */
/* Somebody asking for a thing that is not built.
 *
 * The whole record is a device hash, a name for the thing, and when — no text,
 * because there is nothing here to say and a free-text field on a button is an
 * invitation to put something in it that then has to be moderated. */
export function cleanWant(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by ?? "").slice(0, 64);
  const want = String(raw.want ?? "").slice(0, 24);
  // A short allow-list rather than any string: this is written from a public
  // route, and an open field would make the counter a place to store text.
  if (!by || !["type", "card", "compare", "language"].includes(want)) return null;
  return { by, want, at: String(raw.at ?? "").slice(0, 40) || new Date().toISOString() };
}

/** How many separate people asked for each thing. */
export function wantCounts(wants) {
  const out = {};
  for (const w of wants || []) out[w.want] = (out[w.want] || 0) + 1;
  return out;
}

export function cleanNote(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  /* Line endings normalised on the way in. A post made through the operator's
     multipart route arrives with CRLF — that is what multipart does to a
     textarea — and everything downstream that looks for a blank line by
     matching "\n\n" quietly finds nothing. Stored text has one kind of
     newline in it. */
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  const by = s(raw.by, 64), to = s(raw.to, 64);
  // A note with nobody at one end of it is not a note.
  if (!by || !to || by === to) return null;
  return {
    id,
    at: s(raw.at, 40) || new Date().toISOString(),
    by, to,
    // Which post it answers, where there was one. A note can also come from a
    // profile, and then there is nothing to point at.
    re: /^[a-f0-9]{20}$/.test(String(raw.re || "")) ? String(raw.re) : "",
    // Short on purpose. It is an introduction and a way to reach somebody, not
    // a chat: the conversation is meant to leave here.
    text: s(raw.text, 600),
    // Read by the person it was sent to. Only ever set by them.
    seen: Boolean(raw.seen),
    // Somebody said this should not have been sent. Carries their words.
    report: s(raw.report, 400),
  };
}

/* ---------------------------------------------------------------------------
 * A group: three or more people who can all see each other's messages
 *
 * The one-to-one thread opens when two people match. A group is the same
 * mechanism widened, and the widening is the whole risk in it: a message that
 * reaches one person who chose you is an introduction, and the same message
 * reaching nine people who did not is a broadcast into somebody's phone.
 *
 * SO WHO CAN BE PUT IN ONE. Only people you have matched with — each of whom
 * followed you back and shares a room with you. Nobody can be added by a
 * stranger, nobody can be added by a friend of a friend, and there is no way
 * to be put in a group by somebody you have never agreed to hear from. That
 * one rule is what makes the rest of this safe, and it is why membership is
 * decided here from follows and rooms rather than from a list somebody sends.
 *
 * TEN, because past that it is a broadcast channel with a different set of
 * problems. Fern settled on the same number for the same reason.
 *
 * Everybody in a group can see every message in it and everybody who is in
 * it. Nobody can be removed by anybody else — the only exit is your own, and
 * taking it removes you from the list rather than deleting what you said, for
 * the same reason leaving a thread does not erase it.
 */
export const GROUP_MAX = 10;

export function cleanGroup(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  const by = s(raw.by, 64);
  if (!by) return null;
  /* Deduplicated and capped here rather than at the route, so a file edited by
     hand cannot produce a group of forty. The maker is always in it: a group
     you made and are not in is not a thing anybody means to make. */
  const members = [...new Set([by, ...(Array.isArray(raw.members) ? raw.members : [])
    .map((m) => String(m || "").slice(0, 64)).filter(Boolean)])].slice(0, GROUP_MAX);
  if (members.length < 2) return null;
  return {
    id,
    at: s(raw.at, 40) || new Date().toISOString(),
    by, members,
    // What it is called. Optional: a group of four people who matched on the
    // same room does not need naming to be useful, and an empty name draws
    // itself from who is in it.
    name: s(raw.name, 60),
  };
}

/** One message in a group. Kept apart from notes because the two have
 *  different shapes at the receiving end — a note has one reader and a group
 *  message has all of them — and because a bug that confused them would send a
 *  private message to nine people. */
export function cleanSay(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  const group = String(raw.group || "");
  if (!/^[a-f0-9]{20}$/.test(id) || !/^[a-f0-9]{20}$/.test(group)) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").slice(0, n);
  const by = s(raw.by, 64);
  if (!by) return null;
  return {
    id, group, by,
    at: s(raw.at, 40) || new Date().toISOString(),
    text: s(raw.text, 600),
    report: s(raw.report, 400),
  };
}

/** Notes for one person, both directions, newest first. */
export const notesFor = (notes, me) =>
  !me ? [] : notes.filter((n) => n.by === me || n.to === me)
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""));

/** How many they have sent today, for the cap. Counted rather than stored, so
 *  there is no second number to keep in step. */
export function sentToday(notes, me, now = new Date(), skip = null) {
  const day = now.toISOString().slice(0, 10);
  /* `skip` leaves out the people this is not counting — the ones already in an
     open conversation with. The cap is on INTRODUCTIONS: a busy afternoon with
     somebody who matched with you must not be what stops you introducing
     yourself to somebody new, and a hundred messages into one open thread must
     not read as a hundred approaches. */
  return notes.filter((n) => n.by === me && String(n.at).slice(0, 10) === day
    && !(skip && skip(n.to))).length;
}

export function cleanBoard(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.posts) ? raw.posts : [];
  const seen = new Set();
  const posts = [];
  for (const r of rows) {
    const p = cleanPost(r);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    posts.push(p);
  }
  posts.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  const seenP = new Set();
  const people = [];
  for (const r of (Array.isArray(raw?.people) ? raw.people : [])) {
    const q = cleanPerson(r);
    if (!q || seenP.has(q.id)) continue;
    seenP.add(q.id);
    people.push(q);
  }
  people.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  // Follows, deduplicated on the pair: pressing Follow twice is one follow.
  const seenF = new Set();
  const follows = [];
  for (const r of (Array.isArray(raw?.follows) ? raw.follows : [])) {
    const f = cleanFollow(r);
    if (!f) continue;
    const key = f.by + ":" + f.who;
    if (seenF.has(key)) continue;
    seenF.add(key);
    follows.push(f);
  }

  const seenN = new Set();
  const notes = [];
  for (const r of (Array.isArray(raw?.notes) ? raw.notes : [])) {
    const n = cleanNote(r);
    if (!n || seenN.has(n.id)) continue;
    seenN.add(n.id);
    notes.push(n);
  }
  notes.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  /* What somebody said they wanted, when it did not exist yet.
   *
   * One row per person per thing, not per press — the question is how many
   * people want it, and letting one enthusiast press four times answers a
   * different question badly. */
  const wants = [];
  const asked = new Set();
  for (const r of (Array.isArray(raw?.wants) ? raw.wants : [])) {
    const w = cleanWant(r);
    if (!w) continue;
    const key = w.by + ":" + w.want;
    if (asked.has(key)) continue;
    asked.add(key);
    wants.push(w);
  }

  /* The invites, one row per code. Deduplicated on the code itself: two rows
     for one code is a code that could be spent twice. */
  const invites = [];
  const codes = new Set();
  for (const r of (Array.isArray(raw?.invites) ? raw.invites : [])) {
    const v = cleanInvite(r);
    if (!v || codes.has(v.code)) continue;
    codes.add(v.code);
    invites.push(v);
  }

  /* Cards, one per device. Deduplicated on the owner rather than appended to:
     a second row for the same person is an older card that could still be
     handed out. */
  const cards = [];
  const owners = new Set();
  for (const r of (Array.isArray(raw?.cards) ? raw.cards : [])) {
    const c = cleanCard(r);
    if (!c || owners.has(c.by)) continue;
    owners.add(c.by);
    cards.push(c);
  }

  /* Who gave theirs to whom. Deduplicated on the pair, latest row winning, so
     give → take back → give again is one row saying what is true now. */
  const grants = [];
  const pairs = new Map();
  for (const r of (Array.isArray(raw?.grants) ? raw.grants : [])) {
    const g = cleanGrant(r);
    if (!g) continue;
    const key = g.by + ":" + g.who;
    if (pairs.has(key)) { grants[pairs.get(key)] = g; continue; }
    pairs.set(key, grants.length);
    grants.push(g);
  }

  /* Who is waiting outside. One row per person; the newest wins if somebody
     asks twice, so a second answer corrects the first rather than queueing
     behind it. */
  const waits = [];
  const asked2 = new Map();
  for (const r of (Array.isArray(raw?.waits) ? raw.waits : [])) {
    const w = cleanWait(r);
    if (!w) continue;
    const key = w.by || w.id;
    if (asked2.has(key)) { waits[asked2.get(key)] = w; continue; }
    asked2.set(key, waits.length);
    waits.push(w);
  }

  /* Who walked out of which conversation. One row per direction, first
     writing wins — leaving twice is leaving once, and the time on it is when
     they first went. */
  const shuts = [];
  const gone = new Set();
  for (const r of (Array.isArray(raw?.shuts) ? raw.shuts : [])) {
    const x = cleanShut(r);
    if (!x) continue;
    const key = x.by + ":" + x.who;
    if (gone.has(key)) continue;
    gone.add(key);
    shuts.push(x);
  }

  /* Groups, and what was said in them. Deduplicated on id like everything
     else; a message whose group is gone is dropped rather than kept as an
     orphan nobody can read or report. */
  const groups = [];
  const gids = new Set();
  for (const r of (Array.isArray(raw?.groups) ? raw.groups : [])) {
    const g = cleanGroup(r);
    if (!g || gids.has(g.id)) continue;
    gids.add(g.id);
    groups.push(g);
  }
  const says = [];
  const sids = new Set();
  for (const r of (Array.isArray(raw?.says) ? raw.says : [])) {
    const m = cleanSay(r);
    if (!m || sids.has(m.id) || !gids.has(m.group)) continue;
    sids.add(m.id);
    says.push(m);
  }

  return { posts, people, follows, notes, wants, invites, cards, grants, waits,
    shuts, groups, says };
}

/** Read, change, write — through a temporary file and a rename, so an
 *  interrupted save leaves the previous version rather than half of this one.
 *  Serialised by the caller; two writers racing is how a file becomes the
 *  older of two truths. */
export async function load(file) {
  try {
    return cleanBoard(JSON.parse(await readFile(file, "utf8")));
  } catch (err) {
    // Through cleanBoard rather than a literal, so a board that does not exist
    // yet has exactly the same shape as one that does. Returning { posts: [] }
    // here meant every caller reading board.people on a fresh install crashed —
    // and only on a fresh install, which is the worst time to find out.
    if (err.code === "ENOENT") return cleanBoard({});
    throw err;
  }
}

export async function save(file, board) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await writeFile(tmp, JSON.stringify(cleanBoard(board), null, 2) + "\n", "utf8");
  await rename(tmp, file);
}

/** What a post is, for a reader. A reply and a like are rows in the same list
 *  as posts; drawn as their own cards they fill a board with fragments and one
 *  busy post buries everything under its own likes. */
/** A post in its own right, rather than a row that points at one. Replies,
 *  likes and reports are all rows about somebody else's post. */
export const isOwnPost = (p) => !p.re && !p.like && !p.report;

/** A post's thread and its like count, assembled from the same list. */
export function threadFor(posts, id) {
  return {
    replies: posts.filter((p) => p.re === id && p.state === "published"),
    likes: posts.filter((p) => p.like === id).length,
  };
}

/** Who has reported a post, counted by device rather than by row.
 *
 *  By device because the number is used to decide whether to take something
 *  down, and one person pressing Report four times is one person's opinion.
 *  Counting rows would let anybody hide anything on their own. */
export function reportsFor(posts, id) {
  const who = new Set();
  const why = [];
  for (const p of posts) {
    if (p.report !== id) continue;
    if (p.by) who.add(p.by);
    if (p.why) why.push(p.why);
  }
  return { count: who.size, why };
}
