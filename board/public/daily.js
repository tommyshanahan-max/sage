/* ONE CARD A DAY, FROM THE PROFESSOR, AT YOUR LEVEL.
 *
 * WHY IT IS NOT A POST. The feed is one shared board — everybody reads the
 * same rows. A real post per person per day would put fifty cards a morning on
 * a board that has fifty people on it, and the thing worth reading would be
 * underneath them. So this is drawn for the reader, at the top of their own
 * feed, and nobody else's card exists. It costs the server nothing, it needs
 * no account to address, and it is the same Professor either way.
 *
 * WHERE THE LEVEL COMES FROM. The four-question test, if they have taken it.
 * From there the deck drifts on its own: three cards known in a row and it
 * moves up, one they did not know and it drops back. Somebody who has never
 * taken the test gets level two and a line saying so.
 *
 * WHAT DRIFTS AND WHAT DOES NOT. The deck level is theirs to move by pressing
 * "I knew it" — which is a claim, not a measurement, and gameable in one tap.
 * So it decides which card they see and nothing else: the mark beside their
 * name still comes from the test. When the deck runs two levels above what
 * they tested at, the card says so and offers the test again. The reward for
 * a fortnight of cards is being able to prove it, not being handed it.
 *
 * ALL OF IT IS IN localStorage, like everything else this app knows about a
 * person. A cleared browser loses the streak, which is the price of a board
 * with no accounts on it.
 */

import { T } from "/i18n.js";
import { CARDS } from "/level-cards.js";
import { crownMark, stageName } from "/crown.js";
import { OFF } from "/off.js";

const KEY = "board:daily";
const LEVELKEY = "board:level";

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); }
                      catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); }
                          catch { /* private window */ } };

/** Local date, not UTC: "today" is the day where the person is standing. */
function today() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
}

const clamp = (n) => Math.max(1, Math.min(10, n));

/** The deck, seeded from the test the first time it is asked for. */
function deck() {
  const saved = read(KEY);
  if (saved && saved.level) return saved;
  const test = read(LEVELKEY);
  return {
    which: test && test.which === "en" ? "en" : "zh",
    // Level two for somebody who has never been placed: low enough that the
    // first card is a small win rather than a wall, and it climbs from there.
    level: test && test.level ? clamp(Number(test.level)) : 2,
    run: 0,          // known in a row
    done: "",        // the day they answered
    seen: [],        // the last few words, so a small pool does not repeat
    moved: "",       // "up", "down" or "" — what today's answer did
    card: null,      // the one they answered today, kept so it stays put
  };
}

/* WHICH OF THE THREE. Fixed for the day rather than random per render: a card
 * that changes when somebody scrolls away and back is a card nobody trusts.
 * Seeded off the date so it is the same all day and different tomorrow. */
function pick(d) {
  const pool = CARDS[d.which][clamp(d.level) - 1];
  let h = 0;
  const seed = today() + ":" + d.level + ":" + d.which;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const seen = new Set(d.seen || []);
  for (let i = 0; i < pool.length; i++) {
    const c = pool[(h + i) % pool.length];
    if (!seen.has(c.q)) return c;
  }
  return pool[h % pool.length];
}

/* THE VOICE. The browser's own, as on the test — free, offline, no key on a
 * public page — and the button is only offered where a voice for the language
 * exists, because a control that does nothing is worse than no control. */
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
function voiceFor(tag) {
  if (!canSpeak()) return null;
  const want = tag.slice(0, 2).toLowerCase();
  const all = window.speechSynthesis.getVoices() || [];
  return all.find((v) => String(v.lang || "").toLowerCase().startsWith(want)) || null;
}
function say(text, tag) {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = tag;
    const v = voiceFor(tag);
    if (v) u.voice = v;
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  } catch { /* an object without a voice behind it */ }
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
};

/** Whether today's card has been answered, for the summary line above it. */
export function dailyDone() {
  const d = deck();
  return d.done === today();
}

/** The card, or null when there is nothing to draw at this level.
 *  `bare` drops the mark and the name, for when it is drawn inside a section
 *  that already carries both — one voice introducing itself twice reads as
 *  two. */
export function dailyCard(bare) {
  let d = deck();
  if (!CARDS[d.which] || !CARDS[d.which][clamp(d.level) - 1]) return null;

  const box = el("section", "daily");
  const tag = d.which === "zh" ? "zh-CN" : "en-US";
  /* Kept out here rather than in draw(), so opening the explanation and then
     answering the card does not fold it shut again underneath somebody. */
  let aboutOpen = false;

  const draw = () => {
    box.textContent = "";
    const answered = d.done === today();
    /* The card they answered, not a fresh pick. Picking again after an answer
       drew a different word on the same screen: the word had gone into `seen`,
       so the day's card changed the moment somebody said they knew it. */
    const card = answered && d.card ? d.card : pick(d);

    const head = el("div", "dhead");
    if (!bare) {
      const disc = el("i", "dmark", "换");
      disc.setAttribute("aria-hidden", "true");
      head.append(disc);
    }
    const who = el("div", "dwho");
    /* The name comes from house.name, the same string the feed marks a house
       post with — so this card is The Professor everywhere the rest of the app
       is, and a rename happens in one place rather than two. Dropped entirely
       when the section around it has already said it. */
    who.append(el("b", null, bare ? T("day.today")
      : T("house.name") + " \u00b7 " + T("day.today")));
    who.append(el("span", null, T("day.atLevel", { n: clamp(d.level) })));
    head.append(who);

    /* WHAT IS THIS. A card that appears at the top of somebody's feed showing
       them a word, with no explanation, is a card they scroll past. The answer
       is three sentences and it is read once, so it folds away — and the
       question mark is a real button rather than an icon, because at this size
       an icon is a smudge somebody has to guess at. */
    const ask = el("button", "dask", "?");
    ask.type = "button";
    ask.setAttribute("aria-label", T("day.what"));
    ask.title = T("day.what");
    ask.setAttribute("aria-expanded", String(aboutOpen));
    head.append(ask);
    box.append(head);

    const about = el("div", "dabout");
    about.hidden = !aboutOpen;
    about.append(el("p", null, T("day.about1")));
    about.append(el("p", null, T("day.about2")));
    about.append(el("p", null, T("day.about3")));
    ask.addEventListener("click", () => {
      aboutOpen = !aboutOpen;
      about.hidden = !aboutOpen;
      ask.setAttribute("aria-expanded", String(aboutOpen));
    });
    box.append(about);

    box.append(el("p", "dword", card.q));

    /* BEFORE THE ANSWER, two things to do with the word: hear it, or give up
       and be told. Nothing here is marked until they have seen it — a card
       that asks "did you know it?" before showing the answer is asking
       somebody to grade a memory they have not checked. */
    if (!answered) {
      const acts = el("div", "dacts");
      if (voiceFor(tag)) {
        const hear = el("button", "dquiet", T("lvl.hear"));
        hear.type = "button";
        hear.addEventListener("click", () => say(card.q, tag));
        acts.append(hear);
      }
      const show = el("button", "dgo", T("day.show"));
      show.type = "button";
      show.addEventListener("click", () => {
        acts.remove();
        box.append(answerBlock(card, true));
      });
      acts.append(show);
      box.append(acts);
    } else {
      box.append(answerBlock(card, false));
    }
  };

  const answerBlock = (card, asking) => {
    const wrap = el("div", "dans");
    wrap.append(el("p", "dmean", card.a));

    if (asking) {
      const row = el("div", "dacts");
      const knew = el("button", "dgo", T("day.knew"));
      knew.type = "button";
      knew.addEventListener("click", () => mark(card, true));
      const not = el("button", "dquiet", T("day.didnt"));
      not.type = "button";
      not.addEventListener("click", () => mark(card, false));
      row.append(knew, not);
      wrap.append(row);
      return wrap;
    }

    /* AFTER. What today's answer did to the deck, said once and plainly, then
       what tomorrow holds. The streak is the only number here: it is the one
       thing somebody is building. */
    if (d.moved === "up") wrap.append(el("p", "dmoved", T("day.up")));
    if (d.moved === "down") wrap.append(el("p", "dmoved down", T("day.down")));
    if (d.run) wrap.append(el("p", "dstreak", T("day.streak", { n: d.run })));
    wrap.append(el("p", "ddone", T("day.done")));

    /* THE ONE THING THE CARDS CANNOT DO FOR THEM. Two levels above the test is
       where a self-marked streak stops being evidence, so this is where the
       test is offered again rather than the mark being quietly raised. */
    const test = read(LEVELKEY);
    const tested = test && test.which === d.which ? Number(test.level) || 0 : 0;
    if (!tested) {
      const a = el("a", "dlink", T("day.takeTest"));
      a.href = "/level";
      wrap.append(el("p", "dnote", T("day.noTest", { n: clamp(d.level) })), a);
    } else if (clamp(d.level) >= tested + 2) {
      const a = el("a", "dlink", T("day.takeTest"));
      a.href = "/level";
      wrap.append(el("p", "dnote", T("day.retest")), a);
    }

    wrap.append(el("p", "donly", T("day.only")));
    return wrap;
  };

  const mark = (card, knew) => {
    const was = clamp(d.level);
    const run = knew ? (d.run || 0) + 1 : 0;
    // Three in a row moves the deck up; one miss drops it back. Not a score —
    // a thermostat, which is what a deck that has to stay readable needs.
    let level = was;
    if (knew && run >= 3) level = clamp(was + 1);
    if (!knew) level = clamp(was - 1);
    d = {
      ...d,
      level,
      run: level === was ? run : 0,
      done: today(),
      moved: level > was ? "up" : level < was ? "down" : "",
      card: { q: card.q, a: card.a },
      seen: [card.q, ...(d.seen || [])].slice(0, 12),
    };
    write(KEY, d);
    draw();
    /* A mark that changed is worth saying out loud, once, under the card —
       the deck level is not the public mark, so this says what it is: the
       cards have moved into the next band. */
    if (d.moved === "up" && Math.ceil(level / 2) !== Math.ceil(was / 2)) {
      const un = el("div", "dband");
      // The crowns are off — see off.js.
      if (!OFF.crowns) {
        un.append(crownMark(Math.ceil(level / 2), "1.4rem"));
        un.append(el("span", null, T("day.band", { name: stageName(Math.ceil(level / 2)) })));
      }
      box.append(un);
    }
  };

  draw();
  return box;
}
