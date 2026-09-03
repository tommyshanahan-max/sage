// Whether a story is the right shape — as data, not as markup.
//
// ---------------------------------------------------------------------------
// This file is meant to be copied.
//
// Study Pal has its own writing screen at /write, and this check belongs there
// as much as here: it is the thing a writer cannot see while writing. Anyone
// can type twelve boxes. Whether act three has room to land, whether the
// midpoint actually turns — those are visible only once somebody counts, and
// Wudaokou's first draft failed both twice before anybody did.
//
// So it exports a pure function over the beats and returns findings. No DOM, no
// framework, no styling opinion: this page renders it as coloured dots, a React
// screen would render it as whatever suits it, and the judgements stay the same
// in both. Sharing the rendering instead would have meant sharing a design
// system, which is how a shared module becomes two divergent copies.
//
// The proportions are conventional but not sacred: roughly a quarter, a half, a
// quarter, with the turns near 25%, 50% and 70%. Wudaokou runs 3/5/4 over
// twelve on purpose, because a romance pays off in act three. The thresholds
// below are therefore loose enough to allow that and tight enough to catch an
// ending with two episodes out of fifteen.
// ---------------------------------------------------------------------------

export const FUNCTIONS = [
  "ordinary world", "inciting incident", "debate", "act one turn", "rising",
  "pinch", "midpoint", "false victory", "complication", "all is lost",
  "dark night", "climax", "resolution",
];

/** @param {Array<{act?:number, function?:string, beat?:string}>} episodes
 *  @returns {{ n:number, perAct:number[], checks:{ok:boolean, text:string}[] }} */
export function checkShape(episodes) {
  const eps = Array.isArray(episodes) ? episodes : [];
  const n = eps.length;
  const perAct = [1, 2, 3].map((a) => eps.filter((e) => Number(e.act) === a).length);
  if (!n) return { n: 0, perAct, checks: [] };

  // Position as a fraction of the run, so the same thresholds work for a
  // twelve-part series and a thirty-part one.
  const at = (fn) => {
    const i = eps.findIndex((e) => e.function === fn);
    return i < 0 ? null : (i + 1) / n;
  };
  const pct = (v) => Math.round(v * 100) + "%";
  const checks = [];
  const add = (ok, text) => checks.push({ ok, text });

  const third = perAct[2] / n;
  add(third >= 0.18, third >= 0.18
    ? `Act three is ${pct(third)} of the run`
    : `Act three is only ${pct(third)} — the ending has no room`);

  const mid = at("midpoint");
  add(mid !== null && Math.abs(mid - 0.5) <= 0.12,
    mid === null ? "No midpoint — nothing turns"
      : Math.abs(mid - 0.5) <= 0.12 ? `Midpoint at ${pct(mid)}`
      : `Midpoint at ${pct(mid)} — too far from halfway`);

  const turn = at("act one turn");
  add(turn !== null && turn <= 0.35,
    turn === null ? "No act one turn"
      : turn <= 0.35 ? `Act one turns at ${pct(turn)}`
      : `Act one turns at ${pct(turn)} — too late in`);

  add(at("all is lost") !== null,
    at("all is lost") !== null ? "Act two has a bottom"
      : "No all is lost — act two never bottoms out");

  add(at("climax") !== null, at("climax") !== null ? "There is a climax" : "No climax");

  const empty = eps.filter((e) => !String(e.beat || "").trim()).length;
  add(empty === 0, empty ? `${empty} beats still empty` : "Every beat written");

  return { n, perAct, checks };
}

/** A blank run, numbered and roughly assigned to acts.
 *
 *  Assigned rather than left empty because an empty grid invites twelve beats
 *  of act two — the exact shape the check above exists to catch. Cheaper to
 *  start right than to be told off afterwards. */
export function blankBeats(count = 12) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const at = i / count;
    const act = at <= 0.3 ? 1 : at <= 0.72 ? 2 : 3;
    let fn = "rising";
    if (i === 1) fn = "ordinary world";
    else if (at <= 0.18) fn = "inciting incident";
    else if (Math.abs(at - 0.25) < 0.5 / count) fn = "act one turn";
    else if (Math.abs(at - 0.5) < 0.5 / count) fn = "midpoint";
    else if (Math.abs(at - 0.72) < 0.5 / count) fn = "all is lost";
    else if (i === count) fn = "resolution";
    else if (i === count - 1) fn = "climax";
    out.push({ n: i, act, function: fn, title: "", beat: "", hook: "" });
  }
  return out;
}
