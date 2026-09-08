/* THE WAITING LIST, IN ONE PLACE.
 *
 * It appears twice — at the foot of the public page, and under a result on the
 * test that anybody can take — and those are two very different screens with
 * one job between them. Written twice it would drift: one of them would ask
 * for an email, one would forget to say who can read the answer, and the day
 * the copy changed only one would change.
 *
 * WHAT IT ASKS FOR AND WHY IT IS SO LITTLE. A name and one way to be reached.
 * That is the only contact detail this board holds for anybody who is not a
 * member, it is visible to nobody but whoever runs the box, and the note at
 * the bottom says so on the same screen rather than in a policy somewhere.
 *
 * THE COUNT COMES FROM THE SERVER OR NOT AT ALL. It is withheld below five —
 * see WAITING_FLOOR in server.js — because "1 person is waiting" on a page
 * anybody can read is a worse advertisement than silence, and on a board this
 * small it is nearly a name.
 */

import { T } from "/i18n.js";

/** The room a /r/... address names, or "" anywhere else. One place, so the
 *  page, the count and the form cannot come to different conclusions about
 *  which door somebody walked through. */
export function roomFromPath() {
  const m = /^\/r\/([a-z]+)/.exec(location.pathname || "");
  const key = m ? m[1] : "";
  return ["film", "invest", "raise", "trade", "other"].includes(key) ? key : "";
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
};

/** The same random number the app uses, so asking twice from one browser
 *  corrects the first answer instead of queueing behind it. Made here when
 *  this is the first page of ours somebody has opened. */
function device() {
  try {
    let d = localStorage.getItem("board:device") || "";
    if (!d) {
      d = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2))
        .replace(/-/g, "");
      localStorage.setItem("board:device", d);
    }
    return d;
  } catch { return ""; }
}

/** The box, wired.
 *
 *  THREE THINGS AND NOTHING ELSE: invite only, how many are waiting, and the
 *  button. It used to carry a heading and a paragraph explaining that the way
 *  in is a password from a member — which is what "invite only" already says,
 *  in two words, at the top. A box that says the same thing twice reads as a
 *  box arguing with itself, and the second saying of it was where the number
 *  got pushed down out of sight.
 *
 *  It took a head and a say for the test page, which needed different words
 *  for the same idea. It does not need them any more: the two words are right
 *  on both screens. */
export function waitBox() {
  const box = el("div", "waitbox");
  box.append(el("span", "waiteyebrow", T("wait.only")));

  /* THE NUMBER, AT THE SIZE OF THE THING IT IS SAYING.
   *
   * It was a line of small blue text under a paragraph, which is where a
   * footnote goes. It is not a footnote — it is the only evidence on this page
   * that anybody else wants in, and a queue you cannot see is not a queue. So
   * it is set as a figure with its label under it, the same way the report
   * card sets a number worth looking at.
   *
   * Still absent rather than zero below the floor: see WAITING_FLOOR. */
  const count = el("div", "waitcount");
  const big = el("b");
  const lab = el("span");
  count.append(big, lab);
  count.hidden = true;
  box.append(count);

  /* ONE STEP, NOT TWO.
   *
   * This opened as a sentence, a number and a button, with the form behind a
   * tap — on the argument that three empty boxes are a decision about whether
   * to fill them in, asked before somebody has decided the smaller thing.
   *
   * The argument stopped holding once the promise about who reads the list
   * moved down onto the form. What was left on the first step was the number
   * and a button, and the second step said the same thing plus the boxes. A
   * step that asks nothing and adds nothing is a tap, and a tap between
   * somebody wanting in and being able to say so is the one thing on this
   * page worth nothing at all.
   *
   * Three fields, two of them required, and the third optional and marked so.
   * That is short enough to be the first thing seen. */
  const form = el("form");

  /* WHICH ROOM, ASKED FIRST AND IN FOUR WORDS.
   *
   * Four buckets and not the board's thirteen rooms: those are the vocabulary
   * of somebody already inside. A stranger cannot be asked to choose between
   * "a model or creative looking for an agent" and "an agent or manager
   * looking for people" — Film & TV holds both, and both sides of it will pick
   * it.
   *
   * It is one tap and nothing is required: whoever skips it lands in Other,
   * which is a real pile and not a punishment. What it buys is on the other
   * end — the list can be read a room at a time, and a room can be let in
   * together, which is the difference between arriving somewhere and arriving
   * in an empty feed. */
  /* THE ROOM THE DOOR WAS OPENED WITH. /r/film arrives with Film & TV already
     picked — somebody who followed a film link has answered this question by
     following it, and asking again is asking them to agree with themselves. */
  let room = roomFromPath();
  const rooms = el("div", "waitrooms");
  const chips = [];
  for (const key of ["film", "invest", "raise", "trade", "other"]) {
    const c = el("button", "waitrm", T("waitroom." + key));
    c.type = "button";
    c.addEventListener("click", () => {
      room = room === key ? "" : key;
      for (const [k, b] of chips) b.className = "waitrm" + (k === room ? " on" : "");
    });
    if (key === room) c.className = "waitrm on";
    chips.push([key, c]);
    rooms.append(c);
  }
  form.append(el("p", "waitask", T("wait.which")), rooms);

  const name = el("input");
  name.maxLength = 40;
  name.autocomplete = "name";
  name.placeholder = T("wait.name");
  const reach = el("input");
  reach.maxLength = 80;
  reach.autocapitalize = "off";
  reach.spellcheck = false;
  reach.placeholder = T("wait.reach");
  /* One line, in a box the size of one line. It was a two-row textarea, which
     is the tallest thing on the screen asking for the least important thing
     on it — and a box that size asks for a paragraph. */
  const why = el("input");
  why.maxLength = 300;
  why.placeholder = T("wait.why");
  const go = el("button", "btn", T("wait.go"));
  go.type = "submit";
  form.append(name, reach, why, go);
  box.append(form);

  const said = el("p", "said");
  said.hidden = true;
  box.append(said);

  /* THE PROMISE MOVES TO WHERE IT IS OWED.
   *
   * It used to sit under the button, on a screen asking for nothing — four
   * lines of policy answering a question nobody had been given a reason to
   * ask yet, and it was most of the words on the first thing a stranger sees.
   *
   * It belongs on the step where they are actually typing a way to reach
   * them. That is the moment the promise is being made, and it is read there
   * because it is about the box under the cursor. */
  box.append(el("p", "waitnote", T("wait.note")));

  const tell = (words, bad) => {
    said.hidden = false;
    said.className = "said" + (bad ? " bad" : "");
    said.textContent = words;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!name.value.trim() || !reach.value.trim()) return tell(T("wait.both"), true);
    go.disabled = true;
    try {
      const r = await fetch("/api/wait", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(), reach: reach.value.trim(),
          why: why.value.trim(), room, device: device(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("no");
      // Somebody who is already a member and has landed here anyway.
      tell(d.already ? T("wait.already") : d.again ? T("wait.again") : T("wait.done"));
      if (!d.already) { form.hidden = true; count.hidden = true; }
      // The promise stays after sending: it is about what was just handed over.
    } catch { tell(T("act.again"), true); }
    go.disabled = false;
  });

  // The count, if the server is willing to say. Drawn late rather than holding
  // the box back: the form is the point and it works without a number.
  const askedFor = roomFromPath();
  fetch("/api/hello" + (askedFor ? "?room=" + encodeURIComponent(askedFor) : ""))
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.waiting) return;
      count.hidden = false;
      big.textContent = String(d.waiting);
      /* The label follows the number the SERVER decided to send. A room below
         the floor comes back as the whole board's figure with no room on it —
         see /api/hello — and this then says "waiting to get in" rather than
         naming a room the number is not about. */
      lab.textContent = d.room
        ? T("wait.waitingIn", { room: T("waitroom." + d.room) })
        : T("wait.waiting");
    })
    .catch(() => { /* no number, same box */ });

  return box;
}

/* A LOOK AT THE FEED WITH NO WORDS IN IT.
 *
 * The server sends the shape of the newest posts and never the text — see the
 * note above `peek` in server.js. Each row is a list of word lengths, and this
 * draws a grey block per word at that width. Blurred on top, so it reads as a
 * board somebody is holding just out of focus.
 *
 * The blur is the look, not the protection. The protection is that there is
 * nothing underneath it: no sentence reaches this page, so no developer tools
 * can reveal one. That is the difference between a teaser and a leak, and it
 * is why this could not be done by blurring the real feed.
 */
export function feedPeek(rows, head) {
  const box = el("div", "peek");
  if (head) box.append(el("span", "peekhead", head));
  const stack = el("div", "peekstack");
  for (const words of (rows || []).slice(0, 5)) {
    const post = el("div", "peekpost");
    const av = el("i", "peekav");
    const lines = el("div", "peekwords");
    for (const n of words) {
      const w = el("b");
      // 0.42rem a character, which lands close enough to real text that the
      // ragged right edge of a paragraph comes out looking like one.
      w.style.width = (Math.max(1, Number(n) || 1) * 0.42).toFixed(2) + "rem";
      lines.append(w);
    }
    post.append(av, lines);
    stack.append(post);
  }
  box.append(stack);
  return box;
}

/** Whether this browser is already through the door. Public route, so it
 *  works on a page a stranger is reading. */
export async function admitted() {
  try {
    const d = await fetch("/api/admitted", { headers: { "x-board-device": device() } })
      .then((r) => r.json());
    return Boolean(d && d.in);
  } catch { return false; }
}
