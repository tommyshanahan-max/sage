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
import { randomUUID, createHash } from "node:crypto";
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
export function cleanPost(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  const s = (v, n) => String(v ?? "").slice(0, n);
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

/** The levels offered. A closed list because it is what matching sorts on, and
 *  free text turns "HSK 4" into four spellings that never meet. */
export const LEVELS = ["Just starting", "HSK 1-2", "HSK 3", "HSK 4", "HSK 5", "HSK 6", "Beyond HSK"];

export function cleanPerson(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "");
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  const s = (v, n) => String(v ?? "").slice(0, n);
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
    // Whether they want to be found. Off unless asked for: posting on the
    // board must not put somebody in a directory of students, and one tap
    // takes them back out. This is the difference between a board that has
    // profiles and a board that is a list of people.
    looking: raw.looking === true,
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
export const followersOf = (follows, id) =>
  follows.reduce((n, f) => n + (f.who === id ? 1 : 0), 0);

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

  return { posts, people, follows };
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
