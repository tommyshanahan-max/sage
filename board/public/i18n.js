/* Both languages, written side by side.
 *
 * WHY THE SHAPE IS [en, zh] AND NOT TWO FILES
 *
 * A translation kept in a second file drifts, because adding an English string
 * and shipping is a complete-looking change. Here the pair is the unit: a new
 * string is written with both halves or it is visibly half-written in the same
 * line of the same diff. That is the whole mechanism, and it is the difference
 * between a product that has Chinese and a product that had Chinese added.
 *
 * The Chinese is not a rendering of the English. Several of these say a
 * different thing in each language because the same thing does not need saying
 * to both readers — an English reader is told the board loads without a VPN,
 * which is not news to somebody reading this in Chinese.
 *
 * WHAT ELSE MOVES WITH THE LANGUAGE, in style.css and below:
 *   - the font stacks, because Georgia has no Chinese glyphs and falls back
 *     mid-sentence, which is the single most obvious tell of a bolted-on
 *     translation
 *   - line-height, because CJK needs more room between lines and less between
 *     characters
 *   - letter-spacing and text-transform on the small caps labels, because
 *     Chinese has no case and tracked-out CJK reads as broken rather than as
 *     a label
 *   - how a time is said, which is not a format string away from English
 */

export const STRINGS = {
  // ---- the feed ------------------------------------------------------------
  "board.name":        ["The Feed", "动态"],
  "board.tagline":     ["Anyone can read. Anyone can post.", "谁都能看，谁都能发。"],
  "board.count":       ["{n} posts up. Anyone can read. Anyone can post.",
                        "已发布 {n} 条。谁都能看，谁都能发。"],
  "board.everyone":    ["Everyone", "全部"],
  "board.newest":      ["{topic} · Newest first", "{topic} · 最新在前"],
  "board.empty.head":  ["Nothing here yet.", "这里还什么都没有。"],
  "board.empty.body":  ["The first thing anybody puts up appears here. Somebody reads everything before it does.",
                        "第一条内容会出现在这里。所有内容都会先由人过目。"],
  "board.none.head":   ["Nothing under that yet.", "这个分类下还没有内容。"],
  "board.none.body":   ["Try Everyone, or put the first one up yourself.",
                        "看看全部，或者你来发第一条。"],
  "board.someone":     ["someone", "某人"],
  "board.foot": [
    "Everything is read by a person before it goes up, and a person reads every report. Nothing is kept about you but a random number your browser made up, hashed before it is written down — enough to take your own post back, and nothing else. Anyone you hide is hidden on this phone only, and forgotten if you clear your browsing data.",
    "所有内容都会先由人过目后才会发布，每一条举报也都由人来看。我们不保存关于你的任何信息，只有你的浏览器随机生成的一串数字，写入前还会先做哈希处理——刚好够你撤回自己发的内容，仅此而已。你屏蔽的人只在这台手机上被隐藏，清除浏览数据后就会忘记。",
  ],
  "board.contact":     ["Something wrong that a report cannot cover? ",
                        "有举报解决不了的问题？"],

  // ---- actions on a post ---------------------------------------------------
  "act.reply":         ["Reply", "回复"],
  "act.replies":       ["{n} replies", "{n} 条回复"],
  "act.reply1":        ["1 reply", "1 条回复"],
  "act.like":          ["Like", "赞"],
  "act.remove":        ["Remove", "删除"],
  "act.share":         ["Share", "分享"],
  "act.report":        ["Report", "举报"],
  "act.reported":      ["Reported", "已举报"],
  "act.copied":        ["Link copied", "链接已复制"],
  "act.copyFail":      ["Could not copy — press and hold the address bar",
                        "复制失败——长按地址栏"],
  "act.wxCopied":      ["Copied — send it, or use ⋯ above", "已复制——发送，或点右上角 ⋯"],
  "act.wxUseMenu":     ["Use ⋯ top right to send this", "点右上角 ⋯ 发送"],
  "act.send":          ["Send", "发送"],
  "act.sending":       ["…", "…"],
  "act.again":         ["Again?", "再试一次？"],
  "act.failed":        ["Did not go — again?", "没成功——再试一次？"],
  "act.answer":        ["Answer this…", "回复这条…"],
  "act.answerAs":      ["Answer as — a name people will see", "以什么名字回复——别人会看到"],
  "act.replyUp":       ["Up.", "已发布。"],
  "act.replyHeld":     ["Sent — somebody reads replies before they go up.",
                        "已发送——回复也会先由人过目。"],
  "act.confirmRemove": ["Take this down? Replies underneath it stay.",
                        "要删除这条吗？下面的回复会保留。"],

  // ---- putting something up ------------------------------------------------
  "post.title":        ["Put something up", "发点什么"],
  "post.placeholder": [
    "Where to get a SIM without a Chinese bank card, which gate at Renmin, what the label says, a good meal…",
    "哪里能办没有国内银行卡的电话卡、人大走哪个门、这个标签写的什么、哪家饭好吃…",
  ],
  "post.as":           ["Post as — a name people will see", "用什么名字发——别人会看到"],
  "post.topic":        ["Topic — optional", "分类——可不填"],
  "post.photo":        ["Photo", "照片"],
  "post.cancel":       ["Cancel", "取消"],
  "post.go":           ["Put it up", "发布"],
  "post.needWords":    ["Say something, or add a photo.", "写点什么，或者加张照片。"],
  "post.needName":     ["Pick a name to post under.", "选一个发布用的名字。"],
  "post.tooBig":       ["That photo is too large.", "这张照片太大了。"],
  "post.badPhoto":     ["That photo could not be read. Try another, or a screenshot of it.",
                        "这张照片读不出来。换一张，或者截图后再试。"],
  "post.held": [
    "Got it. Somebody reads everything before it goes up — it will appear once they have.",
    "收到。所有内容都会先由人过目——看过之后就会出现。",
  ],

  // ---- reporting -----------------------------------------------------------
  "rep.title":         ["Report {who}'s post", "举报 {who} 的内容"],
  "rep.titleAnon":     ["Report this post", "举报这条内容"],
  "rep.hint": [
    "A person reads every report. Say what is wrong with it — one line is enough, and it is the thing that decides what happens next.",
    "每一条举报都由人来看。说明问题在哪——一句话就够，这决定了接下来怎么处理。",
  ],
  "rep.r1":            ["Asking for money", "索要钱财"],
  "rep.r2":            ["Abuse or harassment", "辱骂或骚扰"],
  "rep.r3":            ["Spam or an advert", "垃圾信息或广告"],
  "rep.r4":            ["Not safe for a public feed", "不适合公开发布"],
  "rep.r5":            ["Somebody's private details", "泄露他人隐私"],
  "rep.more":          ["Anything else worth knowing…", "还有什么要补充的…"],
  "rep.alsoBlock":     ["Also hide everything from ", "同时在这台手机上隐藏 "],
  "rep.alsoBlock2":    [" on this phone", " 发布的全部内容"],
  "rep.go":            ["Report it", "提交举报"],
  "rep.needReason":    ["Pick a reason, or write one. A report with nothing in it cannot be acted on.",
                        "选一个理由，或者写一个。没有内容的举报无法处理。"],
  "rep.failed":        ["That did not send. Try once more — and it is already hidden from you either way.",
                        "没有发送成功。再试一次——不过它已经对你隐藏了。"],
  "rep.sent":          ["Sent. A person reads every one of these.", "已提交。每一条都由人来看。"],

  // ---- the landing page ----------------------------------------------------
  "site.title":        ["Liuxuesheng", "留学生"],
  "site.kicker":       ["For exchange students in China", "写给在中国的留学生"],
  "site.h1a":          ["Somebody here worked it out ", "这里总有人 "],
  "site.h1b":          ["last month", "上个月刚搞明白"],
  "site.h1c":          [".", "。"],
  "site.lede": [
    "A meeting place for exchange students: find a study buddy, ask the question you are embarrassed to ask, and compare notes on how to actually get by. Nothing to install. No account. No VPN.",
    "留学生的聚集地：找个学习搭子，问那些不好意思问的问题，交换在这里生活的门道。不用下载，不用注册。",
  ],
  "site.hanzi": [
    "留学生 · liúxuéshēng — a student studying abroad. It is who this is for, so it is what it is called.",
    "留学生 —— 这是给谁做的，就叫什么。",
  ],
  "site.open":         ["Open the feed", "打开动态"],
  "site.how":          ["How it is run", "怎么管理"],
  "site.under":        ["Every post is read by a person before it goes up.",
                        "每条内容发布前都由人过目。"],
  "site.liveEyebrow":  ["On the feed right now", "动态里的最新内容"],
  "site.liveH2":       ["The last few days", "最近几天"],
  "site.liveSub":      ["Live from the feed itself, not a mock-up of one. Tap any of them to read the rest.",
                        "直接来自动态，不是示意图。点任意一条看全部。"],
  "site.liveEmptyH":   ["Nothing on the feed yet.", "动态里还没有内容。"],
  "site.liveEmptyP": [
    "It opened this week. The first thing anybody puts up appears here — and somebody reads everything before it does.",
    "这周刚开。第一条内容会出现在这里——所有内容都会先由人过目。",
  ],
  "site.seeAll":       ["See the whole feed", "查看全部动态"],
  "site.threeEyebrow": ["Three things, one place", "三件事，一个地方"],
  "site.threeH2":      ["The parts of being new here that nobody hands you",
                        "刚来的时候，没人会告诉你的那些事"],
  "site.threeSub": [
    "Your university gives you a timetable and a dorm key. Everything after that is worked out by asking somebody who arrived a term earlier.",
    "学校给你课表和宿舍钥匙，剩下的都靠问早来一学期的人。",
  ],
  "site.t1h":          ["Meet the people already here", "认识已经在这儿的人"],
  "site.t1p": [
    "A feed by campus and city. Who is around, what is on this week, who is going. Arriving alone is the whole problem and it is the easiest one to fix.",
    "按学校和城市分的动态。谁在附近、这周有什么活动、谁去。一个人来是最大的问题，也是最好解决的一个。",
  ],
  "site.t1s":          ["“Anyone at Renmin going to the Gulou thing Thursday?”",
                        "「人大有人周四去鼓楼吗？」"],
  "site.t2h":          ["Find a study buddy", "找个学习搭子"],
  "site.t2p": [
    "Say your level, what you are working towards and when you are free. Most people want the same trade — their Chinese for your English — and no app is needed to make that work, only a way to find each other.",
    "写下你的水平、想考什么、什么时候有空。大多数人想要的是同一种交换——他们的中文换你的英文——这件事不需要什么应用，只需要一个能找到彼此的地方。",
  ],
  "site.t2s":          ["“HSK4 in March, Tuesdays, will trade for English.”",
                        "「三月考 HSK4，每周二，可以用英文换。」"],
  "site.t3h":          ["Compare notes on getting by", "交换生活门道"],
  "site.t3p": [
    "The SIM without a bank card. Which gate is shut. What the label says. What 微辣 really means. Small things that cost a week each to learn alone and a minute to be told.",
    "没有银行卡怎么办卡、哪个门关了、这个标签写的什么、微辣到底有多辣。这些小事自己摸索要一周，别人说一句就一分钟。",
  ],
  "site.t3s":          ["“8 kuai, cash only, gone by ten.”", "「八块，只收现金，十点就没了。」"],
  "site.howEyebrow":   ["How it is run", "怎么管理"],
  "site.howH2":        ["A public feed is a duty, not a feature", "公开的动态是责任，不是功能"],
  "site.howSub": [
    "These are decisions already made and already built, not intentions. They are the reason this can carry other people's words at all.",
    "以下都是已经做出并且已经实现的决定，不是打算。正因为如此，这里才能承载别人的话。",
  ],
  "site.r1h":          ["Held by default", "默认先审"],
  "site.r1p": [
    "Nothing appears until a person has read it. There is no model here that can judge a post, and a feed that publishes everything unread will publish the first thing somebody tests it with.",
    "在有人看过之前，什么都不会出现。这里没有能判断内容的模型，而一个不看就全发的动态，第一个被发出来的一定是别人拿来试探的东西。",
  ],
  "site.r2h":          ["Report and block, on every post", "每条内容都能举报和屏蔽"],
  "site.r2p": [
    "A person reads every report. Two separate people reporting something takes it down pending review — counted by person, never by press, so nobody can hide anything alone. Blocking happens in your own browser and never reaches us.",
    "每条举报都由人来看。两个不同的人举报同一条，它就会先下架等待复核——按人计数，不按次数，所以没有人能一个人让内容消失。屏蔽只发生在你自己的浏览器里，不会传到我们这边。",
  ],
  "site.r3h":          ["No accounts, nothing tracked", "不用账号，不做追踪"],
  "site.r3p": [
    "No email, no phone number, no sign-in. A post is tied to a salted hash of a random number your browser made up — enough to take your own post back, and nothing else. No third party sees any of it.",
    "不要邮箱，不要手机号，不用登录。一条内容只和你浏览器随机生成的数字的加盐哈希绑定——刚好够你撤回自己发的，仅此而已。没有任何第三方能看到。",
  ],
  "site.r4h":          ["Nothing loaded from outside", "不加载任何外部资源"],
  "site.r4p": [
    "No web fonts, no CDN, no third-party script or pixel. Everything is served from one machine, because a page that waits on something unreachable from the mainland is a page that does not load.",
    "没有网络字体，没有 CDN，没有第三方脚本或统计代码。全部由一台机器提供，因为一个要等国内访问不到的东西的页面，就是一个打不开的页面。",
  ],
  "site.footWrong":    ["Something wrong?", "发现问题？"],
  "site.footWrongP":   ["Report any post from the feed itself — a person reads every one.",
                        "在动态里直接举报任何一条内容——每条都由人来看。"],
  "site.footAbout": [
    "A meeting place for exchange students in China. Read by a person before anything appears. No accounts, no tracking, nothing loaded from outside.",
    "在中国的留学生聚集地。所有内容发布前都由人过目。不用账号，不做追踪，不加载任何外部资源。",
  ],
  "site.langName":     ["中文", "English"],

  /* The rotating line under the hero. Real questions people arrive with, in
     the words they arrive with them in — not a feature list. The Chinese is
     not a translation of the English here: a Chinese reader of this board is
     more often somebody who could answer these than somebody asking them, so
     the Chinese asks what they can help with. */
  "site.ask1":         ["Where do I get a SIM without a Chinese bank card?",
                        "没有国内银行卡，去哪儿办电话卡？"],
  "site.ask2":         ["Which gate at Renmin is actually open?",
                        "人大哪个门是开的？"],
  "site.ask3":         ["What does 微辣 actually mean?", "微辣到底有多辣？"],
  "site.ask4":         ["Is there anywhere to watch the game near Wudaokou?",
                        "五道口附近哪里能看球？"],
  "site.ask5":         ["Anyone else sitting HSK4 in March?", "还有谁三月考 HSK4？"],
  "site.ask6":         ["How do I pay for this if I have no Alipay?",
                        "没有支付宝怎么付款？"],
  "site.askLead":      ["Somebody is asking, right now:", "现在就有人在问："],
  "site.askUnder":     ["Somebody who arrived a term earlier already knows.",
                        "早来一学期的人已经知道答案了。"],

  /* The two-column list. Borrowed as a SHAPE from Co-Star's do/don't, filled
     with the only content that earns it here: things that cost a week each to
     work out alone and a second to be told. Every pair is a real mistake
     somebody makes in their first fortnight. */
  "dd.eyebrow":        ["Worth knowing before you arrive", "来之前值得知道的"],
  "dd.h2":             ["A week each to learn alone. A second to be told.",
                        "自己摸索要一周，别人说一句就一秒。"],
  "dd.do":             ["Do", "该这么做"],
  "dd.dont":           ["Don't", "别这么做"],
  "dd.1a":             ["Get your SIM at the airport counter", "在机场柜台办电话卡"],
  "dd.1b":             ["Wait until you are in town", "等进了市区再办"],
  "dd.2a":             ["Say 不辣", "说不辣"],
  "dd.2b":             ["Say 微辣 and hope", "说微辣然后祈祷"],
  "dd.3a":             ["Screenshot the address in Chinese", "把中文地址截图"],
  "dd.3b":             ["Try to say it out loud", "试着念出来"],
  "dd.4a":             ["Ask the guard which gate is open", "问门卫哪个门开着"],
  "dd.4b":             ["Trust the campus map", "相信校园地图"],
  "dd.5a":             ["Carry some cash for the carts", "路边摊备点现金"],
  "dd.5b":             ["Assume everywhere takes a foreign card", "以为哪里都能刷外卡"],

  // ---- your own profile ----------------------------------------------------
  "me.addPhoto":       ["Add your photo", "加上你的照片"],
  "me.addCover":       ["Add a cover", "加个封面"],
  "me.newHere":        ["You are new here", "你是新来的"],
  "me.setUp": [
    "Put a face and a name to it. One tap, and people know who is asking.",
    "加上照片和名字。点一下，别人就知道是谁在问。",
  ],
  "me.edit":           ["Edit", "编辑"],
  "me.working":        ["One moment…", "稍等…"],
  "me.editTitle":      ["Your profile", "你的资料"],
  "me.name":           ["Your name — what people see on your posts",
                        "你的名字——别人在你的内容上看到的"],
  "me.campus":         ["Campus or city — Renmin · Haidian", "学校或城市——人大 · 海淀"],
  "me.goal":           ["What you are working on, in your own words…",
                        "你在忙什么，用你自己的话说…"],
  "me.here":           ["How long you have been here", "你来多久了"],
  "me.posts":          ["posts", "条内容"],
  "me.replies":        ["replies", "条回复"],
  "me.save":           ["Save", "保存"],
  "me.saved":          ["Saved.", "已保存。"],
  "me.photoHeld": [
    "Your photo is up for you, and waiting for a person before anybody else sees it.",
    "你的照片你自己能看到，其他人要等有人过目之后才能看到。",
  ],
  "me.noContact": [
    "Take out {what} — a profile here carries no way to contact you. Swap those privately once you have both decided.",
    "请去掉 {what} —— 这里的资料不放联系方式。等你们都决定了，再私下交换。",
  ],
  "me.whyNoContact": [
    "No phone, no WeChat, no email — a public list of students with contact details is the one thing this must never be.",
    "不填手机、微信、邮箱——一份带联系方式的公开学生名单，是这里绝对不能变成的东西。",
  ],

  // ---- finding a study buddy -----------------------------------------------
  "bud.title":         ["Study buddies", "学习搭子"],
  "bud.sub":           ["{n} people near you, looking", "附近有 {n} 个人在找"],
  "bud.subOne":        ["1 person near you, looking", "附近有 1 个人在找"],
  "bud.open":          ["Find a study buddy", "找个学习搭子"],
  "bud.back":          ["Back to the feed", "回到动态"],
  "bud.empty.head":    ["Nobody is looking yet.", "还没有人在找。"],
  "bud.empty.body": [
    "Say you are looking and you will be the first. Most people want the same trade — their Chinese for your English.",
    "说一声你在找，你就是第一个。大多数人想要的是同一种交换——他们的中文换你的英文。",
  ],
  "bud.beFirst":       ["Say you are looking", "说你在找"],
  "bud.youAreIn":      ["You are in this list", "你在这个列表里"],
  "bud.takeMeOut":     ["Take me out", "把我移出"],
  "bud.putMeIn":       ["Put me in the list", "把我加进列表"],
  "bud.lookingLabel":  ["I am looking for a study buddy", "我在找学习搭子"],
  "bud.lookingWhy": [
    "Only people who ask to be listed appear here. Posting does not put you in it, and one tap takes you back out.",
    "只有主动要求的人才会出现在这里。发内容不会把你加进来，点一下就能退出。",
  ],
  "bud.free":          ["Free", "有空"],
  "bud.trades":        ["Trades", "可以交换"],
  "bud.level":         ["Level", "水平"],
  "bud.here":          ["Here", "来了"],
  "bud.theirPosts":    ["On the feed", "发过的内容"],
  "bud.nothingYet":    ["Nothing on the feed yet.", "还没有发过内容。"],
  "bud.safety": [
    "Meet on campus or somewhere public the first time, and tell somebody where you are going. Nobody here should be asking you for money, a deposit, or your documents.",
    "第一次见面选在学校或者公共场所，并且告诉别人你去哪儿。这里不该有人向你要钱、要押金或者要证件。",
  ],
  "bud.days":          ["M,T,W,T,F,S,S", "一,二,三,四,五,六,日"],
  "bud.close":         ["Close", "关闭"],
  "bud.noProfile":     ["No profile yet", "还没有资料"],
  "bud.noProfileBody": ["{who} posts here but has not filled anything in.",
                        "{who} 在这里发过内容，但还没有填写资料。"],
  "bud.blockThem":     ["Hide {who}", "隐藏 {who}"],
  "bud.blocked":       ["Hidden on this phone", "已在这台手机上隐藏"],
  "bud.reportThem":    ["Report this profile", "举报这份资料"],

  // ---- translate -----------------------------------------------------------
  "tr.open":           ["Translate", "翻译"],
  "tr.title":          ["Translate anything", "翻译"],
  "tr.hint": [
    "Paste a sign, a menu, a message — or anything from the feed. It works out which way round on its own.",
    "把牌子、菜单、消息，或者动态里的任何内容贴进来。方向会自动判断。",
  ],
  "tr.placeholder":    ["Type or paste it here…", "在这里输入或粘贴…"],
  "tr.go":             ["Translate it", "翻译"],
  "tr.working":        ["Working…", "翻译中…"],
  "tr.thisPost":       ["Translate this", "翻译这条"],
  "tr.original":       ["Original", "原文"],
  "tr.hide":           ["Hide translation", "隐藏翻译"],
  "tr.empty":          ["Put something in first.", "先输入点什么。"],
  "tr.slow":           ["A lot of translating just happened. Try again in a moment.",
                        "刚刚翻译得有点多。稍等一下再试。"],
  "tr.busy":           ["Today's translating is used up. It resets tomorrow.",
                        "今天的翻译次数用完了，明天恢复。"],
  "tr.failed":         ["That did not come back. Try once more.", "没有返回结果。再试一次。"],
  "tr.off":            ["Translation is not switched on here.", "这里没有开启翻译。"],
  "tr.note":           ["Worth knowing", "值得注意"],

  // ---- what the server can say --------------------------------------------
  // The server returns these codes, never prose, because prose chosen on the
  // server is prose in whichever language the server was written in.
  "err.empty":         ["Say something, or add a photo.", "写点什么，或者加张照片。"],
  "err.noName":        ["Pick a name to post under.", "选一个发布用的名字。"],
  "err.noPost":        ["That post is not there any more.", "这条内容已经不在了。"],
  "err.badType":       ["That kind of file is not accepted here.", "不支持这种文件。"],
  "err.tooBig":        ["That is too large.", "文件太大了。"],
  "err.contact": [
    "Take out {what} — a profile here carries no way to contact you. You swap those privately once you have both decided.",
    "请去掉 {what} —— 这里的资料不放联系方式。等你们都决定了，再私下交换。",
  ],
  "err.general":       ["That did not go through.", "没有成功。"],
};

/* Which language, and where it comes from.
 *
 * First what the reader chose here before. Failing that, what their browser
 * says — a phone set to Chinese opens in Chinese, which for the audience this
 * is aimed at is right far more often than not. English is the fallback rather
 * than the default. */
export function pickLang() {
  try {
    const saved = localStorage.getItem("board:lang");
    if (saved === "en" || saved === "zh") return saved;
  } catch { /* private window */ }
  const nav = (navigator.languages || [navigator.language || ""]).join(",");
  return /\bzh\b|zh-/i.test(nav) ? "zh" : "en";
}

let LANG = "en";
export const lang = () => LANG;

/** Set the language and tell the document, which is what the typography keys
 *  off. `lang` is for the browser's line-breaking and font matching; the
 *  data attribute is for our own CSS, because [lang] can be set on any element
 *  and we want exactly one switch. */
export function setLang(next) {
  LANG = next === "zh" ? "zh" : "en";
  try { localStorage.setItem("board:lang", LANG); } catch { /* fine */ }
  const root = document.documentElement;
  root.setAttribute("lang", LANG === "zh" ? "zh-Hans" : "en");
  root.setAttribute("data-lang", LANG);
  return LANG;
}

/** A string, in the language now in force, with {placeholders} filled. */
export function T(key, vars) {
  const pair = STRINGS[key];
  // A missing key is a bug, and showing the key is how it gets noticed. Silent
  // fallback to English would let a half-translated build ship looking whole.
  if (!pair) return key;
  let out = pair[LANG === "zh" ? 1 : 0] || pair[0];
  if (vars) {
    for (const k of Object.keys(vars)) out = out.split("{" + k + "}").join(String(vars[k]));
  }
  return out;
}

/* How long ago, said the way each language says it.
 *
 * Not a format string away from English: Chinese puts the unit after the
 * number and needs 前 on the end, and "just now" is not "0 minutes". */
export function when(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (LANG === "zh") {
    if (mins < 1) return "刚刚";
    if (mins < 60) return mins + " 分钟前";
    if (mins < 1440) return Math.round(mins / 60) + " 小时前";
    if (mins < 10080) return Math.round(mins / 1440) + " 天前";
    return d.getMonth() + 1 + "月" + d.getDate() + "日";
  }
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  if (mins < 1440) return Math.round(mins / 60) + "h";
  if (mins < 10080) return Math.round(mins / 1440) + "d";
  return d.toLocaleDateString("en", { day: "numeric", month: "short" });
}

/** The toggle. One control, in the corner, showing the language it switches
 *  TO rather than the one you are in — a button that says "English" while you
 *  are reading English is a button nobody presses. */
export function langButton(onChange) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "lang";
  const paint = () => { b.textContent = T("site.langName"); };
  b.addEventListener("click", () => {
    setLang(LANG === "zh" ? "en" : "zh");
    paint();
    onChange();
  });
  paint();
  return b;
}
