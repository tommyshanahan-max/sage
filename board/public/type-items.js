/* The type sort: twenty forced choices, five per axis.
 *
 * Ported from Fern, where it was written fresh from the underlying constructs.
 * Nothing here is adapted from any published questionnaire — the official
 * instrument's items are copyrighted, and cloning it was never the point.
 *
 * THE RULES THE ITEMS FOLLOW, and why:
 *
 *  - CONCRETE SITUATIONS, not self-description. "An evening on your own with
 *    the door shut" rather than "I am an introvert". People are poor at rating
 *    their own traits and much better at saying which of two Saturdays they
 *    would rather have.
 *  - BOTH SIDES ATTRACTIVE. Neither option may read as the better person. The
 *    moment one side flatters, the item measures self-image instead of
 *    preference — the failure that makes most online type tests worthless.
 *  - NO MIDDLE. A forced choice is what makes the result worth anything, and
 *    it is why this takes two minutes.
 *  - ORDER SHUFFLED at runtime, and `a` is not always the same pole — see
 *    aPole. Otherwise a pattern-spotter answers the layout, not the question.
 *
 * WHAT PORTING THEM COST. Fern's file says plainly that these are a first
 * draft by a model and that a person edits them before they measure anyone.
 * That has not happened yet. They are here in the same state.
 *
 * The Chinese is not a gloss of the English. Several of these say a slightly
 * different thing in each language because the situation has to land, not the
 * sentence — an evening with the door shut is not the picture that means this
 * to somebody reading in Chinese.
 */

/** [en, zh], the same pair idiom as i18n.js: a half-written item is visible in
 *  the same line of the same diff. */
export const AXES = {
  EI: { first: ["Extraverted", "外向"], second: ["Introverted", "内向"] },
  SN: { first: ["Sensing", "实感"], second: ["Intuition", "直觉"] },
  TF: { first: ["Thinking", "思考"], second: ["Feeling", "情感"] },
  JP: { first: ["Judging", "计划"], second: ["Perceiving", "随机"] },
};

export const ITEMS = [
  {
    id: "ei1", axis: "EI",
    prompt: ["After a long week, which pulls harder?", "累了一周，你更想要哪个？"],
    a: ["An evening on your own, door shut", "一个人待着，把门关上"], aPole: "I",
    b: ["People around, noise, someone to talk to", "屋里有人，有点热闹，有人说话"], bPole: "E",
  },
  {
    id: "ei2", axis: "EI",
    prompt: ["You have had an idea you like. What happens next?", "你有了个不错的想法。接下来呢？"],
    a: ["You say it out loud to someone and find out what it is", "先说给别人听，边说边想清楚"], aPole: "E",
    b: ["You sit with it a while before anyone hears about it", "自己先放一放，想明白再说"], bPole: "I",
  },
  {
    id: "ei3", axis: "EI",
    prompt: ["A party where you know three people out of thirty.", "一个聚会，三十个人里你只认识三个。"],
    a: ["You find the three and stay put", "找到那三个，就待在那儿"], aPole: "I",
    b: ["You end up talking to strangers most of the night", "一晚上大半时间在跟不认识的人聊"], bPole: "E",
  },
  {
    id: "ei4", axis: "EI",
    prompt: ["Which drains you faster?", "哪个更让你累？"],
    a: ["A day entirely alone", "一整天一个人"], aPole: "E",
    b: ["A day of back-to-back people", "一整天不停地见人"], bPole: "I",
  },
  {
    id: "ei5", axis: "EI",
    prompt: ["Something has gone wrong. First instinct?", "出事了，你第一反应是？"],
    a: ["Call someone and talk it through", "找个人说说，边说边理"], aPole: "E",
    b: ["Work out what you think before you tell anyone", "先自己想明白，再跟别人讲"], bPole: "I",
  },

  {
    id: "sn1", axis: "SN",
    prompt: ["Someone describes a plan. What do you notice?", "别人讲一个计划，你先注意到什么？"],
    a: ["Whether the details actually add up", "细节对不对得上"], aPole: "S",
    b: ["What it could turn into", "这事以后能变成什么样"], bPole: "N",
  },
  {
    id: "sn2", axis: "SN",
    prompt: ["Which is the better compliment?", "哪句夸你更受用？"],
    a: ["You are very observant", "你观察得真细"], aPole: "S",
    b: ["You are very imaginative", "你想象力真好"], bPole: "N",
  },
  {
    id: "sn3", axis: "SN",
    prompt: ["Learning something new, you would rather", "学新东西，你更愿意"],
    a: ["start with what it is for and work outward", "先弄清楚它是干嘛的，再往下展开"], aPole: "N",
    b: ["start at step one and go in order", "从第一步开始，按顺序来"], bPole: "S",
  },
  {
    id: "sn4", axis: "SN",
    prompt: ["A conversation drifts into speculation.", "聊着聊着开始瞎猜起来。"],
    a: ["You enjoy it and go further out", "你聊得挺来劲，越扯越远"], aPole: "N",
    b: ["You want to get back to what is actually true", "你想拉回来，说点确定的"], bPole: "S",
  },
  {
    id: "sn5", axis: "SN",
    prompt: ["Describing a room you were in yesterday, you remember", "说起昨天待过的一个房间，你记得的是"],
    a: ["the specifics — colours, where things were", "具体的东西——什么颜色、东西摆在哪"], aPole: "S",
    b: ["the atmosphere, and what it reminded you of", "那个氛围，还有它让你想起什么"], bPole: "N",
  },

  {
    id: "tf1", axis: "TF",
    prompt: ["A friend made a decision you think is wrong.", "朋友做了个你觉得不对的决定。"],
    a: ["You tell them plainly what you think", "你直接说你的看法"], aPole: "T",
    b: ["You work out where they are before saying anything", "先弄清楚他现在什么状态，再开口"], bPole: "F",
  },
  {
    id: "tf2", axis: "TF",
    prompt: ["Which mistake would bother you more?", "哪种错更让你难受？"],
    a: ["Being unfair to someone", "对人不公平"], aPole: "F",
    b: ["Being wrong about something", "把事情弄错了"], bPole: "T",
  },
  {
    id: "tf3", axis: "TF",
    prompt: ["Settling an argument between two people, you look for", "给两个人劝架，你看的是"],
    a: ["who has the better case", "谁更有道理"], aPole: "T",
    b: ["what each of them actually needs", "他们各自到底想要什么"], bPole: "F",
  },
  {
    id: "tf4", axis: "TF",
    prompt: ["You are given feedback. What lands?", "别人给你提意见，你在意的是"],
    a: ["Whether it is accurate", "说得对不对"], aPole: "T",
    b: ["How it was said", "话是怎么说的"], bPole: "F",
  },
  {
    id: "tf5", axis: "TF",
    prompt: ["A rule produces an unkind outcome in one case.", "有条规定，在某个情况下显得不近人情。"],
    a: ["The rule is still the rule", "规定就是规定"], aPole: "T",
    b: ["Then the rule is wrong for this case", "那这条规定就不该用在这件事上"], bPole: "F",
  },

  {
    id: "jp1", axis: "JP",
    prompt: ["A free Saturday, nothing booked.", "周六空着，什么都没安排。"],
    a: ["You would rather have a plan by Friday night", "你希望周五晚上就定好干什么"], aPole: "J",
    b: ["You would rather see how you feel on the day", "你更想当天看心情"], bPole: "P",
  },
  {
    id: "jp2", axis: "JP",
    prompt: ["Which is more uncomfortable?", "哪个更难受？"],
    a: ["A decision made too early", "太早就把事定死了"], aPole: "P",
    b: ["A decision left hanging", "事情一直悬着没定"], bPole: "J",
  },
  {
    id: "jp3", axis: "JP",
    prompt: ["Work with a deadline three weeks out.", "一个三周后交的活。"],
    a: ["Steady from the start, done before the end", "一开始就稳着做，提前做完"], aPole: "J",
    b: ["Gathers pace as it gets close", "越接近截止越有劲"], bPole: "P",
  },
  {
    id: "jp4", axis: "JP",
    prompt: ["Halfway through, a better approach appears.", "做到一半，发现有个更好的办法。"],
    a: ["Finish this way, note it for next time", "先按原来的做完，记下来下次用"], aPole: "J",
    b: ["Change course now", "现在就改"], bPole: "P",
  },
  {
    id: "jp5", axis: "JP",
    prompt: ["Travelling somewhere new, you would rather", "去一个没去过的地方，你更愿意"],
    a: ["have the days roughly mapped", "大致把每天安排好"], aPole: "J",
    b: ["arrive and work it out there", "到了再说"], bPole: "P",
  },
];

/* A NAME FOR EACH OF THE SIXTEEN, and why a name is allowed where a drawn
 * character is not.
 *
 * A title labels a code the page already shows. It asserts nothing the four
 * letters do not already assert, and it inherits their caveat — including the
 * one that says the weakest letter may come out differently another day. An
 * illustrated character asserts a personality with a confidence that cannot be
 * qualified: you cannot draw "your thinking-feeling lean is close to the
 * middle" on a face.
 *
 * Our own set. The Executive, the Logician, the Advocate and the rest are
 * another product's naming, and borrowing it would make this a copy of the
 * thing it is trying not to be. These describe the combination rather than
 * flattering the person: an organiser organises, which is a behaviour the four
 * choices actually point at, where "the Executive" is a job title and a
 * compliment.
 */
export const TITLES = {
  ISTJ: ["The Steady Hand", "稳当的人"],
  ISFJ: ["The Quiet Keeper", "默默照应的人"],
  INFJ: ["The Long View", "看得远的人"],
  INTJ: ["The Planner", "谋划的人"],
  ISTP: ["The Fixer", "会修东西的人"],
  ISFP: ["The Maker", "动手做的人"],
  INFP: ["The Idealist", "心里有理想的人"],
  INTP: ["The Puzzler", "爱琢磨的人"],
  ESTP: ["The Mover", "说干就干的人"],
  ESFP: ["The Spark", "带气氛的人"],
  ENFP: ["The Enthusiast", "有热情的人"],
  ENTP: ["The Challenger", "爱挑战的人"],
  ESTJ: ["The Organiser", "会组织的人"],
  ESFJ: ["The Host", "招呼大家的人"],
  ENFJ: ["The Rallier", "能带动人的人"],
  ENTJ: ["The Driver", "领头的人"],
};

/* HOW FAR FROM THE MIDDLE, IN WORDS, NEVER AS A PERCENTAGE.
 *
 * Five items per axis, so there are exactly three splits: 5-0, 4-1 and 3-2.
 * Three words, one for each. A percentage would imply a precision five forced
 * choices cannot possibly carry. */
export const STRENGTH = {
  clear: ["Clear", "很明显"],
  leans: ["Leans that way", "偏这边"],
  middle: ["Close to the middle", "几乎在正中间"],
};

/* SCORING: positions first, letters second, and that order is the whole design.
 *
 * Every other type test computes a letter and shows you the letter. This
 * computes a position on each axis, shows the position, and offers the letters
 * as a rounding of it — with the weakest axis named, because that is the one
 * most likely to come out differently another day.
 *
 * That is not a hedge. Test-retest on four-letter typologies is genuinely
 * poor, and the reason is visible right here: an axis answered 3-2 produces a
 * letter as confidently as one answered 5-0, and nothing downstream can tell
 * them apart. Reporting the lean keeps the difference the instrument found.
 */
export function score(choices) {
  const axes = [];
  for (const axis of ["EI", "SN", "TF", "JP"]) {
    const items = ITEMS.filter((i) => i.axis === axis);
    const answered = items.filter((i) => choices[i.id]);
    if (!answered.length) return null;

    const second = axis[1];
    const toSecond = answered.filter((i) => choices[i.id] === second).length;
    const position = toSecond / answered.length;
    const distance = Math.abs(position - 0.5) * 2;

    axes.push({
      axis,
      position,
      letter: position >= 0.5 ? second : axis[0],
      // 5-0 is 1, 4-1 is 0.6, 3-2 is 0.2.
      strength: distance > 0.8 ? "clear" : distance > 0.4 ? "leans" : "middle",
      n: Math.max(toSecond, answered.length - toSecond),
      of: answered.length,
    });
  }

  const weakest = axes.reduce((a, b) =>
    Math.abs(a.position - 0.5) <= Math.abs(b.position - 0.5) ? a : b);

  return {
    at: new Date().toISOString(),
    axes,
    code: axes.map((a) => a.letter).join(""),
    weakest: weakest.axis,
    // True when one axis sits close enough to the middle that the TITLE would
    // change on a different day. Letters degrade gracefully — a soft T/F means
    // one letter is soft and the other three still stand. A title does not:
    // ESTJ to ESFJ is not a nudge, it is a different name.
    unstable: axes.some((a) => Math.abs(a.position - 0.5) * 2 < 0.25),
  };
}
