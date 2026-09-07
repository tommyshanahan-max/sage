/* THE MARK: a cap that becomes a crown.
 *
 * WHAT IT MEASURES, and it is the whole honesty of the thing: the level test,
 * and nothing else. Ten levels fold into five marks along exactly the five
 * bands level-cards.js already names — Beginner, Elementary, Intermediate,
 * Upper intermediate, Advanced — so the mark is not a second instrument with a
 * second opinion. It is the same result, worn.
 *
 * CULTURE IS NOT IN HERE YET. The journey is meant to be language *and*
 * culture, and there is no culture instrument on this board — so the mark does
 * not pretend to one. A crown that quietly stood for something nobody had
 * measured would be worth less than a crown that stands for one thing anybody
 * can check.
 *
 * IT IS OPT-IN, because it is drawn from `levelBand` on a person, and that is
 * only there if they pressed "Put this on my page". Somebody who takes the
 * test and keeps the number keeps the number.
 *
 * WHY IT CHANGES SHAPE rather than filling up. Five bars filling is a progress
 * meter, and a progress meter says how far you are from somebody else's idea
 * of finished. A cap that grows a point, then three, then becomes a crown is
 * the same object at five ages: it says you have been here a while, which is
 * what is actually true.
 */

import { lang } from "/i18n.js";

/** [en, zh], the same pair idiom as i18n.js. */
export const STAGES = [
  { key: "cap",     name: ["Newcomer", "新来"] },
  { key: "peak",    name: ["Settling in", "安顿下来"] },
  { key: "three",   name: ["Getting by", "应付得来"] },
  { key: "five",    name: ["At home here", "如鱼得水"] },
  { key: "crown",   name: ["Old hand", "老手"] },
];

/* THE DRAWING, on a 24×24 box, as filled paths in currentColor.
 *
 * Filled and not stroked because this is worn at sixteen pixels beside a name,
 * and a hairline outline at that size is a smudge. Two shapes at most per
 * stage, so it survives being drawn on a canvas as well as in the page.
 *
 * The silhouette changes twice on purpose. One to two is the same cap with
 * something new on it — you have been here long enough to have earned a
 * detail. Two to three is the dome gone and points in its place, which is the
 * moment somebody sees that this turns into a crown if they keep going.
 */
const BRIM = "M3.4 16.2h17.2v2.5a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1z";
const DOME = "M5.4 16.2a6.6 6.6 0 0 1 13.2 0z";
const BAND = "M4.2 16.2h15.6v2.5a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1z";

const THREE = "M4.2 16.2 6.6 10.8 9.3 13.8 12 9.6 14.7 13.8 17.4 10.8 19.8 16.2Z";
const FIVE =
  "M4.2 16.2 5.4 9.8 7.05 13.4 8.7 8.4 10.35 13.4 12 6.8"
  + " 13.65 13.4 15.3 8.4 16.95 13.4 18.6 9.8 19.8 16.2Z";
/** The knobs on the points, which is the one thing that says crown and not saw. */
const dot = (x, y) => "M" + x + " " + (y - 1.25)
  + "a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 1 0 0-2.5Z";
const KNOBS = [dot(5.4, 9.2), dot(8.7, 7.8), dot(12, 6.2), dot(15.3, 7.8), dot(18.6, 9.2)];

/* The second stage is a knob on the cap, not a spike: a spike at this size is
   a helmet, and the point of stage two is that somebody has been here long
   enough to have earned a small ornament, not a weapon. It overlaps the dome
   deliberately, so the two read as one hat. */
const MARKS = [
  [DOME, BRIM],
  [DOME, BRIM, "M12 6.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2Z"],
  [THREE, BAND],
  [FIVE, BAND],
  [FIVE, BAND, ...KNOBS],
];

/** 1–5 for a stored band, 0 for somebody who has not put a level up. */
export function stageFor(levelBand) {
  const m = /^(ZH|EN) (\d{1,2})$/.exec(String(levelBand || "").toUpperCase());
  if (!m) return 0;
  const n = Number(m[2]);
  if (!(n >= 1 && n <= 10)) return 0;
  return Math.ceil(n / 2);
}

/** Which language the mark was earned in — "zh" or "en", "" for no band. */
export function wordFor(levelBand) {
  const m = /^(ZH|EN) /.exec(String(levelBand || "").toUpperCase());
  return m ? m[1].toLowerCase() : "";
}

/** What this stage is called, in whichever language the page is being read. */
export function stageName(stage) {
  const s = STAGES[Math.max(1, Math.min(5, stage)) - 1];
  return s.name[lang() === "zh" ? 1 : 0];
}

/** The paths for a stage, for anything that draws its own. */
export function marksFor(stage) {
  return MARKS[Math.max(1, Math.min(5, stage)) - 1];
}

/** The mark, as an element. `size` is a CSS length; it inherits the text colour. */
export function crownMark(stage, size) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.width = size || "1.15em";
  svg.style.height = size || "1.15em";
  svg.style.display = "block";
  svg.style.flex = "0 0 auto";
  for (const d of marksFor(stage)) {
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "currentColor");
    svg.append(p);
  }
  return svg;
}

/* ON A CANVAS, for the card a result gets shared as.
 *
 * Path2D is what makes one set of paths serve both the page and the picture.
 * Old WeChat kernels are the reason for the guard: without Path2D the picture
 * simply has no mark on it, which is a plainer card and not a broken one.
 */
export function crownOnCanvas(x, stage, left, top, size, colour) {
  if (typeof Path2D !== "function") return false;
  const s = size / 24;
  x.save();
  x.translate(left, top);
  x.scale(s, s);
  x.fillStyle = colour;
  for (const d of marksFor(stage)) x.fill(new Path2D(d));
  x.restore();
  return true;
}
