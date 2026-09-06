// The five things Sage may do to The Feed's queue.
//
// ---------------------------------------------------------------------------
// Why these exist rather than a fetch tool
//
// This seat has no Bash and no WebFetch, and both of those absences are load
// bearing: a shell here prints ANTHROPIC_API_KEY out of the environment, and a
// general fetch is how anything read leaves. Removing either would give back
// the queue and take away the reason the seat is safe to share.
//
// So the queue arrives as five named operations instead. They are narrower
// than a fetch in every direction that matters: one host, decided here and not
// by the model; one credential, which never enters the conversation; and five
// verbs, none of which can be pointed at anything else. Sage cannot read a
// file it was not given, reach another service, or discover what else is on
// this box by trying.
//
// Without them the seat could say what was waiting and could not touch it —
// which is what it did, correctly and uselessly, the first evening it ran.
//
// ---------------------------------------------------------------------------
// What is NOT gated here
//
// Nothing. Moderating user content is this seat's job and the people on it are
// the moderators; asking for a password before every decision is how a queue
// stops being read. The publish word guards changes to the product, and the
// product cannot be changed from here at all.
//
// What the voice asks for instead is that Sage says what it is about to do
// before doing it, and never releases something nobody asked it to. That is a
// manner, not a permission, and it is written down as such.
// ---------------------------------------------------------------------------

import { z } from "zod";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

/** Ids come from the board and go back to it. Checked anyway: an id is
 *  interpolated into a URL, and the one thing never to trust with that is a
 *  string a model produced. */
const ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/, "not an id from this board");

const say = (text) => ({ content: [{ type: "text", text }] });

/** An upstream answer in the form the model should see. Errors are returned
 *  rather than thrown so Sage can report them, and so a board having a bad
 *  minute does not end the turn. */
function result(r, ok) {
  if (r.status >= 200 && r.status < 300) return say(ok);
  return say(`That did not work: ${r.body?.error || `the board said ${r.status}`}`);
}

/* The operations themselves, separate from the tool definitions that wrap
 * them.
 *
 * Split so they can be run in a test. The SDK folds tool definitions into an
 * MCP server instance and does not hand the handlers back, so logic written
 * inline in them is logic that can only be exercised by running a model —
 * which is a slow, expensive and non-deterministic way to find out whether a
 * URL was built correctly. */
export function ops(board) {
  return {
    async queue() {
      const r = await board.call("/api/public?queue=1");
      if (r.status < 200 || r.status >= 300) {
        return { error: r.body?.error || `the board said ${r.status}` };
      }
      const d = r.body || {};
      // Trimmed rather than passed through whole. The full rows carry device
      // hashes and every published post, and neither belongs in a
      // conversation: the hash is the one identifying thing this board holds,
      // and the live posts are not what was asked for.
      const slim = (p) => ({
        id: p.id, at: p.at, handle: p.handle, topic: p.topic || undefined,
        note: p.note || undefined, hasPhoto: Boolean(p.photo),
        reports: p.reports || undefined, reportedFor: p.reportedFor || undefined,
      });
      return {
        postsWaiting: (d.posts || []).map(slim),
        facesWaiting: (d.faces || []).map((q) => ({
          id: q.id, at: q.at, handle: q.handle,
          hasPhoto: Boolean(q.photo), hasCover: Boolean(q.cover),
        })),
        liveCount: (d.live || []).length,
        removedCount: (d.removed || []).length,
      };
    },
    releasePost: (id) =>
      board.call(`/api/feed/release?id=${encodeURIComponent(id)}`, { method: "POST" }),
    removePost: (id, why) =>
      board.call(`/api/feed?id=${encodeURIComponent(id)}&why=${encodeURIComponent(why)}`,
        { method: "DELETE" }),
    releasePhoto: (id) =>
      board.call(`/api/face/release?id=${encodeURIComponent(id)}`, { method: "POST" }),
    refusePhoto: (id, why) =>
      board.call(`/api/face?id=${encodeURIComponent(id)}&why=${encodeURIComponent(why)}`,
        { method: "DELETE" }),
  };
}

export function feedTools(board) {
  const op = ops(board);
  return createSdkMcpServer({
    name: "feed",
    version: "1.0.0",
    tools: [
      tool(
        "queue",
        "What is waiting to be read on The Feed: held posts, held profile "
        + "photographs, and anything people have reported. Read only.",
        {},
        async () => {
          const d = await op.queue();
          return d.error ? say(`Could not read the queue: ${d.error}`)
                         : say(JSON.stringify(d, null, 2));
        },
      ),

      tool(
        "release_post",
        "Put a held post in front of readers. Say what it says and why it is "
        + "fine before calling this: it cannot be undone quietly, because "
        + "people will have seen it.",
        { id: ID },
        async ({ id }) => result(await op.releasePost(id), "Released. It is on the board now."),
      ),

      tool(
        "remove_post",
        "Take a post down. Marked rather than deleted — 'was taken down' is a "
        + "different fact from 'never existed'. The reason is shown to the "
        + "person who wrote it, so write it to them.",
        { id: ID, why: z.string().max(400).describe("Shown to the author. Plain and specific.") },
        async ({ id, why }) =>
          result(await op.removePost(id, why), "Taken down. The author will see the reason."),
      ),

      tool(
        "release_photo",
        "Allow a profile photograph. Look at it first — this is the one thing "
        + "on the board that cannot be taken back once somebody has saved it.",
        { id: ID },
        async ({ id }) => result(await op.releasePhoto(id), "Released. It is on their profile now."),
      ),

      tool(
        "refuse_photo",
        "Refuse a profile photograph. The person stays and their words stay; "
        + "the picture is cleared and they can put up a different one.",
        { id: ID, why: z.string().max(400).describe("Shown to the person. Plain and specific.") },
        async ({ id, why }) =>
          result(await op.refusePhoto(id, why), "Refused. They can put up a different one."),
      ),
    ],
  });
}

/** The tool names as the harness will see them, for the allow list. */
export const FEED_TOOL_NAMES = [
  "mcp__feed__queue",
  "mcp__feed__release_post",
  "mcp__feed__remove_post",
  "mcp__feed__release_photo",
  "mcp__feed__refuse_photo",
];
