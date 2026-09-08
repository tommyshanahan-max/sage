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

/** The box, wired. `head` and `say` may be overridden where the screen around
 *  it has already said what this place is — under a test result, the sentence
 *  about passwords has already been read. */
export function waitBox(opts) {
  const o = opts || {};
  const box = el("div", "waitbox");
  /* SAID BEFORE ANYTHING ELSE. Two words, and they are the whole proposition:
     this is not a site you sign up to. Everything under them is a consequence
     of that sentence rather than an apology for it. */
  box.append(el("span", "waiteyebrow", T("wait.only")));
  box.append(el("h3", null, o.head || T("wait.head")));
  box.append(el("p", "sub", o.say || T("wait.say")));

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

  /* TWO STEPS, AND THE FIRST ONE ASKS FOR NOTHING.
   *
   * Three empty boxes are a form, and a form is a decision about whether to
   * fill it in — made before the person has decided the smaller thing, which
   * is whether they want in at all. So the box opens as a sentence, the number
   * of people already waiting, and one button. Nothing to type until they have
   * said yes.
   *
   * It also keeps the box short, which is the other half of it: collapsed it
   * fits on the screen under whatever brought them here, so the number and the
   * button are read rather than scrolled to. */
  const open = el("button", "btn", T("wait.join"));
  open.type = "button";
  box.append(open);

  const form = el("form");
  form.hidden = true;
  const name = el("input");
  name.maxLength = 40;
  name.autocomplete = "name";
  name.placeholder = T("wait.name");
  const reach = el("input");
  reach.maxLength = 80;
  reach.autocapitalize = "off";
  reach.spellcheck = false;
  reach.placeholder = T("wait.reach");
  const why = el("textarea");
  why.rows = 2;
  why.maxLength = 300;
  why.placeholder = T("wait.why");
  const go = el("button", "btn", T("wait.go"));
  go.type = "submit";
  form.append(name, reach, why, go);
  box.append(form);

  open.addEventListener("click", () => {
    open.hidden = true;
    form.hidden = false;
    // Straight into the first box: they have already pressed the button, and
    // asking them to press again to start typing is one press too many.
    try { name.focus({ preventScroll: true }); } catch { name.focus(); }
  });

  const said = el("p", "said");
  said.hidden = true;
  box.append(said);
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
          why: why.value.trim(), device: device(),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error("no");
      // Somebody who is already a member and has landed here anyway.
      tell(d.already ? T("wait.already") : d.again ? T("wait.again") : T("wait.done"));
      if (!d.already) { form.hidden = true; count.hidden = true; }
    } catch { tell(T("act.again"), true); }
    go.disabled = false;
  });

  // The count, if the server is willing to say. Drawn late rather than holding
  // the box back: the form is the point and it works without a number.
  fetch("/api/hello")
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.waiting) return;
      count.hidden = false;
      big.textContent = String(d.waiting);
      lab.textContent = T("wait.waiting");
    })
    .catch(() => { /* no number, same box */ });

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
