/* Stand the board up on this machine, with one room already in it, so a thing
 * can be looked at before it is deployed.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS. "Show me a screenshot" and "let me click it" are different
 * questions, and only the second one finds the button that does nothing. The
 * board is plain node and a JSON file, so it runs on a laptop — what was
 * missing was a room to look at, because an empty board shows nothing and
 * filling one by hand is twenty minutes of typing on a phone-sized screen.
 *
 * NOTHING HERE TOUCHES THE SERVER. It writes one file into a temp directory
 * that `make try` deletes when the server stops, and it never opens a socket
 * to anything.
 *
 * WHO YOU ARE WHEN YOU OPEN IT. Claire — because she is the one who has not
 * agreed yet, so Agree is a button you can press rather than a line of text
 * saying somebody already did. That is done with BOARD_DEMO_DEVICE, the same
 * mechanism the demo board uses, so there is no second way of being somebody
 * to get wrong.
 *
 *   node scripts/try.mjs <dir> <salt>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashDevice } from "../board/lib/store.js";

const dir = process.argv[2];
const salt = process.argv[3] || "";
if (!dir) { console.error("try.mjs <dir> <salt>"); process.exit(1); }

/* The devices are fixed strings rather than random ones so that the room is
   the same room every time it is stood up — a demo that is different on
   Tuesday is a demo nobody can be walked through twice. */
const DEVICE = { Claire: "clairedevice0001", Sasha: "sashadevice00001", Tom: "tomdevice0000001" };
const by = (name) => hashDevice(DEVICE[name], salt);

const now = new Date();
const ago = (mins) => new Date(now.getTime() - mins * 60000).toISOString();

/* A PERSON ROW HAS TO SURVIVE cleanPerson OR IT IS NOT THERE AT ALL, and it
   goes missing silently: a row without a 20-hex `id` is dropped on load, the
   room still opens, and the card says "you are in the room but not a party to
   this" because the reader has no handle to match against the memo. The first
   version of this seed had `by` and `handle` and nothing else, and that is
   exactly what it looked like. `state` has to be published too — a held
   profile is somebody who has not arrived yet.

   THE IDS ARE HEX AND ONLY HEX. Spelling the names into them read nicely —
   5a5ha... for Sasha — and 's' and 'h' are not hex digits, so those two rows
   were dropped on load while Claire's survived. The room opened with one
   person in it and no error anywhere. */
const person = (name, id, me, want, where) => ({
  id, at: ago(600), state: "published", handle: name,
  level: "Just starting", campus: "", goal: "",
  looking: true, say: [{ me, want }], rooms: [], where, wants: "any",
  by: by(name),
});

const board = {
  people: [
    /* CLAIRE IS OUTSIDE AND SASHA IS IN THE MAINLAND, which is the whole
       point of this room: it is the case the payment route exists for. Two
       people in the same place show no route at all, and the screen then
       looks like the feature is missing rather than not applicable. */
    person("Claire", "c1a19e00000000000001", "producer", "agent", "out"),
    person("Sasha", "5a54a000000000000002", "agent", "performer", "cn"),
    person("Tom", "70b00000000000000003", "founder", "anybody", "out"),
  ],
  groups: [{
    /* Twenty hex characters, which is what cleanGroup insists on. A shorter
       one is dropped silently and the room simply does not appear. */
    id: "bbbbbbbbbbbbbbbbbbbb",
    at: ago(60),
    by: by("Tom"),
    members: [by("Tom"), by("Claire"), by("Sasha")],
    guests: [],
    name: "Macau, March",
    deal: {
      title: "Macau event, 14 March",
      hires: "Claire",
      provides: "Sasha",
      by: by("Tom"),
      at: ago(55),
      /* Sasha has agreed and Claire has not, so both halves of the card are on
         screen at once: one side settled, one side still a button. */
      agreed: [{ who: "Sasha", at: ago(40) }],
      what: "One named artist, one appearance, 90 minutes on stage",
      where: "Macau",
      when: "14 March, doors 8pm",
      fee: "HK$450,000",
      deposit: "50% on agreeing, balance on the night",
      covers: "Claire pays flights, hotel and ground transport for the artist and one assistant",
      cancel: "Called off inside 14 days, the deposit is kept",
      /* Read by code rather than by a person: doneIn decides whether Chinese
         tax is mentioned, payerIs decides which way out of the mainland is
         suggested. */
      doneIn: "cn",
      payerIs: "company",
      /* One row settled and one still due, so both halves of every state are
         on screen at once: a receipt to open and a payment to claim. Written
         in yuan so the ¥50,000 rule has something to decide on — in another
         currency the card gives both rules, which is also worth seeing but is
         not the interesting one. */
      plan: [
        { label: "Deposit", amount: "¥30,000", due: "on signing" },
        { label: "Balance", amount: "¥30,000", due: "on the night" },
      ],
      payTo: "https://wise.com/pay/sasha",
      payToAt: ago(4320),
      paid: [
        { i: 0, kind: "claimed", who: "Claire", at: ago(120) },
        { i: 0, kind: "confirmed", who: "Sasha", at: ago(90) },
      ],
    },
  }],
};

await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "board.json"), JSON.stringify(board, null, 2));

console.log("");
console.log("  Macau, March — Claire, Sasha and Tom, with the terms pinned.");
console.log("  You are Claire. Sasha has agreed; you have not.");
console.log("");
