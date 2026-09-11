/* Carry a sentence across, and never answer it.
 *
 * SHAPED AFTER THE BOARD'S TRANSLATOR, which is in board/lib/translate.js, and
 * different in the two ways that matter here.
 *
 *   The board translates for READING — somebody has tapped a post and wants to
 *   understand it, so pinyin and a note about an idiom earn their place. Ferry
 *   translates for TALKING: the other person is waiting, and anything beyond
 *   the sentence is noise in a conversation.
 *
 *   The board detects direction from the text. Ferry is told it. A room has
 *   two people who have each said which language they read, so guessing would
 *   be guessing at something already known — and a one-word reply like "ok" or
 *   a number has nothing in it to guess from.
 *
 * THE RULE THAT MATTERS MOST is the same one, because it is the way this fails
 * in public: a model behind a translate button starts helping. It explains the
 * phrase, offers three alternatives, or answers the question instead of
 * carrying it. Everything below is arranged around refusing that.
 *
 * WHAT IS AND IS NOT KEPT. The sentence is here for the length of one request.
 * It is not written to disk, not logged, and not stored beside the room — the
 * page encrypts the translation and posts it back like any other line. The
 * cache below holds translations in memory for a few minutes, which is the one
 * place text lingers, and it dies with the container.
 */

import { createHash } from "node:crypto";

const MAX_CHARS = 1200;
const KEY = (process.env.FERRY_KEY || process.env.ANTHROPIC_API_KEY || "").trim();
export const configured = () => Boolean(KEY);

/* WHAT THIS COSTS, AND WHO CAN SPEND IT. A private room among people who know
 * each other is not the same threat as a public board, so the burst is
 * generous — a real conversation is fast — and the day ceiling is what stops a
 * runaway rather than what rations anybody.
 *
 * Counted per room rather than per browser: the unit of use here is two people
 * talking, and a room that has gone mad is the thing worth stopping. */
const PER_ROOM_BURST = Number(process.env.FERRY_BURST || 60);
const REFILL_PER_MIN = Number(process.env.FERRY_REFILL || 20);
const PER_DAY = Number(process.env.FERRY_DAY || 4000);

const buckets = new Map();
let day = { on: new Date().toDateString(), used: 0 };

function allow(who) {
  const today = new Date().toDateString();
  if (day.on !== today) day = { on: today, used: 0 };
  if (day.used >= PER_DAY) return { ok: false, why: "day" };

  const now = Date.now();
  let b = buckets.get(who);
  if (!b) { b = { left: PER_ROOM_BURST, at: now }; buckets.set(who, b); }
  // Refilled by elapsed time rather than on a timer: nothing to leak, and a
  // room nobody comes back to costs nothing to remember.
  b.left = Math.min(PER_ROOM_BURST, b.left + ((now - b.at) / 60000) * REFILL_PER_MIN);
  b.at = now;
  if (b.left < 1) return { ok: false, why: "burst" };
  b.left -= 1;
  day.used += 1;
  if (buckets.size > 2000) {
    for (const [k, v] of buckets) if (now - v.at > 3600_000) buckets.delete(k);
  }
  return { ok: true };
}

/* THE SAME SENTENCE TWICE IS ONE CALL, and in a conversation that happens more
 * than it sounds: "ok", "thanks", "Thursday", a number, a name. Small and
 * short-lived on purpose — this is the one place a line of somebody's
 * conversation sits in memory, so it holds a few minutes' worth and no more. */
const CACHE = new Map();
const CACHE_MAX = 500;
const CACHE_MS = 5 * 60_000;
const keyFor = (text, to) =>
  createHash("sha256").update(to + " " + text).digest("hex").slice(0, 32);

const SYSTEM = `You translate single messages in a live conversation between two people doing business across a language barrier. You are a translator and nothing else.

RULES, in order of importance:

1. NEVER answer, explain, advise, or reply. If the message is a question, translate the question — do not answer it. If it asks for a recommendation, translate the request — do not recommend. Everything you produce is read by somebody trying to understand what THE OTHER PERSON said.

2. Return the sentence and nothing else. No pinyin, no notes, no alternatives, no brackets explaining a choice. Somebody is waiting for a reply.

3. Sound like a person talking, not a document. Render what a speaker would actually say. Casual stays casual, blunt stays blunt. Do not tidy up rudeness and do not add politeness that was not there.

4. Numbers, dates, names, company names and currency stay exactly as given. These messages are about money and a wrong number is worse than no translation.

5. If the message is already in the target language, return it unchanged.

Return ONLY the translated text. No quotes around it, no preamble.`;

/** Translate one message. Returns {text} or {error}. */
export async function translate(raw, opts = {}) {
  const text = String(raw || "").trim().slice(0, MAX_CHARS);
  if (!text) return { error: "empty" };
  if (!KEY) return { error: "unconfigured" };
  const to = opts.to === "zh" ? "zh" : "en";

  const ck = keyFor(text, to);
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return { text: hit.text, cached: true };

  const gate = allow(String(opts.room || "anon"));
  if (!gate.ok) return { error: gate.why === "day" ? "busy" : "slow-down" };

  let said;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: KEY });
    const res = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1200,
      // A translation is not a reasoning problem, and somebody is watching a
      // spinner. Thinking stays on at the lowest effort, which is the
      // documented way to spend less without the failure modes of turning it
      // off on this model.
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: "Translate into " + (to === "zh" ? "Chinese" : "English")
          + ". Carry it, never answer it.\n\n" + text,
      }],
    });
    said = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  } catch (err) {
    /* NEVER THE PROVIDER'S MESSAGE. It can name the model, the account or the
       reason, and this reply goes to whoever holds a room link. The status is
       enough to tell a person to wait a moment rather than to try again. */
    const status = err && err.status;
    if (status === 429) return { error: "slow-down" };
    console.error("translate failed:", status || "unknown");
    return { error: "failed" };
  }

  if (!said) return { error: "failed" };
  const out = String(said).slice(0, 4000);
  CACHE.set(ck, { text: out, at: Date.now() });
  if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  return { text: out };
}
