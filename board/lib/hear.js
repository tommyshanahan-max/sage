/* Hearing them, and why it is not the browser's own recogniser.
 *
 * WHAT WAS THERE BEFORE. window.SpeechRecognition, which is free, instant and
 * needs no key — and which does not work for the two groups of people this
 * board is actually for.
 *
 *   AN IPHONE ON THE HOME SCREEN. Added to the home screen, the app runs
 *   standalone, and in standalone webkitSpeechRecognition is DEFINED and does
 *   nothing. The API answers yes, the button appears, and every press fails.
 *   That is the worst shape a capability check can have: it lies.
 *
 *   THE MAINLAND. Chrome's recogniser is Google's, and Google is not
 *   reachable from inside China. Half of this board is in China. The button
 *   appeared there too and failed there too — speak.js has said so in its own
 *   header for months, which is the point at which it should have stopped
 *   being the mechanism.
 *
 * So the audio is recorded on the phone and transcribed HERE, on a box in
 * Tokyo, which both of those groups can reach. getUserMedia and MediaRecorder
 * work in a standalone iPhone app and work in China; it is only the
 * recogniser that does not.
 *
 * WHAT IT COSTS AND WHAT STOPS IT. Real money per second of audio, so: capped
 * per device, capped per day, capped per clip, and the key never leaves the
 * box. Same shape as lib/say.js next door, and the same key.
 */

const KEY = (process.env.ELEVENLABS_API_KEY || "").trim();
const MODEL = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";

export const configured = () => Boolean(KEY);

/* A minute of somebody talking into a chat box is already far more than
   anybody says to a doorman, and it is the ceiling on what one press can
   cost. Bytes rather than seconds because bytes are what arrives. */
const MAX_BYTES = Number(process.env.BOARD_HEAR_BYTES || 2_000_000);
const PER_DEVICE = Number(process.env.BOARD_HEAR_TURNS || 60);
const PER_DAY = Number(process.env.BOARD_HEAR_DAY || 800);

let day = { on: "", used: 0 };
const spent = new Map();
setInterval(() => spent.clear(), 6 * 3_600_000).unref?.();

function allow(who) {
  const today = new Date().toDateString();
  if (day.on !== today) day = { on: today, used: 0 };
  if (day.used >= PER_DAY) return { ok: false, why: "busy" };
  const mine = (spent.get(who) || 0) + 1;
  if (mine > PER_DEVICE) return { ok: false, why: "slow-down" };
  spent.set(who, mine);
  day.used += 1;
  return { ok: true };
}

/* What the phone actually recorded. Safari gives mp4, Chrome gives webm, and
   the extension has to match or the service guesses wrong. Anything else is
   refused rather than sent — an unknown container is a bug on the page, not a
   thing to spend money finding out about. */
const KINDS = {
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** One clip, transcribed.
 *
 *  @param {Buffer} audio
 *  @param {string} type   the recorder's own mime type
 *  @param {string} lang   "zh" or "en" — a hint, not a rule
 *  @param {string} who    the device, for the cap
 *  @returns {Promise<{text?: string, error?: string}>}
 */
export async function hear(audio, type, lang, who) {
  if (!KEY) return { error: "unconfigured" };
  if (!audio || !audio.length) return { error: "empty" };
  if (audio.length > MAX_BYTES) return { error: "long" };

  /* "audio/webm;codecs=opus" is what a recorder actually reports. */
  const base = String(type || "").split(";")[0].trim().toLowerCase();
  const ext = KINDS[base];
  if (!ext) return { error: "kind" };

  const gate = allow(who || "anon");
  if (!gate.ok) return { error: gate.why };

  try {
    const body = new FormData();
    body.append("file", new Blob([audio], { type: base }), "said." + ext);
    body.append("model_id", MODEL);
    /* NO LANGUAGE PINNED, AND THAT IS DELIBERATE.
     *
     * The obvious thing is to pass whichever language the page is set to. It
     * is also wrong, and wrong in the way that matters here: on a board where
     * half the people work across a border, the language somebody is READING
     * the app in says very little about the language they will speak into
     * their phone. Somebody with the English toggle on says a sentence in
     * Chinese constantly; that is the whole point of the place.
     *
     * Pinned to the wrong one, the transcriber does not shrug — it produces
     * confident nonsense, and the person watches their own words come back as
     * somebody else's. Left to detect, it gets code-switching right too, which
     * is most of what actually gets said around here.
     *
     * `lang` is still taken so the caller need not know that; it is the
     * fallback in lib/say.js on the way back out, where the LINE decides.
     */
    /* Nobody is diarising a single person talking into their own phone, and
       it is slower. */
    body.append("diarize", "false");

    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": KEY },
      body,
      /* They are holding a phone waiting to see their words. Past fifteen
         seconds they have pressed it again. */
      signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
    });
    if (!r.ok) {
      let said = "";
      try { said = (await r.text()).slice(0, 300); } catch { /* no body */ }
      /* Never the key, only the reason — the same rule as the butler's log.
         Said in full because a wrong field name in the form above looks
         exactly like a bad key from the outside, and guessing which cost an
         evening the last time. */
      console.error(`hear: ${r.status} ${said.replace(/\s+/g, " ")}`);
      return { error: r.status === 429 ? "slow-down" : "failed" };
    }
    const out = await r.json();
    const text = String((out && out.text) || "").trim();
    if (!text) {
      console.error(`hear: nothing came back, keys were ${Object.keys(out || {}).join(", ")}`);
      return { error: "quiet" };
    }
    console.error(`hear: ok ${audio.length} bytes ${ext} -> ${text.length} chars`);
    return { text };
  } catch (e) {
    console.error(`hear: ${String((e && e.message) || e).slice(0, 200)}`);
    return { error: "failed" };
  }
}
