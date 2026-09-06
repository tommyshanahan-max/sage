/* People for a demo board.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE RUNNING IT
 *
 * These are invented. To anybody reading the board they are indistinguishable
 * from real students, and if somebody writes to one of them nobody answers.
 * That is fine for showing the product to a partner and it is not fine once
 * real people are on it — so either take them down before that, or be ready to
 * answer as them.
 *
 * Every one of them is created the way a person would be — the same routes,
 * the same held-for-review queue — so nothing here proves the board works in a
 * way the board does not actually work. It only releases the posts and the
 * pictures belonging to the people it created in this run; anything a real
 * person left in the queue stays in the queue, waiting for a human.
 *
 * Usage, on the server:
 *   node scripts/seed-people.mjs https://liuxuesheng.io "$BOARD_KEY"
 *
 * With real pictures — a folder of image files named after the people, so
 * wen.jpg goes to Wen:
 *   node scripts/seed-people.mjs <url> "$BOARD_KEY" --photos ./photos
 *
 * With a different set of people — a JSON array of the same shape as PEOPLE
 * below, so the roster can change without touching this file:
 *   node scripts/seed-people.mjs <url> "$BOARD_KEY" --people ./people.json
 *
 * Anybody without a picture file gets a drawn one: a coloured disc with their
 * initial in it, which is meant to look like the placeholder it is.
 *
 * Idempotent: run it twice and it recognises its own people and stops.
 * --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import zlib from "node:zlib";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] || "" : "";
};
const positional = args.filter((a, i) =>
  !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));

const BASE = (positional[0] || "").replace(/\/+$/, "");
const KEY = positional[1] || "";
const PHOTOS = flag("--photos");
const ROSTER = flag("--people");
if (!BASE || !KEY) {
  console.error("usage: node scripts/seed-people.mjs <board url> <admin key>" +
    " [--photos <dir>] [--people <file.json>]");
  process.exit(1);
}

/* A stable device id per seeded person, so running this again finds the same
 * people rather than making four more. Derived from a fixed phrase, which also
 * means the ids are recoverable if these ever need editing or removing. */
const deviceFor = (name) =>
  createHash("sha256").update("liuxuesheng-seed-v1:" + name).digest("hex").slice(0, 32);

/* A drawn avatar: a filled disc with an initial. A PNG written by hand rather
 * than by a library, because the only shapes needed are a circle and a letter
 * and this box has no font that draws Chinese anyway. Used only for people who
 * arrived without a picture file. */
const GLYPHS = {
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01110","10001","10000","10000","10000","10001","01110"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01110","10001","10000","10111","10001","10001","01110"],
  H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["11111","00100","00100","00100","00100","00100","11111"],
  J: ["00111","00010","00010","00010","00010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"],
  N: ["10001","11001","10101","10011","10001","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
  Q: ["01110","10001","10001","10001","10101","10010","01101"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01110","10001","10000","01110","00001","10001","01110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"],
  V: ["10001","10001","10001","10001","10001","01010","00100"],
  W: ["10001","10001","10001","10101","10101","11011","10001"],
  X: ["10001","10001","01010","00100","01010","10001","10001"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"],
  Z: ["11111","00001","00010","00100","01000","10000","11111"],
};

function avatar(letter, rgb) {
  const S = 256, R = S / 2;
  const px = Buffer.alloc(S * S * 3);
  const [r, g, b] = rgb;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 3;
      const d = Math.hypot(x - R + 0.5, y - R + 0.5);
      // Paper outside the disc, the colour inside, and a soft edge between so
      // it does not look like a screenshot of a circle.
      const t = Math.min(1, Math.max(0, R - d));
      px[i] = Math.round(0xEE * (1 - t) + r * t);
      px[i + 1] = Math.round(0xF0 * (1 - t) + g * t);
      px[i + 2] = Math.round(0xF4 * (1 - t) + b * t);
    }
  }
  // The letter, drawn as blocks on a 5x7 grid. Crude on purpose: it is a
  // placeholder and should look like one. A name whose initial is not a Latin
  // letter gets a plain disc, which is honest enough.
  const rows = GLYPHS[String(letter || "").toUpperCase()];
  if (rows) {
    const cell = 18, ox = (S - 5 * cell) / 2, oy = (S - 7 * cell) / 2;
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (rows[gy][gx] !== "1") continue;
        for (let y = 0; y < cell; y++) {
          for (let x = 0; x < cell; x++) {
            const cx = Math.round(ox + gx * cell + x), cy = Math.round(oy + gy * cell + y);
            if (cx < 0 || cy < 0 || cx >= S || cy >= S) continue;
            const i = (cy * S + cx) * 3;
            px[i] = 0xFF; px[i + 1] = 0xFF; px[i + 2] = 0xFF;
          }
        }
      }
    }
  }
  // Minimal PNG: one IDAT, no per-row filtering.
  const raw = Buffer.alloc(S * (S * 3 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    px.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/* The kinds of file the board takes, and nothing else — a picture it will not
 * store is better refused here than sent and rejected. */
const TYPES = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".png", "image/png"], [".webp", "image/webp"],
]);

/* A picture for one person, from the folder, matched on their name. Returns
 * the drawn placeholder when there is no file for them. */
async function pictureFor(person, files) {
  const want = person.name.toLowerCase();
  const hit = files.find((f) =>
    path.basename(f, path.extname(f)).toLowerCase() === want &&
    TYPES.has(path.extname(f).toLowerCase()));
  if (!hit) return { data: avatar(person.name[0], person.rgb), type: "image/png", drawn: true };
  const data = await readFile(path.join(PHOTOS, hit));
  return { data, type: TYPES.get(path.extname(hit).toLowerCase()), drawn: false, file: hit };
}

const DEFAULT_PEOPLE = [
  { name: "Sofia", rgb: [0xD4, 0x48, 0x5C], campus: "Beiwai · Haidian",
    here: "5 months", free: [0, 2, 4],
    goal: "Spanish, learning Chinese from zero. I can help with English essays — mine are not bad." },
  { name: "Yuki", rgb: [0x2A, 0x9D, 0x63], campus: "Renmin · Haidian",
    here: "one year", free: [5, 6],
    goal: "HSK 5 in June. Happy to read anything out loud with someone, my listening is the weak part." },
  { name: "Lena", rgb: [0x72, 0x68, 0xC4], campus: "Tsinghua",
    here: "3 weeks", free: [1, 3],
    goal: "Just arrived from Berlin. Mostly need someone patient — I can trade German or English." },
  { name: "Marc", rgb: [0x3F, 0x68, 0xD8], campus: "Peking University",
    here: "8 months", free: [2, 5],
    goal: "French. Working towards HSK 4. I know where everything is by now, ask me anything." },
];

const api = (path_, opts = {}) =>
  fetch(BASE + path_, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });

async function main() {
  const people = ROSTER
    ? JSON.parse(await readFile(ROSTER, "utf8"))
    : DEFAULT_PEOPLE;
  const files = PHOTOS ? await readdir(PHOTOS) : [];

  const existing = await (await api(`/api/people`)).json().catch(() => ({ people: [] }));
  const already = new Set((existing.people || []).map((q) => (q.handle || "").toLowerCase()));

  // Only the people this run put on the board. Anything already in the queue
  // belongs to somebody else and is left there for a human to look at.
  const mine = new Set();

  for (const p of people) {
    if (already.has(p.name.toLowerCase())) {
      console.log(`${p.name}: already on the list, left alone`);
      continue;
    }
    const pic = await pictureFor(p, files);

    const r = await api("/api/me", {
      method: "PUT",
      body: JSON.stringify({
        device: deviceFor(p.name), handle: p.name, campus: p.campus || "",
        here: p.here || "", goal: p.goal || "", looking: true, free: p.free || [],
        photo: pic.data.toString("base64"), photoType: pic.type,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) { console.error(`${p.name}: ${d.error || r.status}`); continue; }
    mine.add(p.name.toLowerCase());
    console.log(`${p.name}: created, on the list, ${(p.free || []).length} days free` +
      (pic.drawn ? " — placeholder picture" : ` — ${pic.file}`));
  }

  if (!mine.size) return console.log("nothing new to release");

  // Their joinings and their faces went into the queue, like anybody's.
  // Released here so the demo shows a board rather than an empty one, but
  // through the same routes a person would press, and only for these people.
  const q = await (await api(`/api/public?queue=1&secret=${encodeURIComponent(KEY)}`)).json();
  const ours = (x) => mine.has(String(x.handle || "").toLowerCase());
  for (const post of (q.posts || []).filter((x) => x.looking && ours(x))) {
    await api(`/api/feed/release?id=${post.id}&secret=${encodeURIComponent(KEY)}`, { method: "POST" });
    console.log(`released ${post.handle}'s joining`);
  }
  for (const face of (q.faces || []).filter(ours)) {
    await api(`/api/face/release?id=${face.id}&secret=${encodeURIComponent(KEY)}`, { method: "POST" });
    console.log(`released ${face.handle}'s picture`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
