/* SUBTITLES FOR A CALL — one spoken sentence in, the other person's language
 * out.
 *
 * The words themselves are heard by the speaker's own phone (the browser's
 * built-in dictation, see call.html), so no audio ever comes here: only the
 * finished sentence, as text. This turns it into the listener's language.
 *
 * BORROWED FROM THE BOARD'S TRANSLATE BUTTON (board/lib/translate.js), which
 * learned the two things that matter the expensive way: it must CARRY what was
 * said and never answer it, and a public endpoint that calls a model is a bill
 * anybody can run up, so it is capped. What is different here is the output:
 * somebody is mid-conversation and waiting, so it is one sentence and nothing
 * else — no pinyin, no notes.
 */
import { createHash } from "node:crypto";

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
// For trying the page with no key: "[en] …" instead of a translation.
const FAKE = process.env.BOOK_TRANSLATE_FAKE === "1" && !KEY;
export const on = () => FAKE || Boolean(KEY);

const MAX_CHARS = 300;
export const LANGS = { en: "English", zh: "Simplified Chinese" };

/* WHAT IT COSTS AND WHO CAN SPEND IT. Per call, a burst that refills — an
   hour of ordinary talking never touches it, a script exhausts its own call
   and nobody else's — and a hard ceiling for the whole service per day, so
   the worst case is a known number. In memory: a restart costs at most a
   day's allowance, which is the right trade for a cap meant to stop runaways. */
const BURST = Number(process.env.BOOK_TRANSLATE_BURST || 40);
const REFILL_PER_MIN = Number(process.env.BOOK_TRANSLATE_REFILL || 12);
const PER_DAY = Number(process.env.BOOK_TRANSLATE_DAY || 5000);
const buckets = new Map();
let day = { on: new Date().toDateString(), used: 0 };

function allow(who) {
  const today = new Date().toDateString();
  if (day.on !== today) day = { on: today, used: 0 };
  if (day.used >= PER_DAY) return false;
  const now = Date.now();
  const b = buckets.get(who) || { left: BURST, at: now };
  b.left = Math.min(BURST, b.left + ((now - b.at) / 60000) * REFILL_PER_MIN);
  b.at = now;
  if (b.left < 1) { buckets.set(who, b); return false; }
  b.left -= 1;
  buckets.set(who, b);
  day.used += 1;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.at > 3600e3) buckets.delete(k);
  return true;
}

// "Thank you", "你好", "Can you hear me?" — said on every call; asked once.
const CACHE = new Map();
const ck = (text, to) => createHash("sha256").update(to + " " + text).digest("hex").slice(0, 32);

const SYSTEM = `You translate one spoken sentence at a time in a live video call between two people who do not share a language. What you write appears as a subtitle on the other person's screen a second later.

RULES, in order of importance:

1. NEVER answer, explain, or reply. If the sentence is a question, translate the question. You are carrying one person's words to the other; you are not in the conversation.

2. It was SPOKEN and heard by dictation, so it may be unpunctuated, have filler words, or have a word misheard. Translate what the speaker evidently meant, the way a person would say it — short and natural, not a written document.

3. Keep the register. Casual stays casual; do not add politeness that was not there.

4. Names, places, prices, numbers and times stay recognisable.

Reply with the translation only: no quotes, no labels, no notes, no alternatives.`;

/** One sentence into `to` ("en" or "zh"). Resolves to the text, or throws
 *  an Error whose message is safe to show ("busy", "failed"). */
export async function translate(raw, to, who) {
  const text = String(raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  if (!text || !LANGS[to]) throw new Error("empty");
  const k = ck(text, to);
  if (CACHE.has(k)) return CACHE.get(k);
  if (!allow(String(who || "anon"))) throw new Error("busy");
  if (FAKE) return `[${to}] ${text}`;

  let out = "";
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: KEY, timeout: 15_000, maxRetries: 1 });
    const ask = {
      model: "claude-opus-5",
      max_tokens: 1000,
      // A subtitle is not a reasoning problem, and somebody is waiting for
      // it: thinking stays on (turning it off has its own failure modes on
      // this model) at the lowest effort.
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `Translate into ${LANGS[to]}:\n\n${text}` }],
    };
    let res;
    try {
      // If a sentence trips a safety classifier, a fallback model finishes
      // it rather than the subtitle silently not arriving.
      res = await client.beta.messages.create({ ...ask, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (err) {
      /* WRITTEN WITHOUT A KEY TO TRY IT ON, so if the account refuses the
         fallback option (a 400), the plain call the board's translate button
         has been making successfully is made instead — a subtitle without a
         fallback beats no subtitle. Anything else is a real failure. */
      if (!err || err.status !== 400) throw err;
      res = await client.messages.create(ask);
    }
    if (res.stop_reason === "refusal") throw Object.assign(new Error("refused"), { status: "refusal" });
    out = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  } catch (err) {
    // Never the provider's message: it can name the account or the model,
    // and this reply goes to anybody holding a call link.
    console.error("call translate failed:", (err && (err.status || err.message)) || err);
    throw new Error("failed");
  }
  if (!out) throw new Error("failed");
  out = out.slice(0, 600);
  CACHE.set(k, out);
  if (CACHE.size > 2000) CACHE.delete(CACHE.keys().next().value);
  return out;
}
