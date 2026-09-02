// Speech, in both directions, for the agent app.
//
// The load-bearing constraint, carried over from journey's spec §20.1: the
// speech vendor never generates a word of its own. It is handed the exact text
// Sage already produced — no system prompt, no history, no context — and it
// hands back audio. On the way in it transcribes and returns text, which then
// goes through the ordinary chat route exactly as typed text would.
//
// That is what keeps spoken Sage and typed Sage the same Sage. Speaking and
// typing are one conversation arriving through two doors. If anyone ever gives
// this module a prompt, or swaps it for a conversational voice agent, that
// guarantee is gone and every rule in the system prompt would need checking
// against a second model.
//
// Voice is optional. With no key configured the app is unchanged and the
// microphone simply is not offered — a missing key must never look like a
// broken feature.

const TTS_MODEL = "eleven_turbo_v2_5";
const STT_MODEL = "scribe_v1";
// Rachel. Overridable, because whose voice this is is a matter of taste.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

// Long enough for a real reply, short enough that one runaway request cannot
// quietly spend a month of characters.
export const MAX_TTS_CHARS = 5000;
// Comfortably more than any spoken turn, and a ceiling on what one request
// can cost.
export const MAX_STT_BYTES = 25 * 1024 * 1024;

export const isSpeechConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY);

class SpeechError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// This server sits in Tokyo, so it reaches the vendor directly. That is the
// whole reason voice works here at all: the browser never talks to ElevenLabs,
// only to this host, over the one domain that is reachable.
async function eleven(path, init) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new SpeechError("voice is not configured", 503);
  const res = await fetch(`https://api.elevenlabs.io/v1/${path}`, {
    ...init,
    headers: { "xi-api-key": apiKey, ...(init.headers || {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SpeechError(`speech provider returned ${res.status}`, res.status, detail);
  }
  return res;
}

/** Text in, spoken audio out. The text is passed through untouched. */
export async function synthesize(text) {
  const speakable = String(text).slice(0, MAX_TTS_CHARS);
  const voiceId = process.env.AGENT_VOICE_ID || DEFAULT_VOICE;
  const res = await eleven(
    `text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: speakable,
        model_id: TTS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Recorded audio in, text out. Nothing is stored: the audio is forwarded,
 * transcribed, and dropped. Only the text continues, and it then travels the
 * same path a typed message would.
 */
export async function transcribe(audio, mimeType = "audio/webm") {
  const form = new FormData();
  form.append("model_id", STT_MODEL);
  // A filename is required by the API and is never persisted anywhere.
  form.append("file", new Blob([audio], { type: mimeType }), "speech.webm");
  const res = await eleven("speech-to-text", { method: "POST", body: form });
  const data = await res.json();
  return typeof data?.text === "string" ? data.text.trim() : "";
}
