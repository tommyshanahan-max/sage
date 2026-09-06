/* The few newest posts, drawn the same way on every door.
 *
 * Shared rather than copied for the reason the stylesheet is: there are two
 * landing pages now, and a second copy of this would drift — the first symptom
 * being one door showing last month's card design.
 *
 * Takes its strings through T() rather than holding any, so it says the right
 * thing in whichever language the page it sits on is set to. And it takes the
 * box to draw into rather than looking one up by id, so a page is free to call
 * that element whatever it likes.
 */
import { T, when } from "/i18n.js";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c;
  if (x !== undefined) n.textContent = x; return n; };
const fill = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

const TDOT = ["--t1", "--t2", "--t3", "--t4", "--t5", "--t6"];

/** A topic's colour, from its own letters. Stable without a lookup table, so a
 *  topic nobody has used before still gets one, and the same topic is the same
 *  colour on every page. */
export function topicColour(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return "var(" + TDOT[h % TDOT.length] + ")";
}

/** The newest few, or an honest empty state.
 *
 *  A board claiming activity it does not have is the one thing it cannot
 *  recover from, so when there is nothing this says so rather than showing
 *  placeholders. */
export function drawLive(box, posts) {
  if (!box) return;
  fill(box);
  if (!posts || !posts.length) {
    const e = el("div", "empty");
    e.append(el("b", null, T("site.liveEmptyH")), el("p", null, T("site.liveEmptyP")));
    box.append(e);
    box.style.gridTemplateColumns = "1fr";
    return;
  }
  box.style.gridTemplateColumns = "";
  for (const p of posts.slice(0, 4)) {
    const a = el("a", "post");
    a.href = "/feed#" + p.id;
    a.append(el("div", "av", (String(p.handle || "?").trim()[0] || "?").toLowerCase()));

    const m = el("div", "m");
    if (p.topic) {
      const eb = el("div", "eb");
      const dot = el("i");
      dot.style.background = topicColour(p.topic);
      eb.append(dot, el("span", null, p.topic));
      m.append(eb);
    }
    const who = el("div", "who");
    who.append(el("b", null, p.handle || T("board.someone")), el("time", null, when(p.at)));
    m.append(who);
    if (p.note) {
      const t = p.note.length > 150
        ? p.note.slice(0, 150).replace(/\s+\S*$/, "") + "…"
        : p.note;
      m.append(el("p", null, t));
    }
    a.append(m);
    box.append(a);
  }
}
