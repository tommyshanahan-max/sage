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
  const known = new Set(out.people.map((p) => p.code));
  for (const s of posts) {
    if (!s || typeof s !== "object") continue;
    const body = String(s.body || "").slice(0, 2000);
    if (!body) continue;
    out.posts.push({
      id: String(s.id || "").slice(0, 40) || String(Date.now()) + Math.random().toString(36).slice(2, 7),
      body,
      kind: ["clip", "image", "text", "poster"].includes(s.kind) ? s.kind : "text",
      // A share addressed to somebody who has since been removed keeps the
      // code rather than the person: the link is already out there, and
      // pretending it was never sent loses the only record of it.
      to: known.has(String(s.to)) ? String(s.to) : "",
      points: String(s.points || "").slice(0, 80),
      // The uploaded file, if there is one. Checked against the shape this
      // server generates rather than kept as written: it goes into a URL, and
      // an id from a file somebody edited by hand is an id that could point
      // anywhere.
      media: /^[a-f0-9]{20}\.[a-z0-9]{2,4}$/.test(String(s.media || "")) ? String(s.media) : "",
      passedOn: Boolean(s.passedOn),
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
