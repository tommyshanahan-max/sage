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

import { mkdir, readFile, writeFile, rename, readdir, unlink, access } from "node:fs/promises";
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
  /* A WAY TO BE REACHED, EXCEPT WHEN THERE ALREADY IS ONE.
   *
   * The form on the public page asks for one and the row is nothing without
   * it. A row that came from a written note is different: the member who
   * wrote it is already talking to them, in the app, and demanding an email
   * as well would be asking a stranger for a contact detail in order to
   * answer a message. So `fromWrite` stands in for it — see cleanWrite — and
   * the panel reads that row as "answer them where they replied". */
  const fromWrite = /^[a-f0-9]{20}$/.test(String(raw.fromWrite || ""))
    ? String(raw.fromWrite) : "";
  if (!name || (!reach && !fromWrite)) return null;
  return {
    id: /^[a-f0-9]{20}$/.test(String(raw.id || "")) ? String(raw.id) : newId(),
    name,
    // One way to be reached, in whatever shape they typed it. Not validated
    // into an email: half of the people this is for do not use one.
    reach,
    fromWrite,
    // Why they want in, in their own words. The only thing a member vouching
    // for a stranger has to go on.
    why: s(raw.why, 300),
    at: s(raw.at, 40) || new Date().toISOString(),
    // The browser that asked, so one person cannot fill the list on their own.
    by: s(raw.by, 64),
    // Let in, or turned down. The row stays until somebody deletes it, so the
    // same person is not asked twice.
    done: ["", "in", "no"].includes(raw.done) ? raw.done : "",
    /* THE WAITING ROOM — a stage between the list and the room itself.
     *
     * NOT A FOURTH `done`. `done` means the row is resolved and out of the
     * queue; somebody in the waiting room is still IN it and still has a place
     * in the order. They are simply being looked at.
     *
     * What it buys them: they can read the whole app and finish their own
     * page. What it does not: a single write. Every button answers "coming
     * soon" — see the gate in server.js. Whoever runs the board reads what
     * they filled in and decides.
     *
     * `upAt` is the day they were moved, and it is what the picker counts to
     * know whether today's three have gone up. No separate marker, so a
     * restart, a missed day or a hand-picked promotion all come out right. */
    up: raw.up === true,
    upAt: String(raw.upAt || "").slice(0, 40),
    // Which pile they are in while they wait. "other" when they did not say —
    // a stranger who skipped the question is not a stranger to leave off the
    // list.
    room: WAITROOMS.includes(raw.room) ? raw.room : "other",
    /* WHO SENT THEM. The id of the member whose link they followed, or "".
     *
     * A member has one invite code and it lets one person in, which is right
     * for the person they would vouch for by name and useless for the twenty
     * they would happily tell. This is the other half: a link they can post
     * anywhere, which puts whoever follows it in the queue rather than
     * through the door. Nobody gets in without somebody deciding.
     *
     * An id and not a name, because a name in an address is a name anybody
     * can type. It is checked against the roll before it is written — see
     * /api/wait — so a row either names a real member or names nobody.
     */
    via: /^[a-f0-9]{20}$/.test(String(raw.via || "")) ? String(raw.via) : "",

    /* WHETHER THEY AGREED TO BE SEEN, and nothing about them is shown to
     * anybody until they did.
     *
     * The form used to promise that one person read the list and no member
     * ever saw it. That promise was kept, and it is the reason the queue
     * could only ever be a queue: a member deciding whether to vouch for a
     * stranger had nothing to decide with, so nobody was ever brought in
     * without a private message from somebody who already knew them.
     *
     * The new form says the opposite in as many words — see wait.note. This
     * flag is what makes changing it honest. Only a row written after the
     * wording changed carries it, so everybody who answered the old question
     * stays exactly as invisible as they were promised, for ever, without
     * anybody having to remember which week they signed up in.
     *
     * NOT a default. An absent or untrue value is false, so a row that
     * arrives from anywhere but the current form is invisible — which is the
     * safe way for this particular field to fail.
     */
    shown: raw.shown === true,
    /* QUIET: SEEN BY MEMBERS, NOT BY THE QUEUE.
     *
     * `shown` is one switch over two different audiences — the people inside,
     * who can vouch, and the other people waiting, who cannot do anything
     * except read. That was fine while every door made the same promise. It
     * stopped being fine the day a page went out to a WeChat group of two
     * hundred agents: those are competitors, and a list of who else answered
     * is the one thing that would stop them answering.
     *
     * So this splits the audience rather than the promise. A quiet row is in
     * the members' queue, where somebody can vouch for it, and out of the list
     * the other waiting people see. The form that sets it says exactly that —
     * see wait.noteQuiet.
     *
     * TAKEN FROM THE REQUEST, unlike `shown`, and that is safe in the one
     * direction that matters: the only thing a browser can do by sending it is
     * make ITSELF less visible. There is nothing here to gain by lying. */
    quiet: raw.quiet === true,

    /* WHAT THEY FILLED IN WHILE THEY WAITED.
     *
     * The same three shapes a member's profile carries, checked the same way
     * and for the same reason — these are written from a page, and a field
     * written from a page will one day be written from something else. A
     * waiting row has no person behind it, so they live here rather than on
     * board.people, and they go when the row goes.
     */
    levelBand: /^(ZH|EN) ([1-9]|10)$/.test(String(raw.levelBand || "").toUpperCase())
      ? String(raw.levelBand).toUpperCase() : "",
    type: /^[EI][SN][TF][JP]$/.test(String(raw.type || "").toUpperCase())
      ? String(raw.type).toUpperCase() : "",
    /* What they are and what they are after: the two halves of the sentence
       this board is built on. Checked against the same ROLES table the
       profile form and the matching use, further down this file — so a
       waiting row can only ever hold a role that means something, and the
       words for it stay in i18n.js where the rest of the words are. */
    me: Object.hasOwn(ROLES, String(raw.me || "")) ? String(raw.me) : "",
    want: (Object.hasOwn(ROLES, String(raw.want || "")) || String(raw.want) === ANYONE)
      ? String(raw.want) : "",

    /* A FACE, AND IT WAITS.
     *
     * A member's photograph goes straight up — see REVIEW_PHOTOS in
     * server.js, and the reasoning there: a member was vouched for by name by
     * somebody whose own name stays on their page, so a face is presumed fine
     * until somebody says otherwise.
     *
     * NONE OF THAT IS TRUE OF SOMEBODY ON THE LIST. They arrived off a link,
     * nobody has vouched for them, and what they upload would go in front of
     * every member and everybody else waiting. So this one is held whatever
     * REVIEW_PHOTOS says, and released by hand from the queue in the panel,
     * where whoever runs the board is already looking at these people.
     *
     * They see their own photograph on their own card the whole time. What
     * waits is other people seeing it.
     */
    photo: /^[a-f0-9]{20}$/.test(String(raw.photo || "")) ? String(raw.photo) : "",
    photoState: ["held", "published", "refused"].includes(raw.photoState)
      ? raw.photoState : "held",

    /* WHOSE LINK THEY FOLLOWED, when it was somebody who is also waiting.
     *
     * `via` above holds a member's id and is the older half of this: a member
     * posts their link, whoever follows it lands in the queue with the member
     * named. This is the same idea one door further out — somebody on the
     * list sends the link too, and their row is what gets the credit.
     *
     * A SEPARATE FIELD RATHER THAN A SECOND MEANING FOR `via`. The two point
     * at different tables, a member's id and a wait row's id, and one field
     * that sometimes meant one and sometimes the other is a field every
     * reader has to guess about. It is checked against board.waits before it
     * is written — see /api/wait — so it either names a real row or nobody.
     */
    fromWait: /^[a-f0-9]{20}$/.test(String(raw.fromWait || "")) ? String(raw.fromWait) : "",
    /* A CODE THAT NAMES THIS ROW, for somebody whose browser has forgotten
       them. Rows are found by device hash and nothing else, so a cleared
       browser could not be reunited with its own card — filling the form
       again made a second row instead. This is the way back: minted by hand,
       spent once, and it carries them to their card rather than through the
       door. Same alphabet as an invite code, so it can be read down a phone
       and typed without ambiguity. */
    back: cleanCode(raw.back) || "",
  };
}

/** A NOTE WRITTEN TO SOMEBODY WHO IS NOT HERE YET.
 *
 * The board had two ways in: an invite code, which lets one person straight
 * through on a member's word, and a link anybody could post anywhere, which
 * put whoever followed it in the queue. The second arrived with nothing on it
 * — a name and a reason typed into a form by a stranger — so a member deciding
 * whether to vouch had nothing to read.
 *
 * This replaces it. A member writes one line to one person by name; the app
 * mints a code and prints a block to paste into WeChat; the person opens it,
 * reads what was written to them, and replies. The reply IS their place in the
 * queue — their words, answering a real question, addressed to somebody who
 * already knows them.
 *
 * It is not the invite and must not become it. An invite is somebody let in on
 * a member's word; this is somebody put in the queue, and they wait there until
 * a member vouches. Same alphabet and the same one-day clock, because both are
 * read down a phone and neither should work six months later out of a chat.
 */
export function cleanWrite(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, n);
  const code = cleanCode(raw.code) || "";
  if (!code) return null;
  return {
    id,
    code,
    // The member who wrote it, as the device hash everything else is keyed on.
    by: s(raw.by, 64),
    // What they called the person. The page says it back to them: "Ray — Tom
    // wrote to you" is a different thing arriving than "You have been invited".
    to: s(raw.to, 40),
    // The line itself. This is the whole pitch and the reason to answer.
    line: s(raw.line, 600),
    at: s(raw.at, 40) || new Date().toISOString(),
    till: s(raw.till, 40),
    /* SPENT ON ARRIVAL, like an invite. One person, once — a note that still
       works after it has been answered is a second stranger arriving under
       somebody else's name. */
    wait: /^[a-f0-9]{20}$/.test(String(raw.wait || "")) ? String(raw.wait) : "",
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

/** One member vouching for one person waiting.
 *
 *  `by` is the member's device hash — the same thing every other row here is
 *  keyed on — and `wait` is the row they are vouching for. Two of the same
 *  pair is one member changing their mind twice, not two vouches, so the
 *  loader keeps the first and drops the rest.
 */
export function cleanVouch(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = /^[a-f0-9]{32}$/.test(String(raw.by || "")) ? String(raw.by) : "";
  const wait = /^[a-f0-9]{20}$/.test(String(raw.wait || "")) ? String(raw.wait) : "";
  if (!by || !wait) return null;
  return { by, wait, at: String(raw.at ?? "").slice(0, 40) || new Date().toISOString() };
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
    /* WHAT KIND OF DOOR THIS IS.
     *
     * Empty is the ordinary one and stays the default: somebody joins, writes
     * their sentence, and is a member.
     *
     * "agent" is for somebody who arrives representing other people. Everybody
     * else on this board turns up as themselves; an agent turns up with nine
     * performers and a folder for each of them, and the first thing to show
     * them is not Browse — it is the console that takes the folder. So the
     * code carries what it is for, the door sets their sentence, and they land
     * on /onboard.
     *
     * It is on the INVITE and not on the person because it describes the
     * arrival, not the account: nothing here is a permission, and an agent is
     * an ordinary member whose sentence happens to say Agent. Anybody can
     * become one later by changing that sentence, and this is only about where
     * the door puts somebody down. */
    kind: raw.kind === "agent" ? "agent" : "",
    /* WHEN IT STOPS WORKING, IF IT EVER DOES.
     *
     * Empty is the old behaviour and stays the default: a code works until it
     * is spent or taken back. That is right for the one a member carries in
     * their own header, which they hand out when they happen to meet somebody.
     *
     * It is wrong for a code sent to one named person tonight. "This is good
     * for 24 hours" was being said to people and it was not true of anything —
     * the row had no way to stop, so the sentence depended on somebody
     * remembering to run `make invite-off` the next day. A promise that needs
     * a human alarm clock is a promise that gets broken.
     *
     * An ISO timestamp, checked at the door. A code that has run out is told
     * apart from a wrong one, because they are different things to the person
     * typing and only one of them is worth asking about. */
    until: /^\d{4}-\d{2}-\d{2}T/.test(String(raw.until || "")) ? String(raw.until) : "",
  };
}

/** Whether an invite has run out. Its own function because three places ask —
 *  the door, the list, and the member's own header — and a rule written three
 *  times is a rule that will one day disagree with itself. */
export function inviteOver(v, now = Date.now()) {
  return Boolean(v && v.until && Date.parse(v.until) <= now);
}

/* ---------------------------------------------------------------------------
 * A code sent to an address, and what is not kept about it
 *
 * The way back for somebody who never saved their key. They type the address
 * on their profile, six digits arrive, and the digits put their rows onto the
 * phone in their hand. One row per address while it is live, and the row goes
 * the moment it is spent.
 *
 * THE CODE IS STORED HASHED, with the same salt as everything else. A live
 * six-digit code sitting in board.json in the clear is a password file: anybody
 * who can read that file could sign in as anybody who happened to be halfway
 * through signing in. Hashed, reading the file tells them nothing they can use.
 *
 * `tries` is on the row and not in memory. Six digits is a million guesses if
 * you are patient and a thousand if you are not; a counter that a restart
 * resets is a counter somebody can reset. Five and the row is dead.
 * ------------------------------------------------------------------------- */
export function cleanSignin(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mail = String(raw.mail ?? "").trim().toLowerCase().slice(0, 120);
  const code = String(raw.code ?? "");
  // No address, no hashed code, no row. Both are the whole of it.
  if (!mail || !/^[a-f0-9]{32}$/.test(code)) return null;
  return {
    mail,
    code,
    at: String(raw.at ?? "").slice(0, 40) || new Date().toISOString(),
    tries: Math.max(0, Math.min(20, Number(raw.tries) || 0)),
  };
}

/* ---------------------------------------------------------------------------
 * An offer, and why it is a link rather than a screen
 *
 * Everything else on this board is for people who are already inside. An offer
 * is the one thing that has to work on somebody who is not — because the way
 * to fill a room like this is not to ask people to join it, it is to hand them
 * real work and let joining be what accepting costs.
 *
 * So an offer carries its own code and lives at its own address. It is sent
 * the way everything is sent here — pasted into WeChat — and it opens for
 * whoever taps it, member or stranger. There is no push in the mainland and
 * there is not going to be; a link into the app people already have open is
 * the delivery mechanism, not a workaround for the absence of one.
 *
 * ACCEPTING IT LETS YOU IN. That is the whole point and it is deliberate: the
 * offer is an invite with a reason attached. Somebody who accepts has both a
 * page and a first piece of work, which is a better start than an empty
 * profile in a room of strangers.
 *
 * WHAT IT IS NOT. Not a contract, not escrow, not a payment. Three lines in
 * the parties' own words and a date — what is offered, what it pays, what is
 * expected back. The board holds the record and judges none of it. Money moves
 * wherever these two would have moved it anyway.
 * ------------------------------------------------------------------------- */

export function cleanOffer(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = cleanCode(raw.code);
  const by = /^[a-f0-9]{32}$/.test(String(raw.by || "")) ? String(raw.by) : "";
  if (!code || !by) return null;
  const s = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, n);
  const give = s(raw.give, 300);
  if (!give) return null;
  return {
    code, by,
    /* WHAT KIND OF THING THIS IS, and it is only two.
     *
     * A job is a date and a number: two days in Shanghai, ¥6,400. A project is
     * a conversation that has to happen before either of those exists — a film
     * next spring, a band, a company. Both travel the same way and both are
     * accepted the same way; what differs is that a project may carry no money
     * yet, and that accepting one opens a few lines to settle it in.
     *
     * Two and not five. The moment this field has a taxonomy in it, somebody
     * has to keep the taxonomy, and the only thing the room does differently
     * is whether the money line is expected to be filled in. */
    kind: raw.kind === "project" ? "project" : "job",
    /* A note to self, so a list of sent offers reads as names rather than as
       codes. Never shown to the person opening it — they know who they are. */
    who: s(raw.who, 40),
    give,
    /* THE MONEY, AS TEXT AND NOT AS A NUMBER. "¥6,400 for the day", "¥700 an
       hour plus travel", "2% of the round" — the shapes people actually agree
       in. A number field would force every one of those into the one shape it
       understood, and the ledger would be tidier and wrong. */
    money: s(raw.money, 80),
    want: s(raw.want, 300),
    at: s(raw.at, 40) || new Date().toISOString(),
    /* Who took it, and when. The name is typed by them at the moment they
       accept — it is the signature, and it is why the record is worth more
       than the conversation that led to it. */
    tookBy: /^[a-f0-9]{32}$/.test(String(raw.tookBy || "")) ? String(raw.tookBy) : "",
    tookAt: s(raw.tookAt, 40),
    name: s(raw.name, 60),
    /* Withdrawn without deleting the row, so an offer that was sent and then
       pulled leaves a trace. An accepted one can never be withdrawn. */
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
    /* ANYONE IS NOT ONE ROOM, IT IS ALL OF THEIRS. Every other sentence lands
       in the one room both halves belong to. "A producer looking for anyone"
       has no other half to meet, so the honest reading is every room a
       producer stands in — which is what somebody open to anyone is asking
       for. flatMap rather than map for exactly this one case. */
    .flatMap((x) => {
      const me = String(x?.me || ""), want = String(x?.want || "");
      if (want === ANYONE) return ROLES[me] ? ROLES[me].rooms : [];
      return [roomOfPair(me, want)];
    })
    .filter(Boolean);
  if (said.length) return [...new Set(said)].slice(0, 3);
  return Array.isArray(raw?.rooms)
    ? [...new Set(raw.rooms.map((r) => String(r)).filter((r) => ROOMS.includes(r)))].slice(0, 3)
    : [];
}

/* THE OPEN ANSWER, and it is deliberately not in ROLES.
 *
 * "Anyone" is a thing you can be looking FOR and never a thing you can BE, so
 * it has no room list of its own and cannot appear on the left of a sentence.
 * Keeping it out of the table is what enforces that: every check that reads a
 * role from ROLES rejects it, and the three places that mean to allow it say
 * so by name.
 *
 * WHY IT EXISTS. The sentence made somebody name one role before they could
 * be matched at all, and plenty of people arrive without one — they want to
 * see who is here. Making them pick "an Investor" to get past the question is
 * how a form collects an answer nobody meant.
 */
export const ANYONE = "anyone";

export function roomOfPair(me, want) {
  // See roomsFor: this one is handled there, where all of their rooms are
  // available rather than one.
  if (want === ANYONE) return ROLES[me] ? (ROLES[me].rooms[0] || "new") : "";
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
    /* AN ADDRESS, AND IT IS NOT A CONTACT.
     *
     * The rule above this file's CONTACT_SHAPED list says a profile carries no
     * email, and that rule still holds: it is about what a profile SHOWS. A
     * searchable directory of people with their addresses beside them is a
     * targeting list, and this is not on the profile in that sense — it goes
     * out to nobody, ever. shownPerson drops it for every reader but the owner,
     * the same way it drops `views`, and no other route sends it anywhere.
     *
     * WHY IT EXISTS AT ALL, having gone this far without one. The identity here
     * is a random number the browser made up, and the key is that number shown.
     * It works, and most people will not save it: they do not know what a key
     * is, and they find out what it was for on the day they change phone and
     * everything they wrote is under a hash nobody can produce any more. This
     * is the way back for people who never saved anything — type the address,
     * read the code, be yourself again.
     *
     * IT IS OPTIONAL AND IT STAYS OPTIONAL. Nothing is gated on having one, the
     * key still works on its own, and `forget` takes this with the row.
     *
     * Lowercased because somebody signing in will type it differently from the
     * way they saved it, and an address that only matches its own capitalisation
     * is a locked door with the key in it. Shaped loosely — one @, a dot after
     * it — because the only real test of an address is whether mail arrives. */
    mail: (() => {
      const m = s(raw.mail, 120).trim().toLowerCase();
      return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(m) ? m : "";
    })(),
    /* A MEMBER'S OWN WAY BACK, the same field a waiting row already has.
     *
     * Everything a member is hangs off `by`, a hash of a random number in one
     * browser's storage. Clear that storage, change phone, or — the way this
     * came up — move the board to a new domain, and the person is a stranger
     * on their own board with no account to sign back into. The key is the
     * answer when they have it written down. Email is the answer when the row
     * carries an address and the box can send. When neither is true there was
     * nothing at all, and the first person that happened to was the operator.
     *
     * So: a six-character code the operator mints against one named row. It
     * opens nothing new — it moves an existing person onto the browser that
     * types it, which is the one thing they need and the only thing it can do.
     * Cleared the moment it is spent, because a code that keeps working is a
     * code that ends up in a group chat. */
    back: cleanCode(raw.back) || "",
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
    /* WHERE THE FACE IS IN THE FRAME, top to bottom, as a percentage.
     *
     * A card is a tall rectangle and a photograph is whatever shape the phone
     * took it in, so one of them gets cropped. Centred is the right default
     * and it is wrong for the commonest photograph there is — somebody
     * standing, head near the top — which comes out as a picture of a chest.
     *
     * 0 is the top of the photograph and 100 the bottom, which is what
     * object-position means, so the number goes straight into CSS with nothing
     * to convert and nothing to get backwards later.
     *
     * Vertical only. Faces end up too high or too low; almost nobody needs to
     * slide a portrait sideways, and a second axis is a second thing to
     * explain on a screen that should be one drag. */
    photoAt: (() => {
      const n = Math.round(Number(raw.photoAt));
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 50;
    })(),
    // Whether those two have been through the queue. Kept apart from `state`
    // because the words are useful long before the picture is: a profile can be
    // live and readable while its photograph is still waiting.
    photoState: STATES.includes(raw.photoState) ? raw.photoState : "held",
    /* THE OTHER PICTURES. A face is who you are and these are what you look
       like in work — a performer is cast off several, and the board was
       asking them to choose one.
       EACH CARRIES ITS OWN STATE rather than riding on the face's. A person
       whose headshot was approved is not a person whose next five uploads are
       approved, and making the face a key to the rest is how a reviewed board
       stops being one. */
    shots: (Array.isArray(raw.shots) ? raw.shots : [])
      .map((x) => {
        const id = String((x && x.id) || "");
        if (!/^[a-f0-9]{20}$/.test(id)) return null;
        return { id, state: STATES.includes(x.state) ? x.state : "held",
          at: String((x && x.at) || "").slice(0, 40) || new Date().toISOString() };
      })
      .filter(Boolean)
      .slice(0, SHOTS_MAX),
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
    /* MAY THIS PERSON MAKE AN OFFER.
     *
     * Set by whoever runs the board and by nothing else. It is read straight
     * off the stored row, and every save on this server runs the existing row
     * back through here — no route copies request fields onto a person
     * wholesale — so a member cannot grant it to themselves by posting it.
     *
     * It exists because reaching somebody with money attached is a different
     * power from being in the room, and the day it is automatic is the day an
     * agent nobody has vouched for can do it to forty performers. It becomes
     * an ordinary part of a matched card later; until then it is a short list
     * of people, decided one at a time.
     */
    canOffer: raw.canOffer === true,
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
      // "anyone" is allowed on the right and never on the left — see ANYONE.
      .filter((x) => ROLES[x.me] && (ROLES[x.want] || x.want === ANYONE))
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
    /* WHO SPEAKS FOR THIS PERSON, IF IT IS NOT THEM.
     *
     * `runBy` is the device hash of the agent who runs the row, and it is what
     * the server checks. `agent` is that agent's person id, and it is only for
     * saying so out loud — "Represented by Andy", on the card, before anybody
     * presses Follow. Two fields because one of them is a credential and the
     * other is a sentence, and the day they are the same field is the day
     * changing a display name changes who can log in as somebody.
     *
     * THE ROW STILL HAS ITS OWN `by`. That is the whole trick, and it is why
     * this is a small change to a server with `by === me` written through it
     * seventy-six times: a represented person is an ordinary person with an
     * ordinary identity, and the agent's browser is allowed to BE that
     * identity for the length of one request. Nothing downstream knows.
     *
     * WHICH MEANS THE DAY THEY WANT IT, IT IS ALREADY THEIRS. Clearing these
     * two fields and minting them a way back (see `back`) hands over the row,
     * the history, the matches and the conversations — the same account, not a
     * copy of it. An arrangement you cannot leave is not an arrangement.
     *
     * No chains: a row that is run cannot itself run anybody. Enforced where
     * rows are made rather than here, because this function cannot see the
     * board it is part of. */
    /* A CODE THAT SAYS "THIS PERSON IS MY CLIENT", and the person types it.
     *
     * /api/run/add mints rows for people who are not here. The other half —
     * somebody who already has an account and wants their agent to run it —
     * cannot work that way round, because the agent picking a handle off a
     * list would be an account takeover with a button on it: whoever holds
     * `runBy` posts as them and reads their cards.
     *
     * So it goes the way /api/run/hand already goes, which is the same rule
     * read the other direction: the press belongs to whoever holds the row
     * now. The agent mints six characters, reads them down a phone, and the
     * person types them into their own profile. `rep` is on the AGENT's row
     * and names the agent; `repTill` is when it stops working.
     *
     * Same alphabet as an invite, and minted against codesTaken with the rest
     * so no two codes at the door can mean two things. */
    rep: cleanCode(raw.rep) || "",
    repTill: s(raw.repTill, 40),
    runBy: s(raw.runBy, 64),
    agent: /^[a-f0-9]{20}$/.test(String(raw.agent || "")) ? String(raw.agent) : "",
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
    /* THEIR WECHAT CODE, AS A PICTURE, and it is the half that actually works.
     *
     * An id has to be typed into WeChat's search, and plenty of accounts are
     * not findable that way at all. A code is: save it to the photo roll, then
     * Scan · from album, which is how people in China add each other and the
     * only one of the two that works from inside WeChat's own browser, where
     * "open WeChat" has nothing to open.
     *
     * It is a media id, uploaded by its owner and never generated here — this
     * server has no way to make somebody's code and must not pretend to. It is
     * served from /api/public-media like a face, which means anybody holding
     * the id can fetch it; the id is only ever sent to somebody the owner gave
     * their card to, which is the same protection a photograph gets. */
    qr: /^[a-f0-9]{20}$/.test(String(raw.qr || "")) ? String(raw.qr) : "",
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
    /* ONE LINE, WRITTEN BY WHOEVER MOVED FIRST.
     *
     * A card arriving on its own says a name and an id and nothing about why.
     * The person handing it over is the one with a reason, and this is where
     * they say it — what they do, what they want, why this match. It travels
     * with the card and is read by exactly one person, so it is not a message
     * and it is not a thread: no reply, no second line, nothing to answer.
     *
     * It is a line about yourself, not to them. Kept short on purpose. */
    note: String(raw.note ?? "").replace(/\r\n?/g, "\n").slice(0, 200),
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

/* ONE PERSON NOT WANTING TO SEE ANOTHER.
 *
 * WHY THIS IS A ROW NOW AND WAS NOT BEFORE. The old block lived in
 * localStorage, and the comment above it in index.html gave a good reason:
 * "there are no accounts here, so a block cannot be a thing done TO somebody
 * — it is a thing done to your own copy of the board." That was true when it
 * was written. It is not any more: follows, cards, grants and shuts are all
 * keyed to a person, and `shuts` in particular already does exactly this shape
 * of thing on the server.
 *
 * AND THE BROWSER VERSION HAD STOPPED WORKING. It was only ever applied to
 * POSTS — one filter, in the feed's list — and the feed is off. Browse has
 * never consulted it. So the "also block them" checkbox under a report has
 * been writing to a set nothing reads, which is the worst state for a safety
 * control to be in: present, pressed, and doing nothing.
 *
 * NOT THE SAME AS A SHUT, and the difference is the whole design:
 *   shut   is MUTUAL and about one conversation. Either side ends it, neither
 *          can write again, and both of them know.
 *   block  is ONE WAY and about a person. They leave your Browse and they
 *          cannot write to you. You do not leave theirs, and they are never
 *          told — a block somebody is notified about is a block people are
 *          afraid to use.
 */
export function cleanBlock(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by || "").slice(0, 64);
  const who = String(raw.who || "");
  if (!by || !/^[a-f0-9]{20}$/.test(who)) return null;
  return { by, who, at: String(raw.at || "").slice(0, 40) || new Date().toISOString() };
}

/* A DEVICE THAT WANTS TO BE TOLD.
 *
 * One row per browser per member, not per member: the same person on a phone
 * and a laptop is two subscriptions and both should buzz. `by` is the device
 * hash every other row here is keyed on, so forgetting a member takes their
 * subscriptions with it and nothing else has to know.
 *
 * The endpoint is the primary key rather than the device, because that is what
 * the push service hands back as dead and it is what the browser changes
 * underneath us when it rotates one. Two rows with the same endpoint would be
 * two notifications for one phone.
 *
 * NOTHING HERE IDENTIFIES ANYBODY. A URL at Apple or Google and two keys the
 * browser made up. See lib/push.js for why no payload is ever sent to it.
 */
export function cleanPush(raw) {
  if (!raw || typeof raw !== "object") return null;
  const by = String(raw.by || "").slice(0, 64);
  const endpoint = String(raw.endpoint || "");
  if (!by || !/^https:\/\/[^\s]{10,500}$/.test(endpoint)) return null;
  const k = raw.keys && typeof raw.keys === "object" ? raw.keys : {};
  const p256dh = String(k.p256dh || "");
  const auth = String(k.auth || "");
  if (!/^[A-Za-z0-9\-_=]{20,200}$/.test(p256dh)) return null;
  if (!/^[A-Za-z0-9\-_=]{8,100}$/.test(auth)) return null;
  return { by, endpoint, keys: { p256dh, auth },
    at: String(raw.at || "").slice(0, 40) || new Date().toISOString() };
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
/* HOW MANY PEOPLE ONE LOGIN MAY SPEAK FOR, AND HOW MANY OF THEM THE ROOM SEES.
 *
 * An agent with exclusive talent will not put that talent somewhere a producer
 * can reach them directly — that is the leverage given away in one move — and
 * most of the talent will never sign up for themselves. So they get ordinary
 * rows and one person runs them. Nothing is forwarded and nothing is
 * redirected: the agent IS the party in every conversation and the performer
 * is the subject of it, which is what already happens when a producer wants
 * one of somebody's people.
 *
 * TWO DIFFERENT NUMBERS, because they protect two different things.
 *
 * RUN_MAX is a limit on the agent, and it is generous: somebody with forty
 * performers is exactly who this is for, and forty rows nobody browses cost
 * this box nothing.
 *
 * RUN_SHOW is a limit on the ROOM, and it is small. Browse is shared and
 * finite. One agent's roster could otherwise be most of what anybody sees,
 * which turns a board into a catalogue — and the people who would notice first
 * are the ones who joined because it was not one. Their own page shows all of
 * them: somebody who has found the agent has chosen to look.
 */
export const RUN_MAX = 40;

/* HOW MANY PICTURES ONE PERSON MAY PUT UP BESIDES THEIR FACE.
 *
 * Six, because a performer is cast off several looks and one headshot is a
 * weak card — and because six is where a page stops being a profile and starts
 * being a portfolio, which is a different product with a different moderation
 * bill. Every one of these goes through the same queue the face does. */
export const SHOTS_MAX = 6;
export const RUN_SHOW = 5;

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

/* THE DOOR TALLY.
 *
 * How many people opened a room door, how many began the form, how many
 * finished it — by day and by room, as three integers. That is the whole
 * record: no address, no device, no browser, no row per visit. It cannot
 * answer "who came" because nothing here is capable of storing a who, which
 * is the same rule the rest of this file follows and the reason the number
 * can be looked at without anybody's permission.
 *
 * Keyed "YYYY-MM-DD|room|what" so a day rolls off by deleting a prefix, and
 * so two servers writing the same key add rather than collide.
 */
const TALLY_WHAT = ["door", "form", "joined"];
export function cleanCounts(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    const m = /^(\d{4}-\d{2}-\d{2})\|([a-z]{1,10})\|([a-z]{1,10})$/.exec(String(k));
    if (!m || !TALLY_WHAT.includes(m[3])) continue;
    const n = Math.max(0, Math.min(10_000_000, Math.floor(Number(v) || 0)));
    if (n > 0) out[k] = n;
  }
  return out;
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

  /* A MEMBER SAYING THIS ONE IS WORTH LETTING IN.
     A row, not a field: one member, one waiting row, once. Cheap to add,
     cheap to take back, and it never leaves a list hanging off either end. */
  const vouches = [];
  const seenV = new Set();
  for (const r of (Array.isArray(raw?.vouches) ? raw.vouches : [])) {
    const v = cleanVouch(r);
    if (!v) continue;
    const k = v.by + ":" + v.wait;
    if (seenV.has(k)) continue;
    seenV.add(k);
    vouches.push(v);
  }
  /* WHICH ONE-TIME PASSES HAVE ALREADY RUN.
     A migration that says "runs once" and has no way of knowing whether it
     did runs on every boot, and one of them was quietly republishing every
     profile somebody had deliberately held. Writing the name down is what
     makes "once" true. */
  const ran = (Array.isArray(raw?.ran) ? raw.ran : [])
    .filter((x) => typeof x === "string" && x.length < 60).slice(0, 50);
  /* OUTSTANDING SIGN-IN CODES. One live row per address — asking again while
     one is out replaces it rather than adding a second, so the last code sent
     is the only one that works and an old mail is not a spare key. */
  const signins = [];
  const seenMail = new Set();
  for (const r of (Array.isArray(raw?.signins) ? raw.signins : [])) {
    const v = cleanSignin(r);
    if (!v || seenMail.has(v.mail)) continue;
    seenMail.add(v.mail);
    signins.push(v);
  }
  const offers = [];
  const seenOffer = new Set();
  for (const r of (Array.isArray(raw?.offers) ? raw.offers : [])) {
    const o = cleanOffer(r);
    // One row per code. A duplicate is a bad write, and the first one is the
    // one whose address has already been sent to somebody.
    if (!o || seenOffer.has(o.code)) continue;
    seenOffer.add(o.code);
    offers.push(o);
  }
  const seenW = new Set();
  const writes = [];
  for (const r of (Array.isArray(raw?.writes) ? raw.writes : [])) {
    const w = cleanWrite(r);
    if (!w || seenW.has(w.id)) continue;
    seenW.add(w.id);
    writes.push(w);
  }

  /* Deduplicated on the ENDPOINT and not on by+endpoint: a browser that
     re-subscribes after the member's row was rebound would otherwise leave two
     rows pointing at one phone, and that phone would buzz twice per message. */
  const blocks = [];
  const seenBlock = new Set();
  for (const r of (Array.isArray(raw?.blocks) ? raw.blocks : [])) {
    const x = cleanBlock(r);
    if (!x) continue;
    const k = x.by + "\u0000" + x.who;
    if (seenBlock.has(k)) continue;
    seenBlock.add(k);
    blocks.push(x);
  }

  const seenPush = new Set();
  const pushes = [];
  for (const r of (Array.isArray(raw?.pushes) ? raw.pushes : [])) {
    const x = cleanPush(r);
    if (!x || seenPush.has(x.endpoint)) continue;
    seenPush.add(x.endpoint);
    pushes.push(x);
  }

  return { posts, people, follows, notes, wants, invites, cards, grants, waits, vouches, ran,
    offers, shuts, groups, says, signins, writes, pushes, blocks,
    counts: cleanCounts(raw?.counts) };
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
  /* READ BEFORE THE RENAME, on the first write of a day only. What is on disk
     at this moment is the last state of yesterday, and the rename below is
     about to make it stop existing. */
  const keep = (await needsDay(file)) ? await readFile(file, "utf8").catch(() => "") : "";
  await rename(tmp, file);
  /* NEVER LET THE COPY BREAK THE SAVE. A full disk or a permission that
     changed must lose the snapshot, not the write everybody is waiting on. */
  if (keep) keepADay(file, keep).catch(() => {});
}

/* ---------------------------------------------------------------------------
 * ONE COPY A DAY, KEPT BESIDE THE FILE
 *
 * WHAT THIS IS FOR, and it is not disk failure. The volume is the box's
 * problem and a host-side tar is the answer to it — see `make save`. This is
 * for the other thing, which has already happened here once: code that runs
 * at boot and quietly rewrites rows. A migration republished every held
 * profile on every restart, three times, and undid the same piece of work
 * three times before anybody could tell what was doing it. There was nothing
 * to compare against, because the only copy of the file was the one being
 * rewritten.
 *
 * So: the first write of each day sets aside what was there before it. That
 * is the state at the end of the previous day, untouched by anything today's
 * boot has done to it — which is exactly the file you want when a change you
 * did not make appears overnight.
 *
 * THIRTY OF THEM. A month is long enough to notice something wrong, small
 * enough that a board.json of a few hundred kilobytes stays a few megabytes
 * of history. The oldest go first.
 *
 * The names are dates on purpose: `ls` in that directory is the answer to
 * "what did it look like on the 8th", with no tool to run and nothing to
 * unpack.
 */
const KEEP_DAYS = 30;
const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
const daysDir = (file) => path.join(path.dirname(file), "days");
const dayFile = (file, day) =>
  path.join(daysDir(file), path.basename(file, ".json") + "-" + day + ".json");

/** Whether today's copy is still to be made. Cheap enough to ask on every
 *  save: one stat, and it says no all day after the first write. */
async function needsDay(file) {
  try { await access(dayFile(file, dayOf())); return false; } catch { return true; }
}

async function keepADay(file, text) {
  const dir = daysDir(file);
  await mkdir(dir, { recursive: true });
  const at = dayFile(file, dayOf());
  const tmp = at + ".tmp";
  await writeFile(tmp, text, "utf8");
  await rename(tmp, at);
  /* Sorted by name, which for ISO dates is sorted by date. Failing to delete
     an old one is not worth failing the save that triggered this. */
  const base = path.basename(file, ".json") + "-";
  const all = (await readdir(dir))
    .filter((n) => n.startsWith(base) && n.endsWith(".json"))
    .sort();
  for (const n of all.slice(0, Math.max(0, all.length - KEEP_DAYS))) {
    await unlink(path.join(dir, n)).catch(() => {});
  }
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

/* ---------------------------------------------------------------------------
 * Deleting yourself
 *
 * WHY IT HAS TO EXIST. Apple has required it of anything with an account since
 * 2022, and it is the right of it anyway: a board that lets somebody in and
 * then cannot let them out is holding them. There are no accounts here — a
 * person IS a browser — but the rows on the server are just as real, and
 * clearing the browser leaves every one of them behind under a hash nobody can
 * produce any more, which is the worst of both.
 *
 * WHAT GOES. Everything keyed to them, in both directions: their profile and
 * face, their posts and replies and likes and reports, what they follow and
 * who follows them, cards, grants either way, every private message they wrote
 * AND every one written to them, the rooms they asked for, their sentence,
 * their group memberships.
 *
 * A message has two people in it and both copies go. That is deliberate:
 * asking to be deleted and being told half of what you wrote stays readable
 * by somebody else is not deletion. The person on the other side keeps
 * whatever they have already read, which is true of any message ever sent.
 *
 * WHAT STAYS, AND WHY. Two things, and neither is a profile:
 *
 *   The invite row. It is the record of the door — which code was spent and
 *   whether it can be spent again. Deleting it would hand back a used code and
 *   would let somebody who brought in a person who then hurt people erase that
 *   they brought them. The person is unlinked from it instead: the hash is
 *   replaced with a tombstone, so the row says a code was used and by nobody
 *   this board can name.
 *
 *   An accepted offer. Two people agreed terms, one of them is leaving, and
 *   the agreement was not only theirs. Same treatment — unlinked, not removed.
 *   An offer nobody took is not an agreement and goes.
 *
 * Media is NOT deleted here. This function takes a board and returns the ids
 * of the files that are now orphaned; deleting them is the caller's, because
 * this module does not touch the disk.
 */
export function forget(board, me) {
  if (!me) return { media: [], rows: 0 };
  const media = [];
  let rows = 0;

  /* ANYBODY THIS PERSON SPEAKS FOR GOES FIRST, and it has to be first: their
     rows carry their own `by`, so the pass below — which is entirely "is this
     row mine" — would walk straight past them and leave nine profiles, their
     photographs and their conversations sitting on the board under an identity
     no browser can produce. Forgetting that quietly keeps everything is worse
     than not offering it.
     Recursion is safe because a run row may not itself run anybody. */
  for (const by of [...new Set(board.people.filter((q) => q.runBy === me && q.by && q.by !== me).map((q) => q.by))]) {
    const out = forget(board, by);
    media.push(...out.media);
    rows += out.rows;
  }

  const mine = board.people.filter((q) => q.by === me);
  const ids = new Set(mine.map((q) => q.id));
  for (const q of mine) {
    if (q.photo) media.push(q.photo);
    if (q.cover) media.push(q.cover);
    /* And the gallery. Six files per person that would otherwise sit on the
       disk after the row naming them is gone — pictures of somebody who asked
       to be forgotten, kept because a loop two lines above only knew about two
       fields. */
    for (const sh of (q.shots || [])) if (sh.id) media.push(sh.id);
  }
  for (const c of board.cards) if (c.by === me && c.qr) media.push(c.qr);
  for (const p of board.posts) {
    if (p.by !== me) continue;
    if (p.photo) media.push(p.photo);
    if (p.clip) media.push(p.clip);
  }
  for (const w of board.waits) if (w.by === me && w.photo) media.push(w.photo);

  /* Rows are replaced rather than spliced, because half of them are
     deduplicated on load and a splice inside a loop over the same array is how
     one of them gets skipped. */
  const drop = (key, keep) => {
    const was = board[key].length;
    board[key] = board[key].filter(keep);
    rows += was - board[key].length;
  };

  /* The addresses go with the rows, and so does any code out to one of them.
     Taken before `people` is dropped, because after that there is nothing left
     here that knows what their address was. */
  const mails = new Set(mine.map((q) => q.mail).filter(Boolean));

  drop("people", (q) => q.by !== me);
  drop("posts", (p) => p.by !== me);
  if (mails.size) drop("signins", (v) => !mails.has(v.mail));
  // Both directions: what they follow, and everybody following the person they
  // were. An id in follows that names nobody is a follower count that lies.
  drop("follows", (f) => f.by !== me && !ids.has(f.who));
  drop("grants", (g) => g.by !== me && !ids.has(g.who));
  drop("shuts", (x) => x.by !== me && !ids.has(x.who));
  drop("cards", (c) => c.by !== me);
  drop("wants", (w) => w.by !== me);
  drop("says", (x) => x.by !== me);
  drop("notes", (n) => n.by !== me && n.to !== me);
  drop("waits", (w) => w.by !== me);
  drop("vouches", (v) => v.by !== me);
  /* THE PHONE STOPS BUZZING, AND THIS IS THE ONE THAT IS NOT A TIDY-UP.
     Every other line here removes a row nobody would see again. A push
     subscription left behind is an ACTION: the board goes on waking the phone
     of somebody who asked to be forgotten, for as long as the browser keeps
     the subscription. That is the promise this whole function exists to make,
     broken by the one table that reaches outward. */
  drop("pushes", (x) => x.by !== me);
  /* Both directions, like follows and grants above: the blocks this person
     made, and the ones naming them. A row pointing at somebody who no longer
     exists can never be acted on and never be undone. */
  drop("blocks", (x) => x.by !== me && !ids.has(x.who));
  /* And the notes they wrote to somebody who is not here. `to` is a waiting
     row rather than a person, so the notes drop above — which matches on a
     person's device hash — does not reach them. */
  drop("writes", (w) => w.by !== me);

  /* Only the groups this person was actually in. Filtering every group by its
     size would take out any group that was already below three for some other
     reason — somebody else's room, deleted by somebody else leaving. */
  const thin = new Set();
  for (const g of board.groups) {
    if (!Array.isArray(g.members) || !g.members.includes(me)) continue;
    g.members = g.members.filter((x) => x !== me);
    rows++;
    // A group needs three people to be a group. Two left holding it is a
    // private message with extra steps, and nobody chose to be in that.
    if (g.members.length < 3) thin.add(g.id);
  }
  drop("groups", (g) => !thin.has(g.id));

  // An offer nobody took is not an agreement.
  drop("offers", (o) => !(o.by === me && !o.tookAt));

  /* THE TWO THAT ARE UNLINKED RATHER THAN REMOVED. A tombstone that is the
     right shape for the field and can never be a real device hash, so nothing
     matches it and nothing crashes on it. */
  const GONE32 = "0".repeat(32);
  const GONE64 = "gone";
  for (const o of board.offers) {
    if (o.by === me) { o.by = GONE64; o.name = ""; rows++; }
    if (o.tookBy === me) { o.tookBy = GONE32; o.name = ""; rows++; }
  }
  for (const v of board.invites) {
    if (v.by === me) { v.by = GONE64; rows++; }
    if (v.usedBy === me) { v.usedBy = GONE64; rows++; }
  }

  return { media: [...new Set(media)].filter(Boolean), rows };
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

/** Move everything belonging to one browser onto another one.
 *
 * WHY THIS EXISTS. There are no accounts here: a person IS a browser, kept as
 * a salted hash of a random number that browser made up and stored. Safari
 * deletes that number for any site not visited in seven days. So somebody who
 * made a page, then did not open it for a week, comes back to a board that has
 * never heard of them — with their profile, their posts and their matches all
 * still on the server under a hash nobody can produce any more.
 *
 * The one thing that survives is the admission cookie: the server set it,
 * it is HttpOnly, it is signed, it lasts a year, and it holds that same hash.
 * A browser presenting a cookie for somebody who exists, alongside a device id
 * for somebody who does not, is that person on a browser that forgot. This
 * moves them onto the id it has now.
 *
 * IT IS A MOVE, NOT A COPY. Two rows keyed on the same person would be worse
 * than the problem: two profiles in Browse, a match that only answers on one
 * of them, a code counted twice. Every table that keys on a device hash is
 * listed here by name — if a new one is added and not added here, somebody's
 * rebind loses that part of them silently, which is the failure to watch for.
 *
 * Nothing is deleted and nothing changes hands: `to` must not already be
 * somebody, and the caller checks that `from` is.
 */
export function rebind(board, from, to) {
  if (!from || !to || from === to) return 0;
  let moved = 0;
  const swap = (row, key) => {
    if (row[key] === from) { row[key] = to; moved++; }
  };
  for (const q of board.people) swap(q, "by");
  /* AND THE ROSTER FOLLOWS THE AGENT. An agent who comes back on a new phone
     keeps their own row through the line above; without this one they keep it
     and lose the nine people they speak for, who are then rows no browser on
     earth can reach. Found once by `make back` on a row that ran nobody, which
     is to say not found at all — written from the shape rather than the bug. */
  for (const q of board.people) swap(q, "runBy");
  for (const p of board.posts) swap(p, "by");
  for (const f of board.follows) swap(f, "by");
  for (const g of board.grants) swap(g, "by");
  for (const s of board.shuts) swap(s, "by");
  for (const w of board.wants) swap(w, "by");
  for (const c of board.cards) swap(c, "by");
  for (const n of board.notes) { swap(n, "by"); swap(n, "to"); }
  for (const g of board.groups) {
    swap(g, "by");
    if (Array.isArray(g.members) && g.members.includes(from)) {
      g.members = [...new Set(g.members.map((m) => (m === from ? to : m)))];
      moved++;
    }
  }
  for (const s of board.says) swap(s, "by");
  /* Offers, both fields, for the reason the comment above this function gives:
     they were added to the board after rebind was written and were not added
     here, so somebody who came back on a second phone quietly lost every offer
     they had sent and every one they had accepted. */
  for (const o of board.offers) { swap(o, "by"); swap(o, "tookBy"); }
  /* The invite rows last, and both fields. `usedBy` is what admission is read
     from — miss it and somebody is restored to their profile and then shut out
     at the door. `by` is who they brought in, which is the credit on their
     page. */
  for (const v of board.invites) { swap(v, "by"); swap(v, "usedBy"); }
  return moved;
}
