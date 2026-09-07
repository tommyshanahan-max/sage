/* Ten levels, found in four questions.
 *
 * WHY FOUR AND NOT THIRTY. Ten levels needs log2(10) ≈ 3.3 answers to pin one
 * of them, so the search starts in the middle and halves what is left each
 * time: right goes up, wrong goes down, and after four there is one level
 * standing. Working up from level one instead would mean twenty-six questions
 * somebody was always going to get right before reaching the one that told us
 * anything.
 *
 * THREE CARDS PER LEVEL, ONE ASKED. The pool means a second attempt is not the
 * same four cards, and it means a single badly-written item cannot own a whole
 * level.
 *
 * WHAT A LEVEL MEANS is written down beside it rather than left to the number.
 * "Level 6" says nothing on its own; "can read a menu and argue about a bill"
 * is the thing somebody actually wants to know about themselves.
 *
 * These are a first draft. Nobody has checked that level 6 is harder than
 * level 5 for a real person rather than for the person who wrote them, and the
 * ordering is the whole instrument — so this needs an hour from somebody who
 * teaches this before it ranks anybody.
 */

/** [en, zh] everywhere, the same pair idiom as i18n.js. */
export const BANDS = {
  zh: [
    ["Beginner", "入门"],
    ["Beginner", "入门"],
    ["Elementary", "初级"],
    ["Elementary", "初级"],
    ["Intermediate", "中级"],
    ["Intermediate", "中级"],
    ["Upper intermediate", "中高级"],
    ["Upper intermediate", "中高级"],
    ["Advanced", "高级"],
    ["Advanced", "高级"],
  ],
  en: [
    ["Beginner", "入门"],
    ["Beginner", "入门"],
    ["Elementary", "初级"],
    ["Elementary", "初级"],
    ["Intermediate", "中级"],
    ["Intermediate", "中级"],
    ["Upper intermediate", "中高级"],
    ["Upper intermediate", "中高级"],
    ["Advanced", "高级"],
    ["Advanced", "高级"],
  ],
};

/** What somebody at this level can do, which is the useful half of a result. */
export const CAN = {
  zh: [
    ["Say hello and order a coffee.", "打招呼，点杯咖啡。"],
    ["Numbers, prices, asking where something is.", "数字、价钱、问路。"],
    ["Get through a shop or a taxi on your own.", "自己搞定买东西和打车。"],
    ["Hold a short conversation about your day.", "能聊几句今天做了什么。"],
    ["Read most of a menu. Explain a problem.", "菜单基本能看懂，能说清楚问题出在哪。"],
    ["Argue about a bill. Follow a group chat.", "能为账单争两句，群里聊天跟得上。"],
    ["Follow a lecture with effort. Read signs and notices.", "上课能跟上，通知和告示看得懂。"],
    ["Say what you mean, not just what you can.", "想说什么就说什么，不再是会说什么说什么。"],
    ["Idioms, jokes, and the way people actually talk.", "成语、玩笑，和大家真正说话的样子。"],
    ["Read a contract and know what you are signing.", "合同看得懂，知道自己签的是什么。"],
  ],
  en: [
    ["Say hello and order a coffee.", "打招呼，点杯咖啡。"],
    ["Numbers, prices, asking where something is.", "数字、价钱、问路。"],
    ["Get through a shop or a taxi on your own.", "自己搞定买东西和打车。"],
    ["Hold a short conversation about your day.", "能聊几句今天做了什么。"],
    ["Read most of an email. Explain a problem.", "邮件基本看得懂，能说清楚问题出在哪。"],
    ["Follow a seminar. Disagree politely.", "研讨课跟得上，能礼貌地反驳。"],
    ["Write an assignment without help.", "作业能自己写完。"],
    ["Say what you mean, not just what you can.", "想说什么就说什么，不再是会说什么说什么。"],
    ["Idioms, jokes, and the way people actually talk.", "习语、玩笑，和大家真正说话的样子。"],
    ["Read a contract and know what you are signing.", "合同看得懂，知道自己签的是什么。"],
  ],
};

/* THE CARDS. Three per level; one is asked.
 *
 * `q` is what is shown, `a` is the right answer, `w` the two wrong ones. The
 * three are shuffled when drawn, so the right one is not always first, and the
 * wrong ones are plausible rather than silly — an option nobody would pick
 * makes a three-way choice into a coin flip.
 */
export const CARDS = {
  // Chinese, for somebody whose Chinese is being ranked. Answers in English.
  zh: [
    [ { q: "谢谢", a: "thank you", w: ["sorry", "goodbye"] },
      { q: "水", a: "water", w: ["fire", "rice"] },
      { q: "你好", a: "hello", w: ["how much", "not bad"] } ],

    [ { q: "多少钱？", a: "how much is it?", w: ["where is it?", "what is this?"] },
      { q: "明天", a: "tomorrow", w: ["yesterday", "this morning"] },
      { q: "老师", a: "teacher", w: ["student", "doctor"] } ],

    [ { q: "便宜一点", a: "a bit cheaper", w: ["one more please", "a bit later"] },
      { q: "地铁站", a: "metro station", w: ["bus stop", "car park"] },
      { q: "我忘了", a: "I forgot", w: ["I am late", "I am lost"] } ],

    [ { q: "习惯了", a: "used to it now", w: ["learned it", "gave up on it"] },
      { q: "差不多", a: "close enough", w: ["completely wrong", "much better"] },
      { q: "打折", a: "on sale", w: ["sold out", "broken"] } ],

    [ { q: "顺便", a: "while you are at it", w: ["on purpose", "by mistake"] },
      { q: "麻烦你了", a: "sorry to trouble you", w: ["thank you very much", "see you tomorrow"] },
      { q: "不用客气", a: "no need to be polite", w: ["do not touch that", "no time today"] } ],

    [ { q: "靠谱", a: "reliable", w: ["expensive", "nearby"] },
      { q: "凑合", a: "it will do", w: ["it is perfect", "it is broken"] },
      { q: "到底怎么回事", a: "what actually happened", w: ["how do I get there", "when does it finish"] } ],

    [ { q: "将就一下", a: "make do for now", w: ["hurry up a bit", "think it over"] },
      { q: "心里有数", a: "I know where I stand", w: ["I have no idea", "I counted them"] },
      { q: "说不准", a: "hard to say", w: ["definitely not", "say it again"] } ],

    [ { q: "一言难尽", a: "it is a long story", w: ["say it in one word", "nothing to say"] },
      { q: "心血来潮", a: "on a whim", w: ["after long thought", "under pressure"] },
      { q: "将心比心", a: "put yourself in their place", w: ["compare the two", "speak from the heart"] } ],

    [ { q: "潜移默化", a: "changed gradually without noticing", w: ["changed overnight", "refused to change"] },
      { q: "得不偿失", a: "not worth what it cost", w: ["a bargain", "broke even"] },
      { q: "顺其自然", a: "let it take its course", w: ["force the issue", "follow the rules"] } ],

    [ { q: "未雨绸缪", a: "prepare before the trouble comes", w: ["fix it afterwards", "wait for rain"] },
      { q: "画蛇添足", a: "ruin it by overdoing it", w: ["finish what you started", "draw from life"] },
      { q: "塞翁失马", a: "a loss may turn out well", w: ["a lucky escape", "a horse ran away"] } ],
  ],

  // English, for somebody whose English is being ranked. Answers in Chinese.
  en: [
    [ { q: "water", a: "水", w: ["火", "米"] },
      { q: "thank you", a: "谢谢", w: ["对不起", "再见"] },
      { q: "book", a: "书", w: ["笔", "桌子"] } ],

    [ { q: "hungry", a: "饿了", w: ["累了", "冷了"] },
      { q: "cheap", a: "便宜", w: ["贵", "远"] },
      { q: "tomorrow", a: "明天", w: ["昨天", "今天早上"] } ],

    [ { q: "borrow", a: "借", w: ["买", "扔"] },
      { q: "crowded", a: "很挤", w: ["很空", "很吵"] },
      { q: "on time", a: "准时", w: ["迟到", "提前"] } ],

    [ { q: "deadline", a: "截止时间", w: ["开始时间", "上课时间"] },
      { q: "afford", a: "买得起", w: ["用得上", "找得到"] },
      { q: "whether", a: "是否", w: ["天气", "无论"] } ],

    [ { q: "get by", a: "勉强过得去", w: ["路过", "拿到手"] },
      { q: "put off", a: "推迟", w: ["穿上", "关掉"] },
      { q: "make sense", a: "说得通", w: ["有意义地做", "感觉良好"] } ],

    [ { q: "take it for granted", a: "觉得理所当然", w: ["非常感激", "拿走不还"] },
      { q: "run out of", a: "用完了", w: ["跑出去", "运行中"] },
      { q: "look into it", a: "去查一下", w: ["往里看", "照顾它"] } ],

    [ { q: "tedious", a: "枯燥乏味", w: ["紧张刺激", "十分危险"] },
      { q: "bound to happen", a: "一定会发生", w: ["被迫发生", "不太可能"] },
      { q: "feasible", a: "可行", w: ["可怕", "免费"] } ],

    [ { q: "a stopgap", a: "临时顶一下的办法", w: ["彻底的解决办法", "一个缺口"] },
      { q: "run-of-the-mill", a: "很普通", w: ["磨坊里跑的", "非常出色"] },
      { q: "hedge your bets", a: "两边都留一手", w: ["全押一注", "修剪树篱"] } ],

    [ { q: "ubiquitous", a: "到处都是", w: ["独一无二", "含糊不清"] },
      { q: "tentative", a: "暂定的", w: ["确定的", "第十个"] },
      { q: "mitigate", a: "减轻", w: ["加重", "迁移"] } ],

    [ { q: "a moot point", a: "已经没有意义的争论", w: ["最关键的一点", "刚提出的观点"] },
      { q: "by and large", a: "总的来说", w: ["越来越大", "在旁边"] },
      { q: "a paradigm shift", a: "根本思路的转变", w: ["一次小改动", "一段平行时间"] } ],
  ],
};

/* THE SEARCH.
 *
 * Start in the middle of ten. Each answer halves what is left — right and the
 * floor rises, wrong and the ceiling falls — and the level asked is the middle
 * of whatever remains. Four answers leave one level standing.
 *
 * The state is (low, high, asked). It is kept out of the page because it is
 * the only part of this worth testing on its own.
 */
export const STEPS = 4;

export function firstStep() {
  return { low: 1, high: 10, level: 5, asked: 0, right: 0 };
}

export function nextStep(s, wasRight) {
  const low = wasRight ? s.level + 1 : s.low;
  const high = wasRight ? s.high : s.level - 1;
  const asked = s.asked + 1;
  const right = s.right + (wasRight ? 1 : 0);
  // Nowhere left to go, or out of questions: the answer is the top of what
  // survived, floored at one — somebody who missed the very first card is a
  // one, not a nothing.
  if (asked >= STEPS || low > high) {
    return { done: true, level: Math.max(1, Math.min(10, wasRight ? s.level : s.level - 1)),
             low, high, asked, right };
  }
  return { low, high, level: Math.floor((low + high) / 2), asked, right, done: false };
}
