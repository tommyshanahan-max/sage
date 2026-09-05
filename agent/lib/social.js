// The people a project shares its work with, and what has gone to them.
//
// ---------------------------------------------------------------------------
// Where this lives, and why it is a file next to the code
//
// Same call as the reel's series.json: a project's relationships belong to the
// project, not to the platform. Study Pal's collaborators are Study Pal's, and
// a second project has its own — so this is social.json at the top of whichever
// directory is open, and copying that directory takes the relationships with
// it. Nothing here is global, and there is no database to migrate.
//
// ---------------------------------------------------------------------------
// What is real and what is waiting
//
// Three figures describe a collaborator: what was sent to them, what they
// passed on, and how many people arrived because of it.
//
//   - Sent is real. This file records it, because this is what sends it.
//   - Passed on is real, and is an observation rather than a measurement:
//     somebody ticks it when they see the reshare happen. That is honest — no
//     API tells you a WeChat forward occurred — and it is better than a figure
//     that looks automatic and is not.
//   - Arrived is not measured yet. It needs Study Pal to keep the ?via= code a
//     visitor lands with, which it does not do. See docs/for-studypal-via.md.
//     Until then the page says "not measured", never a zero: a zero here reads
//     as "nobody came", and the truth is "nobody counted".
// ---------------------------------------------------------------------------

/** A fresh, empty file. Written on the first save rather than at project
 *  creation, so a project that never uses this never grows the file. */
export const blank = () => ({ people: [], posts: [] });

/** Codes travel in a URL and are typed by people, so they are narrowed hard:
 *  lowercase, hyphens, nothing else, and short enough to read aloud over a
 *  phone. Anything outside that is not corrected, it is rejected — a code
 *  silently rewritten is a code that stops matching the link already sent. */
export const okCode = (s) => /^[a-z0-9][a-z0-9-]{0,31}$/.test(String(s || ""));

/** A code suggested from a name, for the common case where nobody cares what
 *  it is. Latin letters and digits only: a Chinese name transliterates to
 *  nothing here, and an empty code is worse than asking. */
export function codeFrom(name) {
  const slug = String(name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return okCode(slug) ? slug : "";
}

/** The link that carries who shared it and what it points at.
 *
 *  Both facts in one URL because the alternative is asking the reader where
 *  they heard about it, and WeChat strips referrers so there is nothing else
 *  left to ask. `to` is optional: a share can point at the front door. */
export function link(base, code, to) {
  const root = String(base || "").replace(/\/+$/, "");
  const q = new URLSearchParams({ via: code });
  if (to) q.set("to", to);
  return `${root}/?${q}`;
}

/** Read a stored file into the shape the page expects, dropping anything that
 *  is not what it claims to be.
 *
 *  This file is written by us and edited by hand often enough that a stray
 *  comma is a real case. A malformed entry costs its own row, never the page. */
export function clean(raw) {
  const out = blank();
  if (!raw || typeof raw !== "object") return out;

  const people = Array.isArray(raw.people) ? raw.people : [];
  for (const p of people) {
    if (!p || typeof p !== "object") continue;
    const code = String(p.code || "");
    if (!okCode(code)) continue;
    out.people.push({
      code,
      name: String(p.name || code).slice(0, 80),
      channel: String(p.channel || "").slice(0, 80),
      note: String(p.note || "").slice(0, 400),
      // Which of the page's colours they wear. Kept rather than derived from
      // the name, so somebody can change it and have it stay changed.
      tone: ["green", "red", "amber", "violet", "blue"].includes(p.tone) ? p.tone : "blue",
      addedAt: String(p.addedAt || ""),
    });
  }

  const posts = Array.isArray(raw.posts) ? raw.posts : [];
  for (const s of posts) {
    if (!s || typeof s !== "object") continue;
    const body = String(s.body || "").slice(0, 2000);
    if (!body) continue;
    out.posts.push({
      id: String(s.id || "").slice(0, 40) || String(Date.now()) + Math.random().toString(36).slice(2, 7),
      body,
      kind: ["clip", "image", "text", "poster"].includes(s.kind) ? s.kind : "text",
      // Who in the app it was for. An id from the app's own user list, kept
      // whatever that list says today: an account can be deleted over there
      // and the share still happened. The name is stored beside it for the
      // same reason — an id alone stops meaning anything the moment the
      // account it pointed at is gone.
      to: String(s.to || "").slice(0, 64),
      toName: String(s.toName || "").slice(0, 80),
      points: String(s.points || "").slice(0, 80),
      // The uploaded file, if there is one. Checked against the shape this
      // server generates rather than kept as written: it goes into a URL, and
      // an id from a file somebody edited by hand is an id that could point
      // anywhere.
      media: /^[a-f0-9]{20}\.[a-z0-9]{2,4}$/.test(String(s.media || "")) ? String(s.media) : "",
      // Which seat recorded it. Stamped by the server, never taken from the
      // page — see the note at the PUT route. Two people share this file now
      // and "who did this" stops being obvious the moment they both use it.
      by: String(s.by || "").slice(0, 40),
      // Which of the app's accounts it goes out as. A different question from
      // `by`: one is the person at the keyboard, the other is the name a
      // reader sees. Kept as the app's own id, with the name alongside so the
      // record still reads after somebody is renamed on that side.
      fromId: String(s.fromId || "").slice(0, 64),
      fromName: String(s.fromName || "").slice(0, 80),
      passedOn: Boolean(s.passedOn),
      // What the app called it, once it has it. Absent until the post is sent
      // and set only by the server that sent it — this is the id the webhook
      // reports against, so a page that could write it could make any post
      // claim to be any other.
      appId: String(s.appId || "").slice(0, 64),
      sentAt: String(s.sentAt || "").slice(0, 40),
      // Why the last attempt did not land. Kept rather than shown once and
      // forgotten: somebody comes back to a row hours later and the reason it
      // is still sitting there is the thing they need.
      sendNote: String(s.sendNote || "").slice(0, 300),
      at: String(s.at || ""),
    });
  }
  // Newest first, and undated last rather than first: an empty string sorts
  // before every date, which would put the least-known entries at the top.
  out.posts.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return out;
}

/** Sent / passed on, per person, from the posts themselves.
 *
 *  Derived rather than stored. Two counters updated on every write drift the
 *  first time one of them throws, and a relationship figure that is quietly
 *  wrong is worse than one computed each time it is read. */
export function tally(social) {
  const by = new Map(social.people.map((p) => [p.code, { sent: 0, passedOn: 0 }]));
  for (const s of social.posts) {
    const row = by.get(s.to);
    if (!row) continue;
    row.sent += 1;
    if (s.passedOn) row.passedOn += 1;
  }
  return by;
}

// ---------------------------------------------------------------------------
// The accounts a post can be shared from
//
// A separate file from the one above, and a separate idea. `people` was the
// forwarding model — outsiders who pass work along. These are the app's own
// accounts: the names a reader of Study Pal's feed sees above a post, and the
// one thing that varies about anything made in this panel.
//
// Why they are kept here at all, when the rule everywhere else is that the
// app's records belong to the app:
//
//   Study Pal serves no user list yet (docs/for-studypal-users.md). Without
//   one there is nothing to pick from, and a form whose only variable cannot
//   be set is not a form. So this is a roster of the accounts being operated,
//   written down on this side, and it is honest about being that — the panel
//   says "kept here", never "the app's users".
//
//   The day /api/users exists, the app's list is the truth: an account here
//   whose id the app also serves is confirmed against it, and one the app does
//   not know is shown as unconfirmed rather than quietly rendered the same.
//   Nothing has to be migrated for that, because the id is the join.
// ---------------------------------------------------------------------------

/** Wider than a share code: this has to hold ids the app minted as well as
 *  ones slugged from a name here, and an app is entitled to use uuids. */
export const okAccountId = (s) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(String(s || ""));

/** An id suggested from a name. "Wen Wen" becomes wen-wen; a name that is all
 *  Chinese characters becomes nothing, and an empty id is caught by the caller
 *  rather than papered over with a random one nobody can read. */
export function idFrom(name) {
  const slug = String(name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return okAccountId(slug) ? slug : "";
}

/** The roster as it is handed to the page, with anything malformed dropped.
 *
 *  Duplicate ids are dropped rather than rejected: two rows with one id means
 *  two posts that cannot be told apart afterwards, and the first one written
 *  is the one somebody has already been using. */
export function cleanAccounts(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.accounts) ? raw.accounts : [];
  const seen = new Set();
  const out = [];
  for (const a of rows) {
    if (!a || typeof a !== "object") continue;
    const id = String(a.id || "");
    if (!okAccountId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: String(a.name || id).slice(0, 80),
      // What the account is called in the app, if that differs from its
      // display name. Optional, and stored without a leading @ so two people
      // typing the same handle two ways do not get two accounts.
      handle: String(a.handle || "").replace(/^@+/, "").slice(0, 40),
      note: String(a.note || "").slice(0, 400),
      tone: ["green", "amber", "violet", "blue", "red"].includes(a.tone) ? a.tone : "blue",
      // Whether this account exists in the app, because this box put it there.
      // A third fact, and not the same as the merge with /api/users: that says
      // the app reports it today, this says we created it. Both can be true;
      // either alone is worth saying differently.
      inApp: Boolean(a.inApp),
      addedAt: String(a.addedAt || ""),
      // Which seat wrote it down. Stamped by the server for the same reason
      // `by` is on a post: two people share this file.
      addedBy: String(a.addedBy || "").slice(0, 40),
    });
  }
  return { accounts: out };
}

/** The roster a fresh install starts with.
 *
 *  Four names rather than an empty list, because an empty roster makes the one
 *  field that matters unusable on a box where nothing has been set up yet, and
 *  because these are the accounts actually being operated. Written on the first
 *  read and then ordinary data: renaming or removing one of these sticks, and
 *  nothing puts it back. */
export const seedAccounts = () => cleanAccounts({
  accounts: ["Tom", "Brendan", "Samantha", "Wen Wen"].map((name, i) => ({
    id: idFrom(name),
    name,
    tone: ["green", "amber", "violet", "blue"][i],
    addedAt: new Date().toISOString(),
    addedBy: "seed",
  })),
});

// ---------------------------------------------------------------------------
// What the app says happened
//
// The other direction. Everything above is what this panel wrote down; this is
// Study Pal reporting back — a post was published, held, or removed — over the
// webhook at /api/studypal-hook.
//
// Three events, and the middle one is the reason this exists:
//
//   published — it is live. Nothing to do.
//   held      — the app's own check would not pass it and would not fail it.
//               A person has to look. This is the only state that is work.
//   removed   — it is gone. Kept in the record rather than deleted, because
//               "was taken down" is a different fact from "never existed" and
//               the second is what deleting the row would say.
//
// Stored rather than derived, because nothing else on this box knows it: a
// post can be held by a check that runs on the other side minutes after it
// went out, and there is no reading of our own file that would reveal it.
// ---------------------------------------------------------------------------

export const EVENTS = ["published", "held", "removed"];

/** Wide enough for an id the app minted however it likes, narrow enough to be
 *  safe in a URL and a filename. */
const okPostId = (s) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(String(s || ""));

/** One report, from whatever shape the other side sends.
 *
 *  Field names are read from several spellings on purpose. This is another
 *  service's payload and the alternative to tolerating `text` where we expected
 *  `body` is a panel that renders a row of blanks and reports nothing wrong.
 *  Returns null when there is no usable id, since a report that cannot be
 *  matched to anything is not a report. */
export function cleanReport(raw) {
  if (!raw || typeof raw !== "object") return null;
  const post = (raw.post && typeof raw.post === "object") ? raw.post : raw;

  const id = String(post.id ?? post.postId ?? raw.id ?? "");
  if (!okPostId(id)) return null;

  const event = EVENTS.includes(String(raw.event || "")) ? String(raw.event) : "";
  if (!event) return null;

  // Every list below starts with the name this function writes, so a row read
  // back from the file keeps what it stored: cleanFeedback runs this over rows
  // that have already been through it, and the app's own spelling is long gone
  // from those.
  const pick = (...keys) => {
    for (const k of keys) {
      const v = post[k] ?? raw[k];
      if (v !== undefined && v !== null && v !== "") return String(v);
    }
    return "";
  };

  return {
    id,
    event,
    // When the app says it happened, not when we heard about it. A retry an
    // hour later is the same event, and stamping it on arrival would move it.
    at: String(raw.at || post.at || new Date().toISOString()).slice(0, 40),
    // Recorded separately, because the gap between the two is the only thing
    // that would show a webhook backing up. Kept when re-reading a stored row:
    // stamping it again on every read would make every report look like it had
    // just arrived, which is the opposite of what it is for.
    seenAt: String(raw.seenAt || post.seenAt || new Date().toISOString()).slice(0, 40),
    body: pick("body", "text", "caption", "content").slice(0, 2000),
    // An id at the app, fetched from its public-media endpoint. Kept as an
    // opaque string and encoded into a query parameter when used — never
    // pasted into a path, where a slash would change which URL is called.
    photo: pick("photo", "image", "media").slice(0, 200),
    fromId: pick("fromId", "userId", "user", "accountId", "author", "from").slice(0, 64),
    fromName: pick("fromName", "userName", "authorName", "name").slice(0, 80),
    // Why it was held, when the app says. The whole value of a held row is
    // knowing what to look at.
    reason: pick("reason", "note", "why", "detail").slice(0, 400),
    // Cleared by a person here, not by the app: this is our record of having
    // looked, and the app has no way to know we did.
    reviewed: Boolean(raw.reviewed),
    reviewedBy: String(raw.reviewedBy || "").slice(0, 40),
  };
}

/** The stored file, newest first, one row per post id.
 *
 *  Later reports win: held then published is a post that is now live, and
 *  keeping both would make the panel show a queue that never empties. The
 *  review mark survives that overwrite, because somebody did look. */
export function cleanFeedback(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.reports) ? raw.reports : [];
  const byId = new Map();
  for (const r of rows) {
    const row = cleanReport({ ...r, post: r });
    if (!row) continue;
    const was = byId.get(row.id);
    if (was && (was.at || "") > (row.at || "")) continue;
    byId.set(row.id, was ? { ...row, reviewed: was.reviewed || row.reviewed,
                             reviewedBy: was.reviewedBy || row.reviewedBy } : row);
  }
  const reports = [...byId.values()]
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return { reports };
}

/** Merge one new report into a stored file. Same rule as above, kept in one
 *  place so the webhook and a re-read of the file cannot disagree. */
export function withReport(stored, report) {
  const rows = (stored?.reports || []).filter((r) => r.id !== report.id);
  const was = (stored?.reports || []).find((r) => r.id === report.id);
  // A held row somebody already cleared, reported held again, is new work: the
  // app looked at it a second time and still would not pass it.
  const keepMark = was && was.event === report.event;
  rows.push(keepMark ? { ...report, reviewed: was.reviewed, reviewedBy: was.reviewedBy } : report);
  return cleanFeedback({ reports: rows });
}
