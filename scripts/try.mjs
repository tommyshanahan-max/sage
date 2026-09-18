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
 * WHO YOU ARE WHEN YOU OPEN IT. Sasha, in Beijing, who is the one paying.
 *
 * It used to be Claire, and Claire was the one being paid. That made every
 * payment screen in the room unreachable from the demo: the payer's buttons
 * are the payer's, and standing in the payee's shoes you can watch them and
 * press none of them. The direction this board was built for is money leaving
 * the mainland, so the person to be is the one it leaves.
 *
 * She has also not agreed yet, so Agree is a button rather than a line of text
 * saying somebody already did. That is BOARD_DEMO_DEVICE, the same mechanism
 * the demo board uses, so there is no second way of being somebody to get
 * wrong.
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
const person = (name, id, me, want, where, payee) => ({
  id, at: ago(600), state: "published", handle: name,
  level: "Just starting", campus: "", goal: "",
  looking: true, say: [{ me, want }], rooms: [], where, wants: "any",
  by: by(name),
  /* WHERE THE MONEY LANDS, for somebody who has finished Stripe's onboarding.
     Without it the room offers the payee's own link instead, which is the
     older path and still the only one for a payee in the mainland. A made-up
     id is enough to draw every screen; it is not enough to take a payment,
     and this file never talks to Stripe. */
  ...(payee ? { payee } : {}),
});

const board = {
  people: [
    /* SASHA IS IN THE MAINLAND AND PAYS; CLAIRE IS IN AUSTRALIA AND IS PAID.
       That direction is the whole point of this room. Two people in the same
       place show no route at all, and the screen then looks like the feature
       is missing rather than not applicable.

       It used to run the other way — Claire outside paying Sasha in — and
       that room could never show the payment at all: Stripe does not take on
       payees in the mainland, so the only thing on screen was the old link.
       The demo was of the one case the new plumbing cannot serve. */
    person("Sasha", "5a54a000000000000002", "producer", "screenwriter", "cn"),
    person("Claire", "c1a19e00000000000001", "screenwriter", "producer", "out",
           "acct_1PdemoAUonlyForLooking"),
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
      hires: "Sasha",
      provides: "Claire",
      by: by("Tom"),
      at: ago(55),
      /* Claire has agreed and Sasha has not, so both halves of the card are on
         screen at once: one side settled, one side still a button — and the
         button is yours, because you are Sasha. */
      agreed: [{ who: "Claire", at: ago(40) }],
      what: "One named artist, one appearance, 90 minutes on stage",
      where: "Macau",
      when: "14 March, doors 8pm",
      fee: "¥60,000",
      deposit: "50% on agreeing, balance on the night",
      covers: "Sasha pays flights, hotel and ground transport for the artist and one assistant",
      cancel: "Called off inside 14 days, the deposit is kept",
      /* Read by code rather than by a person: doneIn decides whether Chinese
         tax is mentioned, payerIs decides which way out of the mainland is
         suggested. */
      doneIn: "cn",
      payerIs: "company",
      /* THE CURRENCY, WRITTEN DOWN, because ¥ alone is two currencies twenty
         times apart and the room will not guess between yuan and yen. Without
         it the plan reads as words rather than money and the card quietly
         drops back to the payee's own link — which is what happened the first
         time this seed was flipped, and it looked like the payment had been
         built wrong rather than the seed being short a field. */
      cur: "cny",
      /* THE NUMBERS ADD UP, and the first version's did not: a HK$450,000
         booking paid in two ¥30,000 instalments. Nobody would say so out
         loud, and anybody looking at the screen would quietly stop trusting
         every other number on it.

         One row settled and one still due, so both halves of every state are
         on screen at once: a receipt to open and a payment to claim. Written
         in yuan so the ¥50,000 rule has something to decide on — in another
         currency the card gives both rules, which is also worth seeing but is
         not the interesting one. */
      plan: [
        { label: "Deposit", amount: "¥30,000", due: "on signing" },
        { label: "Balance", amount: "¥30,000", due: "on the night" },
      ],
      payTo: "https://wise.com/pay/claire",
      payToAt: ago(4320),
      paid: [
        { i: 0, kind: "claimed", who: "Sasha", at: ago(120) },
        { i: 0, kind: "confirmed", who: "Claire", at: ago(90) },
      ],
    },
  }],
};

await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, "board.json"), JSON.stringify(board, null, 2));

console.log("");
console.log("  Macau, March — Sasha, Claire and Tom, with the terms pinned.");
console.log("  You are Sasha, in Beijing, paying Claire in Australia.");
console.log("  Claire has agreed; you have not. The balance is still to pay.");
console.log("");
