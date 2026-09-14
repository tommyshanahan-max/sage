/* PROTOTYPE — THE 50,000 LEDGER, PINNED TO THE TOP OF A DOOR ROOM.
 *
 * Not for the box. Every member has a place number from the day their page
 * went up; the place is worth points on a sliding scale, and what they do adds
 * more. If the board reaches the goal, the company intends to make a share
 * offer to everybody on the ledger, allocated by points. Until then points are
 * a record and nothing more, and the pin never shows a sum of money.
 *
 * FIVE VIEWS INSIDE ONE PIN, because the room is where people are and a
 * separate page is a page nobody opens: the overview, the rules, joining, what
 * happens at the goal, and what has been recorded. Each view has a heading and
 * focus moves to it, so a screen reader always knows where it has landed.
 *
 * All the arithmetic is on the server (/api/ledger/pin). This file prints it.
 */

import { lang } from "/i18n.js";

const S = {
  en: {
    ledger: "Your ledger", place: "place #{n}", proto: "Prototype", points: "{n} points",
    counts: "Counts toward a share offer at {goal}", onLedger: "On the ledger",
    ofGoal: "of {goal}", membersWord: "members",
    noPlace: "No place yet", noPlaceSub: "You get a place on the ledger the day you're let in.",
    hOverview: "Your place on the ledger", hRules: "The rules, in plain words", hJoin: "Join the ledger",
    hOffer: "A share offer, for people on the ledger", hRecord: "What's recorded",
    placeRow: "Place #{n}", placeSub: "fixed the day you joined",
    doneRow: "What you've done", doneSub: "Points from what you do keep counting until {date}.", total: "Total",
    guests: "{n} people you brought in who stayed", guestsCap: "{n} people you brought in who stayed (first {cap} count)",
    cards: "{n} introductions that landed", heard: "{n} people who answered you", weeks: "{n} active weeks",
    scale: "The sliding scale", scaleNote: "The highlighted box is the band your place is in.",
    share: "Your share of the pool", shareLine: "from your place, and it never falls",
    shareRest: "Plus a share of the other {rest}%, from what everyone did, fixed on {date}.",
    toward: "Toward {goal}", towardLine: "members, by {date}",
    ifYes: "If {goal} is reached", ifYesP: "The company intends to make a share offer to everyone on the ledger, allocated by points, with its own offer document.",
    ifNo: "If it isn't", ifNoP: "Points stay a record of who built the board. No shares are offered.",
    readRules: "Read the rules", join: "Join the ledger", atGoal: "What happens at {goal}", seeRecord: "What's recorded", back: "Back",
    r1t: "Points aren't shares", r1: "They have no cash value, can't be sold or transferred, and aren't a promise of shares.",
    r2t: "How you earn them", r2: "Your place number, on the sliding scale. Then people you brought in who stayed and posted (the first {cap} count), introductions that landed, people who answered you, and active weeks.",
    r3t: "What the company intends", r3: "If the board reaches {goal} members by {by}, to offer shares to everyone on the ledger, allocated by points. The offer will have its own document and its own terms.",
    r4t: "The pool", r4: "{split}% split by place, fixed when you join. {rest}% split by what people did, fixed on {cutoff}.",
    r5t: "If the rules change", r5: "Points you've already earned are kept. You'll be told before any change.",
    r6t: "Mistakes", r6: "Points given in error, or earned by gaming the rules, can be corrected.",
    r7t: "It may never happen", r7: "The board may not reach {goal}. The company may fail. Nothing is owed if it doesn't happen.",
    joinFine: "You're not signing for shares. Nothing is being promised yet, so there's no legal name to type. You're agreeing to the points rules.",
    where: "Where do you live?", choose: "Choose one", hk: "Hong Kong", cn: "Mainland China", else: "Somewhere else",
    whereHk: "You earn points the same as everyone.",
    whereCn: "You earn points the same as everyone. If an offer happens, people in mainland China may need a different route to take part, and you'll be told directly.",
    whereElse: "You earn points the same as everyone. Whether you can take part in an offer depends on the rules where you live.",
    agree: "I understand points aren't shares and have no cash value.",
    joinedSay: "You're on the ledger.", joinFail: "That didn't go through. Try again.",
    future: "This only opens if the board reaches {goal}. It's here so you can see where shares and signatures come in.",
    cutoffPts: "Your points at the cut-off", alloc: "Your allocation", allocSub: "worked out from your points", price: "Price",
    inOffer: "[set in the offer]", sharesPh: "[shares]", readOffer: "The offer document",
    legal: "Type your full legal name", o1: "I've read the offer document.", o2: "I understand the shares may lose value or be worth nothing.",
    cool: "You'll be able to change your mind within 14 days.", take: "Take up the offer", notOpen: "Not open: the board hasn't reached {goal}.",
    recPlace: "Place", recPts: "Points today", recRules: "Rules", recJoined: "Joined the ledger", recWhere: "Lives in",
    recOffer: "Share offer", recOfferV: "Only if {goal} is reached", notYet: "Not yet", notGiven: "Not given",
    sealed: "Sealed at the end of each month, so the record can't be quietly changed.",
    roomSees: "What the room sees: {m} of {goal} members. Never your place, points or choices.",
    pin: "Your ledger: place {place}, {pts} points. {status}. {m} of {goal} members. Double-tap to open.",
    pinNo: "Your ledger: no place yet. You get one the day you're let in.",
    say: "The board now has {m} members.",
  },
  zh: {
    ledger: "你的账本", place: "第 {n} 位", proto: "原型", points: "{n} 分",
    counts: "达到 {goal} 人时计入认股", onLedger: "已加入账本",
    ofGoal: "/ {goal}", membersWord: "位成员",
    noPlace: "还没有位次", noPlaceSub: "被放进来的那天，你就会在账本上有一个位次。",
    hOverview: "你在账本上的位次", hRules: "规则，用大白话说", hJoin: "加入账本",
    hOffer: "给账本上的人的认股要约", hRecord: "记录了什么",
    placeRow: "第 {n} 位", placeSub: "加入那天就定下",
    doneRow: "你做过的事", doneSub: "你做的事带来的分数会一直累积到 {date}。", total: "合计",
    guests: "{n} 位你带进来并留下的人", guestsCap: "{n} 位你带进来并留下的人（前 {cap} 位计分）",
    cards: "{n} 次促成的引荐", heard: "{n} 个回复过你的人", weeks: "{n} 个活跃周",
    scale: "递减规则", scaleNote: "高亮的格子是你的位次所在区间。",
    share: "你在池子里的份额", shareLine: "来自你的位次，不会下降",
    shareRest: "另外 {rest}% 按大家做过的事分配，在 {date} 定下。",
    toward: "距离 {goal}", towardLine: "位成员，截止 {date}",
    ifYes: "如果达到 {goal}", ifYesP: "公司打算向账本上的每个人发出认股要约，按分数分配，并有单独的要约文件。",
    ifNo: "如果没有达到", ifNoP: "分数仍然记录着是谁建起了这个看板。不会有认股要约。",
    readRules: "阅读规则", join: "加入账本", atGoal: "达到 {goal} 时会怎样", seeRecord: "记录了什么", back: "返回",
    r1t: "分数不是股份", r1: "分数没有现金价值，不能出售或转让，也不是股份的承诺。",
    r2t: "怎么得分", r2: "你的位次，按递减规则计分。另外还有你带进来并留下发帖的人（前 {cap} 位计分）、促成的引荐、回复过你的人，以及活跃周。",
    r3t: "公司打算怎么做", r3: "如果看板在 {by} 之前达到 {goal} 位成员，公司打算向账本上的每个人发出认股要约，按分数分配。要约会有单独的文件和条款。",
    r4t: "池子", r4: "{split}% 按位次分配，加入时定下。{rest}% 按大家做过的事分配，在 {cutoff} 定下。",
    r5t: "如果规则改变", r5: "你已经得到的分数会保留。任何改变之前都会通知你。",
    r6t: "出错的情况", r6: "错发的分数，或者钻规则空子得到的分数，可以更正。",
    r7t: "也可能不会发生", r7: "看板可能达不到 {goal}。公司可能失败。如果没有发生，没有人欠你任何东西。",
    joinFine: "你不是在签认股协议。现在还没有任何承诺，所以不需要输入法定姓名。你只是同意分数规则。",
    where: "你住在哪里？", choose: "请选择", hk: "香港", cn: "中国大陆", else: "其他地方",
    whereHk: "你和所有人一样得分。",
    whereCn: "你和所有人一样得分。如果将来有认股要约，住在中国大陆的人可能需要不同的参与方式，我们会直接告诉你。",
    whereElse: "你和所有人一样得分。能否参与认股要约取决于你所在地的规定。",
    agree: "我明白分数不是股份，也没有现金价值。",
    joinedSay: "你已经加入账本。", joinFail: "没有成功，请再试一次。",
    future: "只有看板达到 {goal} 时才会开放。放在这里是为了让你看到股份和签名在哪一步出现。",
    cutoffPts: "截止时你的分数", alloc: "你的配额", allocSub: "按你的分数计算", price: "价格",
    inOffer: "［在要约中确定］", sharesPh: "［股数］", readOffer: "要约文件",
    legal: "输入你的法定全名", o1: "我已经读过要约文件。", o2: "我明白股份可能贬值，甚至一文不值。",
    cool: "你可以在 14 天内改变主意。", take: "接受要约", notOpen: "尚未开放：看板还没有达到 {goal}。",
    recPlace: "位次", recPts: "今天的分数", recRules: "规则", recJoined: "加入账本", recWhere: "居住地",
    recOffer: "认股要约", recOfferV: "只有达到 {goal} 才会有", notYet: "还没有", notGiven: "未填写",
    sealed: "每月底封存，所以记录不能被悄悄改动。",
    roomSees: "房间里看到的：{m} / {goal} 位成员。永远看不到你的位次、分数或选择。",
    pin: "你的账本：第 {place} 位，{pts} 分。{status}。{m} / {goal} 位成员。双击打开。",
    pinNo: "你的账本：还没有位次。被放进来的那天就会有。",
    say: "看板现在有 {m} 位成员。",
  },
};

const L = () => (lang() === "zh" ? "zh" : "en");
const T = (k, o = {}) => (S[L()][k] || "").replace(/\{(\w+)\}/g, (_, x) => (o[x] ?? ""));
const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const pct = (x) => (x >= 1 ? x.toFixed(2) : x >= 0.01 ? x.toFixed(3) : x.toFixed(4)) + "%";
const day = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return L() === "zh"
    ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
};
const el = (t, c, x) => {
  const n = document.createElement(t);
  if (c) n.className = c;
  if (x !== undefined) n.textContent = x;
  return n;
};

/* Kept across the room's twenty-second repaint: which view is open, what was
   half-filled in, and the last member count, so nothing snaps shut, loses a
   choice, or announces itself for no reason. */
const state = { open: false, view: "overview", where: "", agreed: false,
  name: "", o1: false, o2: false, lastM: null, sayTimer: 0, device: "", room: "", focusNext: false };

function styles() {
  if (document.getElementById("lpin-css")) return;
  const css = el("style");
  css.id = "lpin-css";
  css.textContent = `
  #tpin.lpin{position:sticky;z-index:15;margin:0 0 .9rem;padding:0;border:1px solid var(--line);
    border-radius:.8rem;background:var(--raise);box-shadow:0 6px 18px -10px rgba(21,27,40,.25);overflow:hidden}
  .lpin .lbtn{all:unset;box-sizing:border-box;display:grid;grid-template-columns:1fr auto;gap:.1rem .8rem;
    width:100%;padding:.7rem .9rem;cursor:pointer;align-items:center}
  .lpin .lbtn:focus-visible{outline:2px solid var(--accent);outline-offset:-3px;border-radius:.8rem}
  .lpin .lk{grid-column:1;display:flex;gap:.5rem;align-items:center;font-size:.64rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
  .lpin .lk i{font-style:normal;letter-spacing:.06em;border:1px solid var(--line);border-radius:99px;padding:0 .4rem}
  .lpin .lf{grid-column:1;font-family:var(--serif);font-size:1.55rem;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .lpin .lst{grid-column:1;display:flex;align-items:center;gap:.35rem;font-size:.76rem;color:var(--ink-2)}
  .lpin .lst i{width:7px;height:7px;border-radius:50%;background:var(--muted)}
  .lpin .lst i.on{background:#2A9D63}
  .lpin .ls{grid-column:2;grid-row:1 / span 3;display:flex;align-items:center;gap:.45rem;font-size:.72rem;color:var(--ink-2)}
  .lpin .ls .c{display:flex;flex-direction:column;align-items:flex-end;line-height:1.2;text-align:right}
  .lpin .ls .c b{font-size:.96rem;color:var(--ink);font-variant-numeric:tabular-nums}
  .lpin .ls svg{width:18px;height:18px;stroke:var(--muted);fill:none;stroke-width:2;transition:transform .25s ease}
  .lpin .lbtn[aria-expanded="true"] .ls svg{transform:rotate(180deg)}
  .lpin .lbody{padding:0 .9rem .95rem;display:grid;gap:.85rem;max-height:62vh;overflow-y:auto}
  .lpin h3{margin:0;font-family:var(--serif);font-weight:400;font-size:1.15rem;line-height:1.25}
  .lpin h3:focus{outline:none}
  .lpin .kk{margin:0 0 .3rem;font-size:.64rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
  .lpin p{margin:0}
  .lpin .soft{font-size:.84rem;color:var(--ink-2)}
  .lpin .tiny{font-size:.74rem;line-height:1.5;color:var(--muted)}
  .lpin .rows > div{display:grid;grid-template-columns:1fr auto;gap:.7rem;padding:.42rem 0;border-top:1px solid var(--hair);font-size:.82rem;font-variant-numeric:tabular-nums}
  .lpin .rows > div > span:first-child{color:var(--ink-2)}
  .lpin .rows > div > span:last-child{font-weight:600;color:var(--ink)}
  .lpin .rows .n{display:block;font-size:.7rem;color:var(--muted);font-weight:400}
  .lpin .rows > div.tot > span{color:var(--ink)}
  .lpin .scale{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;align-items:end;font-variant-numeric:tabular-nums}
  .lpin .mk{border:1px solid var(--line);border-radius:.5rem;padding:.3rem .35rem;background:var(--card)}
  .lpin .mk .w{font-size:.62rem;color:var(--muted)}
  .lpin .mk .v{font-family:var(--serif);line-height:1.1}
  .lpin .mk.you{border-color:var(--accent);background:var(--accent-soft)}
  .lpin .bar{height:6px;border-radius:99px;background:var(--hair);overflow:hidden;margin-top:.35rem}
  .lpin .bar i{display:block;height:100%;min-width:3px;background:var(--accent);border-radius:99px}
  .lpin .both{display:grid;grid-template-columns:1fr 1fr;gap:.45rem}
  .lpin .both div{border:1px solid var(--line);border-radius:.6rem;padding:.5rem .55rem;background:var(--card)}
  .lpin .both b{display:block;font-size:.78rem;margin-bottom:.1rem}
  .lpin .both span{font-size:.78rem;color:var(--ink-2)}
  .lpin dl{margin:0;border-top:1px solid var(--hair)}
  .lpin dl div{padding:.5rem 0;border-bottom:1px solid var(--hair)}
  .lpin dt{font-size:.8rem;font-weight:600}
  .lpin dd{margin:.1rem 0 0;font-size:.82rem;color:var(--ink-2)}
  .lpin .fine{border-radius:.6rem;padding:.55rem .65rem;font-size:.8rem;background:var(--accent-soft);border:1px solid var(--line)}
  .lpin .note{border-radius:.6rem;padding:.55rem .65rem;font-size:.8rem;background:var(--raise);border:1px dashed var(--line)}
  .lpin .future{border-radius:.6rem;padding:.55rem .65rem;font-size:.8rem;border:1px dashed #B8741F}
  .lpin .fld{display:grid;gap:.3rem}
  .lpin label.f{font-size:.82rem;font-weight:600}
  .lpin select,.lpin input[type=text]{font:inherit;font-size:.9rem;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:.55rem;padding:.5rem .6rem;width:100%;box-sizing:border-box}
  .lpin .chk{display:grid;grid-template-columns:20px 1fr;gap:.5rem;align-items:start;font-size:.84rem}
  .lpin .chk input{width:18px;height:18px;margin:.1rem 0 0;accent-color:var(--accent)}
  .lpin .acts{display:grid;gap:.45rem}
  .lpin .pb{font:inherit;font-size:.9rem;font-weight:600;border-radius:.65rem;padding:.6rem .8rem;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink,#fff);width:100%}
  .lpin .pb.g{background:var(--card);color:var(--ink);border-color:var(--line)}
  .lpin .pb[disabled]{opacity:.45;cursor:not-allowed}
  .lpin .rec > div{display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0;border-top:1px solid var(--hair);font-size:.82rem}
  .lpin .rec > div > span:first-child{color:var(--ink-2)}
  @media (prefers-reduced-motion:reduce){.lpin .ls svg{transition:none}}
  `;
  document.head.append(css);
}

function live(text) {
  let n = document.getElementById("lpin-live");
  if (!n) {
    n = el("div");
    n.id = "lpin-live";
    n.setAttribute("role", "status");
    n.setAttribute("aria-live", "polite");
    n.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
    document.body.append(n);
  }
  n.textContent = "";
  setTimeout(() => { n.textContent = text; }, 60);
}

function rows(pairs) {
  const box = el("div", "rows");
  for (const [left, right, sub, cls] of pairs) {
    const d = el("div", cls);
    const l = el("span", null, left);
    if (sub) l.append(el("span", "n", sub));
    d.append(l, el("span", null, right));
    box.append(d);
  }
  return box;
}

function button(text, cls, fn) {
  const b = el("button", "pb" + (cls ? " " + cls : ""), text);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}

let DATA = null;
let SLOT = null;

function show(view) {
  state.view = view;
  state.focusNext = true;
  draw();
}

/* ---- the views ---------------------------------------------------------- */

function overview(d) {
  const f = document.createDocumentFragment();
  f.append(el("h3", null, T("hOverview")));
  const actParts = d.parts.map((p) => [
    p.key === "guests"
      ? (p.n > d.guestCap ? T("guestsCap", { n: p.n, cap: d.guestCap }) : T("guests", { n: p.n }))
      : T(p.key, { n: p.n }),
    int(p.points),
  ]);
  f.append(rows([
    [T("placeRow", { n: int(d.place) }), int(d.placePoints), T("placeSub")],
    ...actParts,
    [T("total"), int(d.total), "", "tot"],
  ]));
  if (d.cutoff) f.append(el("p", "tiny", T("doneSub", { date: day(d.cutoff) })));

  const scaleWrap = el("div");
  scaleWrap.append(el("p", "kk", T("scale")));
  const sc = el("div", "scale");
  sc.setAttribute("role", "list");
  d.marks.forEach((m, i) => {
    const prev = i ? d.marks[i - 1].n : 0;
    const you = d.place <= m.n && d.place > prev;
    const box = el("div", "mk" + (you ? " you" : ""));
    box.setAttribute("role", "listitem");
    box.setAttribute("aria-label", `#${int(m.n)}: ${T("points", { n: int(m.points) })}${you ? " ←" : ""}`);
    box.append(el("div", "w", "#" + int(m.n)));
    const v = el("div", "v", int(m.points));
    v.style.fontSize = (1.15 - i * 0.08) + "rem";
    box.append(v);
    sc.append(box);
  });
  scaleWrap.append(sc, el("p", "tiny", T("scaleNote")));
  f.append(scaleWrap);

  const share = el("div");
  share.append(el("p", "kk", T("share")));
  const sl = el("p");
  sl.append(el("b", null, pct(d.placeShare)), el("span", "soft", " " + T("shareLine")));
  share.append(sl);
  if (d.cutoff) share.append(el("p", "tiny", T("shareRest", { rest: 100 - d.split, date: day(d.cutoff) })));
  f.append(share);

  const prog = el("div");
  prog.append(el("p", "kk", T("toward", { goal: int(d.goal) })));
  const pl = el("p");
  pl.append(el("b", null, int(d.members)), el("span", "soft", " " + T("towardLine", { date: day(d.by) })));
  const bar = el("div", "bar");
  const fillPct = Math.min(100, (d.members / d.goal) * 100);
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", fillPct.toFixed(2) + "%");
  const fillEl = el("i");
  fillEl.style.width = fillPct + "%";
  bar.append(fillEl);
  prog.append(pl, bar);
  f.append(prog);

  const both = el("div", "both");
  const a = el("div"); a.append(el("b", null, T("ifYes", { goal: int(d.goal) })), el("span", null, T("ifYesP")));
  const b = el("div"); b.append(el("b", null, T("ifNo")), el("span", null, T("ifNoP")));
  both.append(a, b);
  f.append(both);

  const acts = el("div", "acts");
  acts.append(button(T("readRules"), "", () => show("rules")));
  acts.append(d.joined
    ? button(T("seeRecord"), "g", () => show("record"))
    : button(T("join"), "g", () => show("join")));
  acts.append(button(T("atGoal", { goal: int(d.goal) }), "g", () => show("offer")));
  f.append(acts);
  return f;
}

function rules(d) {
  const f = document.createDocumentFragment();
  f.append(el("h3", null, T("hRules")));
  const dl = el("dl");
  const o = { cap: d.guestCap, goal: int(d.goal), by: day(d.by), split: d.split, rest: 100 - d.split, cutoff: day(d.cutoff) };
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    const row = el("div");
    row.append(el("dt", null, T("r" + n + "t", o)), el("dd", null, T("r" + n, o)));
    dl.append(row);
  }
  f.append(dl);
  const acts = el("div", "acts");
  if (!d.joined) acts.append(button(T("join"), "", () => show("join")));
  acts.append(button(T("back"), "g", () => show("overview")));
  f.append(acts);
  return f;
}

function join(d) {
  const f = document.createDocumentFragment();
  f.append(el("h3", null, T("hJoin")));
  f.append(el("p", "fine", T("joinFine")));

  const fld = el("div", "fld");
  const lab = el("label", "f", T("where"));
  lab.htmlFor = "lpin-where";
  const sel = el("select");
  sel.id = "lpin-where";
  for (const [v, k] of [["", "choose"], ["hk", "hk"], ["cn", "cn"], ["else", "else"]]) {
    const opt = el("option", null, T(k));
    opt.value = v;
    sel.append(opt);
  }
  sel.value = state.where;
  fld.append(lab, sel);
  f.append(fld);

  const note = el("p", "note");
  f.append(note);

  const chk = el("label", "chk");
  const box = el("input");
  box.type = "checkbox";
  box.id = "lpin-agree";
  box.checked = state.agreed;
  chk.append(box, el("span", null, T("agree")));
  f.append(chk);

  const go = button(T("join"), "", async () => {
    if (!(state.where && state.agreed)) return;
    go.disabled = true;
    try {
      const r = await fetch("/api/ledger/join", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: state.device, where: state.where, agreed: true }),
      });
      if (!r.ok) throw new Error("no");
      live(T("joinedSay"));
      await refresh();
      show("record");
    } catch {
      go.disabled = false;
      live(T("joinFail"));
    }
  });
  const paint = () => {
    note.hidden = !state.where;
    note.textContent = state.where === "cn" ? T("whereCn") : state.where === "else" ? T("whereElse") : state.where === "hk" ? T("whereHk") : "";
    go.disabled = !(state.where && state.agreed);
  };
  sel.addEventListener("change", () => { state.where = sel.value; paint(); });
  box.addEventListener("change", () => { state.agreed = box.checked; paint(); });
  paint();

  const acts = el("div", "acts");
  acts.append(go, button(T("back"), "g", () => show("overview")));
  f.append(acts);
  return f;
}

function offer(d) {
  const f = document.createDocumentFragment();
  f.append(el("p", "future", T("future", { goal: int(d.goal) })));
  f.append(el("h3", null, T("hOffer")));
  f.append(rows([
    [T("cutoffPts"), int(d.total)],
    [T("alloc"), T("sharesPh"), T("allocSub")],
    [T("price"), T("inOffer")],
  ]));
  if (d.joined && d.joined.where === "cn") f.append(el("p", "note", T("whereCn")));

  const doc = button(T("readOffer"), "g", () => {});
  doc.disabled = true;
  f.append(doc);

  const fld = el("div", "fld");
  const lab = el("label", "f", T("legal"));
  lab.htmlFor = "lpin-legal";
  const inp = el("input");
  inp.type = "text";
  inp.id = "lpin-legal";
  inp.autocomplete = "name";
  inp.value = state.name;
  inp.addEventListener("input", () => { state.name = inp.value; });
  fld.append(lab, inp);
  f.append(fld);
  for (const k of ["o1", "o2"]) {
    const c = el("label", "chk");
    const b = el("input");
    b.type = "checkbox";
    b.checked = state[k];
    b.addEventListener("change", () => { state[k] = b.checked; });
    c.append(b, el("span", null, T(k)));
    f.append(c);
  }
  f.append(el("p", "tiny", T("cool")));
  /* Shut, and it says why. Nothing can be taken up before the goal. */
  const take = button(T("take"), "", () => {});
  take.disabled = true;
  take.setAttribute("aria-describedby", "lpin-notopen");
  const why = el("p", "tiny", T("notOpen", { goal: int(d.goal) }));
  why.id = "lpin-notopen";
  const acts = el("div", "acts");
  acts.append(take, why, button(T("back"), "g", () => show("overview")));
  f.append(acts);
  return f;
}

function record(d) {
  const f = document.createDocumentFragment();
  f.append(el("h3", null, T("hRecord")));
  const rec = el("div", "rec");
  const where = d.joined ? T(d.joined.where) : T("notGiven");
  for (const [a, b] of [
    [T("recPlace"), "#" + int(d.place)],
    [T("recPts"), int(d.total)],
    [T("recRules"), d.joined ? d.joined.rules : d.rules],
    [T("recJoined"), d.joined ? day(d.joined.at.slice(0, 10)) : T("notYet")],
    [T("recWhere"), where],
    [T("recOffer"), T("recOfferV", { goal: int(d.goal) })],
  ]) {
    const row = el("div");
    row.append(el("span", null, a), el("span", null, b));
    rec.append(row);
  }
  f.append(rec);
  f.append(el("p", "soft", T("sealed")));
  f.append(el("p", "fine", T("roomSees", { m: int(d.members), goal: int(d.goal) })));
  const acts = el("div", "acts");
  acts.append(button(T("back"), "g", () => show("overview")));
  f.append(acts);
  return f;
}

/* ---- drawing ------------------------------------------------------------ */

function draw() {
  const d = DATA;
  const slot = SLOT;
  if (!d || !slot) return;
  styles();
  const head = document.querySelector("#threadview .thead");
  slot.style.top = head ? head.offsetHeight + "px" : "0px";
  slot.classList.add("lpin");
  slot.hidden = false;
  while (slot.firstChild) slot.removeChild(slot.firstChild);

  const btn = el("button", "lbtn");
  btn.type = "button";
  btn.setAttribute("aria-expanded", String(state.open));
  btn.setAttribute("aria-controls", "lpin-body");

  const k = el("span", "lk", d.member ? T("ledger") + " · " + T("place", { n: int(d.place) }) : T("ledger"));
  k.append(el("i", null, T("proto")));
  const fig = el("span", "lf", d.member ? T("points", { n: int(d.total) }) : T("noPlace"));
  const stl = el("span", "lst");
  const dot = el("i", d.joined ? "on" : "");
  const statusText = !d.member ? T("noPlaceSub") : d.joined ? T("onLedger") : T("counts", { goal: int(d.goal) });
  stl.append(dot, el("span", null, statusText));
  const side = el("span", "ls");
  const c = el("span", "c");
  c.append(el("b", null, int(d.members)), el("span", null, T("ofGoal", { goal: int(d.goal) })), el("span", null, T("membersWord")));
  side.append(c);
  side.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg>');
  for (const n of [k, fig, stl, side]) n.setAttribute("aria-hidden", "true");
  btn.setAttribute("aria-label", d.member
    ? T("pin", { place: int(d.place), pts: int(d.total), status: statusText, m: int(d.members), goal: int(d.goal) })
    : T("pinNo"));
  btn.append(k, fig, stl, side);
  slot.append(btn);

  const body = el("div", "lbody");
  body.id = "lpin-body";
  body.hidden = !state.open;
  btn.addEventListener("click", () => {
    state.open = !state.open;
    btn.setAttribute("aria-expanded", String(state.open));
    body.hidden = !state.open;
    if (!state.open) state.view = "overview";
  });

  if (d.member) {
    const views = { overview, rules, join, offer, record };
    const view = (state.view === "join" && d.joined) ? "record" : state.view;
    body.append((views[view] || overview)(d));
  } else {
    body.append(el("p", "soft", T("noPlaceSub")));
  }
  slot.append(body);

  if (state.focusNext) {
    state.focusNext = false;
    const h = body.querySelector("h3");
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); h.scrollIntoView({ block: "nearest" }); }
  }
}

async function refresh() {
  try {
    const d = await fetch("/api/ledger/pin?room=" + encodeURIComponent(state.room), {
      cache: "no-store", headers: state.device ? { "x-board-device": state.device } : {},
    }).then((r) => (r.ok ? r.json() : null));
    DATA = d && d.on ? d : null;
  } catch { DATA = null; }
  return DATA;
}

/** Fetch this reader's line for a door room and draw it into `slot`. */
export async function mountLedgerPin(slot, room, device) {
  if (!slot) return;
  if (state.room !== room) { state.room = room; state.open = false; state.view = "overview"; state.lastM = null; }
  state.device = device || "";
  const before = DATA ? JSON.stringify(DATA) : "";
  const fresh = SLOT !== slot || !slot.classList.contains("lpin") || slot.hidden;
  SLOT = slot;
  const d = await refresh();
  if (!d) { hideLedgerPin(slot); return; }

  /* NOT REPAINTED FOR NOTHING. The room redraws every twenty seconds, and a pin
     rebuilt each time throws a screen reader back to its first line and
     scrolls the pin to the top — every twenty seconds, for somebody who was in
     the middle of reading it. So it only redraws when a number changed, and
     never while focus is inside it: somebody choosing or typing is not
     repainted under their fingers. The numbers catch up on the next quiet
     refresh. */
  const changed = JSON.stringify(d) !== before;
  const busy = slot.contains(document.activeElement);
  if (fresh || (changed && !busy)) draw();

  if (state.lastM !== null && d.members !== state.lastM) {
    clearTimeout(state.sayTimer);
    const text = T("say", { m: int(d.members) });
    state.sayTimer = setTimeout(() => live(text), 1200);
  }
  state.lastM = d.members;
}

/** Take the pin down, for the screens in a room that are not the talk. */
export function hideLedgerPin(slot) {
  if (!slot) return;
  slot.hidden = true;
  slot.classList.remove("lpin");
}
