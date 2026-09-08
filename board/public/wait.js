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
  box.append(el("h3", null, o.head || T("wait.head")));
  box.append(el("p", "sub", o.say || T("wait.say")));

  const count = el("p", "waitn");
  count.hidden = true;
  box.append(count);

  const form = el("form");
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
      if (!d.already) form.hidden = true;
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
      count.textContent = T("wait.n", { n: d.waiting });
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
