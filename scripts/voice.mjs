#!/usr/bin/env node
/* The arrival's voice, rendered once.
 *
 * WHY THIS IS A SCRIPT AND NOT A ROUTE. The four beats are a fixed script —
 * no name in them, no number, nothing that varies by who is arriving (see the
 * note on wel.b1Up in i18n.js, which is why the name came out). Fixed text
 * means the audio is a constant, and a constant belongs in the repository
 * next to the string it speaks, not behind a network call somebody waits on
 * while standing at a door. Rendered here, committed, and served as a file:
 * the box never holds a TTS key, the arrival never waits on an API, and a
 * visit costs nothing.
 *
 * WHY NOT THE BROWSER'S OWN VOICE. It was, and it was cut. On an iPhone the
 * browser gives you a Siri voice and it sounds like somebody; on Chrome on a
 * Mac the ceiling is Google's network voice, which is a lift announcing a
 * floor. The first thing this place says to a person cannot be a coin toss on
 * which browser they opened it in.
 *
 * WHAT IT WRITES, per beat and language, into board/public/voice/:
 *   <key>.<lang>.mp3    the audio
 *   <key>.<lang>.json   {"dur": seconds, "at": [start time of each unit]}
 *
 * The JSON is what makes the words light up ON the voice rather than near it.
 * ElevenLabs hands back a start time per character; this turns that into one
 * start time per unit, cut by the same beatUnits() the page uses — see
 * board/public/beat.js for why that function is shared rather than copied.
 *
 *   node scripts/voice.mjs --list          what voices the account has
 *   node scripts/voice.mjs                 render every beat
 *   node scripts/voice.mjs --force         re-render ones already on disk
 *
 * ELEVENLABS_API_KEY in .env. ELEVENLABS_VOICE_ID to choose the voice; run
 * --list first and pick one, because the default is a stock preset and the
 * voice IS the first impression.
 */

import { writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STRINGS } from "../board/public/i18n.js";
import { beatUnits } from "../board/public/beat.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "board", "public", "voice");

const KEY = process.env.ELEVENLABS_API_KEY || "";
/* Stock ElevenLabs preset, available on every account. Warm, male, unhurried
   — a doorman rather than an announcement. Override it once you have listened
   to a few: this is the whole of the first impression. */
const VOICE = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
/* One model for both languages. The alternative is a second voice for the
   Chinese, and two different people greeting you depending on which button
   you pressed is worse than one accent. */
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

const BEATS = ["wel.b1List", "wel.b2List", "wel.b1Up", "wel.b2Up"];
const LANGS = [["en", 0], ["zh", 1]];

const api = (p) => "https://api.elevenlabs.io/v1" + p;

/** Say what actually came back. A TTS script that fails with "Error: 401" and
 *  nothing else is a script somebody debugs by guessing. */
async function fail(what, r) {
  let body = "";
  try { body = (await r.text()).slice(0, 400); } catch { /* no body */ }
  console.error(`\n  ${what} failed — HTTP ${r.status}`);
  if (body) console.error("  " + body.replace(/\n/g, "\n  "));
  if (r.status === 401) console.error("\n  That is the key. Check ELEVENLABS_API_KEY in .env.");
  if (r.status === 404) console.error("\n  That is the voice id. Run with --list to see yours.");
  if (r.status === 429) console.error("\n  Out of quota for now.");
  process.exit(1);
}

async function list() {
  const r = await fetch(api("/voices"), { headers: { "xi-api-key": KEY } });
  if (!r.ok) await fail("Listing voices", r);
  const { voices = [] } = await r.json();
  console.log(`\n  ${voices.length} voices on this account\n`);
  for (const v of voices) {
    const tag = [v.labels?.gender, v.labels?.accent, v.labels?.description]
      .filter(Boolean).join(", ");
    console.log("  " + String(v.voice_id).padEnd(24) + String(v.name).padEnd(18) + tag);
  }
  console.log("\n  Pick one and put it in .env:  ELEVENLABS_VOICE_ID=...\n");
}

/** One start time per unit, from ElevenLabs' one per character.
 *
 *  Returns null when the alignment does not line up with the text we sent —
 *  better a silent fall back to the page's own timed reveal than words
 *  lighting on the wrong sounds, which reads as broken rather than as absent.
 */
function unitTimes(text, alignment) {
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || chars.length !== starts.length) return null;
  /* The characters come back as an array of single characters; joined, they
     have to be the text we sent, or the indices mean nothing. */
  if (chars.join("") !== text) return null;

  const at = beatUnits(text).map((u) => {
    const t = starts[u.at];
    return typeof t === "number" ? Math.round(t * 1000) / 1000 : 0;
  });
  const dur = Array.isArray(ends) && ends.length ? ends[ends.length - 1] : 0;
  return { dur: Math.round(dur * 1000) / 1000, at };
}

async function say(key, lang, text) {
  const stem = path.join(OUT, `${key}.${lang}`);
  if (!process.argv.includes("--force")) {
    try {
      await access(stem + ".mp3");
      console.log(`  ${key}.${lang}  already there — --force to redo it`);
      return;
    } catch { /* not rendered yet */ }
  }

  const r = await fetch(
    api(`/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`),
    {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        /* Stability low enough to carry a half-line of dryness, similarity
           high so the two languages are recognisably the same person. */
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15 },
      }),
    },
  );
  if (!r.ok) await fail(`Rendering ${key}.${lang}`, r);

  const out = await r.json();
  if (!out.audio_base64) {
    console.error(`\n  ${key}.${lang}: no audio came back. Keys were: ${Object.keys(out).join(", ")}`);
    process.exit(1);
  }
  await writeFile(stem + ".mp3", Buffer.from(out.audio_base64, "base64"));

  const timing = unitTimes(text, out.alignment);
  if (timing) {
    await writeFile(stem + ".json", JSON.stringify(timing));
    console.log(`  ${key}.${lang}  ${timing.dur}s, ${timing.at.length} units`);
  } else {
    /* No JSON file at all rather than a wrong one: the page treats a missing
       timing file as "play it and light the words on a timer", which is
       right, and would treat a bad one as gospel. */
    console.log(`  ${key}.${lang}  audio written; alignment did not match, so no timings`);
  }
}

async function main() {
  if (!KEY) {
    console.error("\n  ELEVENLABS_API_KEY is not set.\n");
    process.exit(1);
  }
  if (process.argv.includes("--list")) return list();

  await mkdir(OUT, { recursive: true });
  console.log(`\n  voice ${VOICE}, model ${MODEL}\n`);
  for (const key of BEATS) {
    const pair = STRINGS[key];
    if (!pair) { console.error(`  ${key} is not in i18n.js`); process.exit(1); }
    for (const [lang, i] of LANGS) {
      const text = pair[i];
      /* A placeholder would mean a line that varies per person, which is the
         one thing that cannot be a file. Caught here rather than discovered
         as "{who}" spoken aloud on somebody's arrival. */
      if (/[{}]/.test(text)) {
        console.error(`\n  ${key}.${lang} still has a placeholder in it: ${text}`);
        console.error("  Beats are rendered once for everybody, so they cannot carry a name.\n");
        process.exit(1);
      }
      await say(key, lang, text);
    }
  }
  console.log(`\n  Written to board/public/voice/.`);
  console.log(`  They are part of the product, so commit them:`);
  console.log(`\n    git add board/public/voice && git commit -m "The arrival's voice" && git push\n`);
}

await main();
