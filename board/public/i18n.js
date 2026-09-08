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
  "board.name":        ["The Tutor", "导师"],
  "board.tagline":     ["Anyone can read. Anyone can post.", "谁都能看，谁都能发。"],
  "board.count":       ["{n} posts up. Anyone can read. Anyone can post.",
                        "已发布 {n} 条。谁都能看，谁都能发。"],
  "board.everyone":    ["Everyone", "全部"],
  "board.newest":      ["{topic} · Newest first", "{topic} · 最新在前"],
  // Where the posts start. Named rather than described, because "Everyone ·
  // Newest first" tells a reader how the list is sorted and not what it is.
  "board.club":        ["Posts from everyone here", "这里大家发的内容"],
  "board.empty.head":  ["Nothing here yet.", "这里还什么都没有。"],
  "board.empty.body":  ["The first thing anybody puts up appears here. Anybody can report it, and a person reads every report.",
                        "第一条内容会出现在这里。任何人都可以举报，每一条举报都由人来看。"],
  "board.none.head":   ["Nothing under that yet.", "这个分类下还没有内容。"],
  "board.none.body":   ["Try Everyone, or put the first one up yourself.",
                        "看看全部，或者你来发第一条。"],
  /* Said at the top of every page while it is true. Somebody arriving from a
     link a friend sent should know what they have walked into before they
     judge how quiet it is — an empty room reads as a dead product unless it
     says it is not open yet. Remove the strip when it stops being true. */
  "site.invite": [
    "Not public yet \u2014 invite only.",
    "尚未公开，目前只能通过邀请进入。",
  ],
  "board.someone":     ["someone", "某人"],
  /* The board's own voice on the feed. Not "The Tutor" — he is the card at the
     top of the app that helps somebody work out what to do, and a notice from
     whoever runs the place is a different thing said by a different person.
     Marked as admin wherever it appears, because a post from the house
     carrying no mark is a post pretending to be a student. */
  "house.name":        ["The Professor", "教授"],
  "house.tag":         ["admin", "管理员"],
  /* WHAT THIS PROMISES IS WHAT THE CODE DOES, IN BOTH MODES.
     It used to say everything was read before it went up. That is true once
     the board passes BOARD_OPEN_UNTIL and false before it — and photographs do
     not wait at any size. A promise that holds only in the mode we are not in
     yet is one people find out about the hard way, so this says the part that
     is true at eight people and at eighty: reports are read, two hide a post,
     anything can come down. See TEST MODE in server.js. */
  "board.foot": [
    "A person reads every report, two of them hide a post until somebody has, and anything here can be taken down. Nothing is kept about you but a random number your browser made up, hashed before it is written down — enough to take your own post back, and nothing else. Anyone you hide is hidden on this phone only, and forgotten if you clear your browsing data.",
    "每一条举报都由人来看，两条举报就会先把内容隐藏起来等人处理，这里的任何内容都可以撤下。我们不保存关于你的任何信息，只有你的浏览器随机生成的一串数字，写入前还会先做哈希处理——刚好够你撤回自己发的内容，仅此而已。你屏蔽的人只在这台手机上被隐藏，清除浏览数据后就会忘记。",
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
  "act.more":          ["Show more", "展开"],
  "act.less":          ["Show less", "收起"],
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
    "Whether that course is worth taking, where to get a SIM without a Chinese bank card, which gate at Renmin is open, what the label says…",
    "那门课值不值得选、哪里能办没有国内银行卡的电话卡、人大哪个门开着、这个标签写的什么…",
  ],
  "post.as":           ["Post as — a name people will see", "用什么名字发——别人会看到"],
  "post.topic":        ["Topic — optional", "分类——可不填"],
  // Making a topic is writing the first thing in it: there is nowhere to keep
  // an empty one and nothing for a reader to do with it.
  "topic.new":         ["+ New topic", "+ 新话题"],
  "topic.ask":         ["What is the topic called?", "这个话题叫什么？"],
  "post.photo":        ["Photo", "照片"],
  "post.cancel":       ["Cancel", "取消"],
  "post.go":           ["Put it up", "发布"],
  "post.needWords":    ["Say something, or add a photo.", "写点什么，或者加张照片。"],
  "tut.hidden":        ["You are not in Browse", "你没有出现在「看看有谁」里"],
  "tut.hiddenWhat": [
    "Your posts are on the feed and anybody can read them — but you are not in the list of people, so nobody can find you there or follow you from it. One tap turns it on, and one turns it back off.",
    "你发的内容在动态里，谁都看得到——但你不在学生名单里，所以没人能在那儿找到你、也没法从那儿关注你。点一下就能打开，再点一下就关掉。",
  ],

  "post.room":         ["What is this about?", "这条是关于什么的？"],
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
  /* WHO IT IS FOR, WIDENED ON PURPOSE. It began as a board for exchange
     students and the rooms outgrew that: somebody raising money, somebody
     sourcing from a factory and somebody looking for a language exchange are
     all on the same board and all doing the same thing — finding the person on
     the other side. The name stays; what it says it is for does not. */
  "site.kicker":       ["For people connecting in China — and with China",
                        "在中国的人，和想认识中国的人"],
  "site.h1a":          ["Somebody here worked it out ", "这里总有人 "],
  "site.h1b":          ["last month", "上个月刚搞明白"],
  "site.h1c":          [".", "。"],
  "site.lede": [
    "A place to ask the question you are embarrassed to ask, and to find the person on the other side of it — a language exchange, somebody to study with, somebody who knows the city, somebody to build something with. Nothing to install. No account. No VPN.",
    "一个可以问出你不好意思问的问题的地方，也可以在这里找到问题另一头的那个人——语伴、一起学习的人、熟悉这座城市的人、一起做点东西的人。不用下载，不用注册。",
  ],
  "site.hanzi": [
    "留学生 · liúxuéshēng — someone who went abroad to study. That is where this started, and the name stayed even as the rooms outgrew it.",
    "留学生 —— 这个地方是从这里开始的，后来装下的东西比这个词多了，名字留了下来。",
  ],
  "site.open":         ["See who is on it", "看看有谁在"],
  "site.how":          ["How it is run", "怎么管理"],
  "site.under":        ["Invite only. A person reads every report, and anything can be taken down.",
                        "邀请制。每一条举报都由人来看，任何内容都可以撤下。"],
  "site.liveEyebrow":  ["On the feed right now", "动态里的最新内容"],
  "site.liveH2":       ["The last few days", "最近几天"],
  "site.liveSub":      ["Live from the feed itself, not a mock-up of one. Tap any of them to read the rest.",
                        "直接来自动态，不是示意图。点任意一条看全部。"],
  "site.liveEmptyH":   ["Nothing on the feed yet.", "动态里还没有内容。"],
  "site.liveEmptyP": [
    "It opened this week. The first thing anybody puts up appears here — and anybody who reads it can report it.",
    "这周刚开。第一条内容会出现在这里——看到的人都可以举报。",
  ],
  "site.seeAll":       ["See the whole feed", "查看全部动态"],
  "site.threeEyebrow": ["Three things, one place", "三件事，一个地方"],
  "site.threeH2":      ["The parts of being new here that nobody hands you",
                        "刚来的时候，没人会告诉你的那些事"],
  "site.threeSub": [
    "Your university gives you a timetable and a dorm key. Everything after that is worked out by asking somebody who arrived a term earlier.",
    "学校给你课表和宿舍钥匙，剩下的都靠问早来一学期的人。",
  ],
  "site.t1h":          ["Ask the people already here", "问问已经在这儿的人"],
  "site.t1p": [
    "A feed by campus and city. Which course is worth taking, what is on this week, what nobody tells you. Working it out alone is the whole problem and it is the easiest one to fix.",
    "按学校和城市分的动态。哪门课值得选、这周有什么、没人会告诉你的那些事。一个人瞎摸索是最大的问题，也是最好解决的一个。",
  ],
  "site.t1s":          ["“Has anyone at Renmin taken the 8am listening class?”",
                        "「人大有人上过早八的听力课吗？」"],
  "site.t2h":          ["Find a study buddy", "找个学习搭子"],
  "site.t2p": [
    "Say your level and what you are working towards. Most people want the same trade — their Chinese for your English — and no app is needed to make that work, only a page each.",
    "写下你的水平、想考什么。大多数人想要的是同一种交换——他们的中文换你的英文——这件事不需要什么应用，各自有个主页就够了。",
  ],
  "site.t2s":          ["“HSK4 in March, will trade for English.”",
                        "「三月考 HSK4，可以用英文换。」"],
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
  // The way in for the people who run this. Public on purpose: the password is
  // the gate, and a link nobody can find is a link its own team has to be told
  // about every time.
  "site.adminLink":    ["Admin", "管理"],

  // ---------------------------------------------------------------------
  // What is kept, and what is not.
  //
  // Required by every app store and by law in most places people will read
  // this from. Written as sentences rather than clauses because the audience
  // is nineteen and reading on a phone in their second language, and a policy
  // nobody can read is a policy nobody agreed to.
  // ---------------------------------------------------------------------
  /* ---- the house rules ----------------------------------------------------
   * Nine lines about how people behave, not about what the software permits.
   * What the software stops is in the software; this is the part it cannot,
   * and it is the part that decides what this place is like to be in.
   * Written to be read once and remembered — which is why there are nine and
   * not thirty. */
  /* ---- the waiting list, on the public page -------------------------------
     The only place this board asks anything of somebody who is not in it, so
     it asks for as little as it can and says what happens to it. */
  /* Under a result, where the screen has already earned the right to ask. The
     general version explains what the place is; this one does not have to. */
  /* The two words at the top of the box, and the label under the figure.
     "Invite only" rather than "private" or "members only": it names the one
     mechanism — somebody already in has to hand you the password. */
  "wait.only":         ["Invite only", "仅限邀请"],
  "wait.waiting":      ["waiting to get in", "个人在等着进来"],
  "wait.name":         ["Your name", "你的名字"],
  "wait.reach":        ["WeChat, Instagram, email — one is enough",
                        "微信、Instagram、邮箱——一个就够"],
  "wait.why":          ["One line about you. Optional.", "一句话介绍自己。可以不写。"],
  /* THE FIRST BUTTON, which asks for nothing. It is a different sentence from
     the one on the form: this one is the decision, that one is the send. */
  "wait.join":         ["Join the list", "加入名单"],
  "wait.go":           ["Put me on the list", "把我加进名单"],
  "wait.both":         ["A name and one way to reach you.", "名字和一个联系方式。"],
  "wait.done":         ["You are on the list.", "已经加进名单了。"],
  "wait.again":        ["Changed — the old answer is replaced.", "改好了，旧的那条已经被替换。"],
  "wait.already":      ["You are already a member. Open the board.",
                        "你已经是这里的人了，直接打开就行。"],
  "wait.note": [
    "Only whoever runs this board can read the list — no member sees it, and nothing you write here appears anywhere on the board. It is deleted once you are let in, or if you are not.",
    "只有管这个板的人能看到这份名单——成员看不到，你在这里写的任何东西都不会出现在板上。等你被放进来，或者确定不放，这条就删掉。",
  ],

  "rules.title":       ["House rules", "这里的规矩"],
  "rules.lede": [
    "Nine lines. None of them are enforced by the software, which is the point — this is the part of a place that only the people in it can keep.",
    "九条。没有一条是靠程序管住的，这正是重点——一个地方的这一部分，只有待在里面的人才守得住。",
  ],
  "rules.bring":       ["Bring people you would vouch for.", "带你愿意为他担保的人来。"],
  "rules.bring.why": [
    "Your name stays on their page. That is the whole system: there is no committee, only whether you were careful.",
    "你的名字会留在他的主页上。整套机制就是这样：没有委员会，只有你有没有慎重。",
  ],
  "rules.reply":       ["If you swap cards, reply.", "换了名片，就回一句。"],
  "rules.reply.why": [
    "Somebody gave you a way to reach them because you asked for it. Silence after that is the one thing that makes people stop giving.",
    "别人把联系方式给你，是因为你要了。之后不回，正是让大家不再愿意给的原因。",
  ],
  "rules.pitch":       ["Do not pitch in the wrong room.", "别在不相干的地方推销。"],
  "rules.pitch.why": [
    "Somebody looking for a language exchange did not ask about your company. Tick the box for what you want and the people who want it will find you.",
    "找语伴的人没问你的公司。想找什么就勾什么，想要的人自然会找到你。",
  ],
  "rules.screenshot":  ["Do not screenshot somebody into a group chat.",
                        "别把别人截图发到群里。"],
  "rules.screenshot.why": [
    "Everything here was written for the people in here. A screenshot moves it somewhere its author never agreed to be.",
    "这里写的每一句都是给这里的人看的。一张截图会把它挪到作者从没同意过的地方。",
  ],
  "rules.owe":         ["Nobody here owes you a reply.", "这里没有人欠你一个回复。"],
  "rules.owe.why": [
    "Not a follow back, not a card, not a match. Asking twice is fine. Asking a third time is not.",
    "不欠你关注，不欠你名片，也不欠你匹配。问两次可以，第三次就不行了。",
  ],
  "rules.guess":       ["Do not guess who looked at your page.", "别去猜谁看了你的主页。"],
  "rules.guess.why": [
    "The number is deliberately anonymous. On a board this small a guess is usually wrong and always awkward for the person you guessed.",
    "那个数字是故意匿名的。人这么少，猜多半是错的，而且对被你猜到的人总是很尴尬。",
  ],
  "rules.photo":       ["Post your own face, not somebody else's.",
                        "放你自己的脸，不要放别人的。"],
  "rules.photo.why": [
    "A photograph is the one thing that cannot be taken back once somebody has saved it.",
    "照片是唯一一样别人存下来就收不回的东西。",
  ],
  "rules.report":      ["Report it rather than arguing with it.", "举报，而不是吵起来。"],
  "rules.report.why": [
    "A person reads every report, and two of them hide a post until somebody has. A thread of people arguing helps nobody who comes after.",
    "每一条举报都由人来看，两条就会先把内容隐藏起来等人处理。一串吵架的回复，对后来的人没有任何好处。",
  ],
  "rules.leave":       ["Leave it better than a group chat.", "让它比一个群聊更值得待。"],
  "rules.leave.why": [
    "That is the only bar. Everything above is a way of saying it more precisely.",
    "标准只有这一条。上面所有的话，都只是把它说得更具体一点。",
  ],
  "rules.end": [
    "Nothing here is a threat. Somebody who ignores all nine will be removed by a person, and the person who brought them will be told — which is also the only enforcement there is.",
    "上面没有一句是威胁。九条全不当回事的人，会由人把他请出去，并且会告诉带他进来的那个人——这也是全部的「执法」了。",
  ],

  "pv.title":          ["What is kept", "我们保留什么"],
  "pv.updated":        ["Last changed {d}", "最后修改于 {d}"],
  "pv.lede": [
    "Short version: there are no accounts here, so there is almost nothing to keep. What follows is the whole of it.",
    "简单说：这里没有账号，所以几乎没有什么可保留的。下面就是全部。",
  ],

  "pv.h1":             ["Who you are, to us", "在我们这边，你是谁"],
  "pv.p1": [
    "Nobody. There is no sign-up, no email address, no phone number and no password. When you first open the board your browser makes up a random number and keeps it on your own device. We store a salted hash of that number against anything you post, which is just enough to let you delete your own things and not enough to say who you are.",
    "谁也不是。这里不用注册，不要邮箱，不要手机号，也没有密码。你第一次打开的时候，浏览器会随机生成一个数字，存在你自己的设备上。我们只保存这个数字加盐之后的哈希值，用来把内容和你对应起来——刚好够你删掉自己发的，不足以说明你是谁。",
  ],
  "pv.p1b": [
    "Clear your browser data, change phone or use a private window and that number is gone. You become a new person here, and your old posts and profile are no longer yours to delete. That is the cost of not asking who you are, and it is a deliberate trade.",
    "清除浏览器数据、换手机、用无痕窗口，这个数字就没了。你在这里就成了一个新的人，之前发的内容和资料也不再由你控制。这是不问你是谁的代价，是我们有意做的取舍。",
  ],

  "pv.h2":             ["What you give us", "你给我们的"],
  "pv.p2": [
    "What you type and the photographs you choose to add. That is all. Posts and profiles are public — anyone can read them, and anyone can forward them. Do not put anything here you would mind a stranger seeing.",
    "你输入的内容，以及你选择上传的照片。仅此而已。内容和个人资料都是公开的——任何人都能看到，也都能转发。不要在这里放你不希望陌生人看到的东西。",
  ],
  "pv.p2b": [
    "Phone numbers, WeChat ids, emails and addresses are filtered out before anything is published. That is for your protection rather than ours, and it is a filter rather than a wall: do not rely on it to catch something you should not have typed.",
    "手机号、微信号、邮箱和住址会在发布前被过滤掉。这是为了保护你，不是保护我们；而且它只是一道过滤，不是一堵墙——不要指望它替你拦下本来就不该输入的东西。",
  ],

  /* CARDS ARE THE EXCEPTION TO THE SECTION ABOVE, so they are documented
     immediately after it rather than in a paragraph somebody has to go and
     find. The third paragraph is the cost, and it is not softened: the server
     holds a WeChat id for anybody who fills one in, which was not true of this
     board before the feature existed. */
  "pv.hcard":          ["Cards", "名片"],
  "pv.pcard1": [
    "A card is a WeChat id and one line you write yourself. It is the one place on this board that holds a way of reaching you off it — everything public is filtered for phone numbers, emails and WeChat ids, and a card is the deliberate exception to that. You only have one if you made one.",
    "名片就是一个微信号，加一句你自己写的话。这是整个板上唯一保存「怎么在站外找到你」的地方——所有公开内容里的手机号、邮箱和微信号都会被过滤掉，名片是我们有意留的例外。你不填就没有。",
  ],
  "pv.pcard2": [
    "It is never shown because somebody follows you, and never because you matched. It reaches one person when four things are true: you follow each other, you are each looking for something the other answers, you pressed give, and they are the person you gave it to. Taking it back stops them opening it again — it cannot unsend what they have already read. Clearing the card takes it back from everybody at once.",
    "别人关注你，看不到；匹配上了，也看不到。它只有在四件事同时成立时才会到一个人手里：你们互相关注、你们想找的东西对得上、你按了发送、而且他就是你发给的那个人。收回只是让他以后打不开——已经看过的收不回来。把名片清空，等于同时从所有人那里收回。",
  ],
  "pv.pcard3": [
    "The honest cost: a card is stored on the same server as everything else, and whoever runs this board can read the file. That was not true of anything here before cards existed. If that is not a trade you want to make, do not fill one in — nothing else on this board asks you for a way of being reached.",
    "老实说代价在哪：名片和其他内容存在同一台服务器上，运行这个板的人是能看到那个文件的。在名片这个功能出现之前，这里没有任何东西是这样的。如果你不愿意做这个交换，就别填——这个板上没有别的地方会向你要联系方式。",
  ],

  /* PRIVATE MESSAGES ARE THE ONE PLACE ON THIS BOARD WHERE TWO PEOPLE WRITE
     TO EACH OTHER AND NOBODY ELSE, so what that does and does not mean is
     spelled out rather than implied — including the part people assume and we
     will not claim. */
  "pv.hchat":          ["Messages", "私信"],
  "pv.pchat1": [
    "A message holds what you wrote, who it was to, and when. It is kept on the same server as everything else. Nobody but the two of you reads it — not other members, not us — with one exception, and the exception is the point: if the person who received a message reports it, that is when somebody reads it. That is the whole reason these are not built so that we cannot read them. A room nobody can read is a room nobody can be removed from.",
    "一条私信保存的是：你写的内容、写给谁、什么时候写的，和其他内容存在同一台服务器上。除了你们两个人，没有别人会读——其他成员不会，我们也不会——只有一个例外，而这个例外正是关键：如果收信的人举报了这条消息，那时才会有人来读。这也正是我们没有把私信做成「连我们自己都读不了」的原因——一个没有人能读的房间，也就没有人能被请出去。",
  ],
  "pv.pchat2": [
    "It is not end-to-end encrypted and this page will not tell you it is. It travels over HTTPS and it sits on a server we run. Either of you can leave a conversation with one press: after that neither of you can write again, the other person is not told who left, and what was already said stays where it is — leaving ends a conversation, it does not erase it, which is what keeps a report about it possible afterwards.",
    "它不是端到端加密的，本页也不会告诉你它是。传输走 HTTPS，存放在我们自己运行的服务器上。你们任何一方都可以一键退出对话：退出后双方都不能再写，对方也不会被告知是谁退出的，而已经说过的话会留在原处——退出是结束对话，不是抹掉对话，这样事后举报才仍然成立。",
  ],

  /* COUNTING READERS IS NEW, so it is a section and not a clause. The point
     worth making is the shape of it: a number went up, and the thing that
     could have been written down — who read what — was not. */
  "pv.hcount":         ["Counting readers", "阅读数是怎么来的"],
  "pv.pcount1": [
    "Your page counts how many people opened it, and how many of those keep coming back. Both are numbers on your own page and nobody else can see them. What is not kept is who: there is no record anywhere on this server of which person read which page, and nothing here could answer that question if it were asked.",
    "你的主页会统计有多少人打开过，以及其中有多少人反复回来。这两个数字只有你自己看得到。没有保存的是「谁」：这台服务器上没有任何地方记录了谁看了谁的主页，就算有人来问，这里也答不出来。",
  ],
  "pv.pcount2": [
    "It works that way because the counting happens on the reader's own phone. Their browser knows which pages it has opened and on which days — the way it already knows who they have blocked — and it tells us one thing: whether this visit is their first today, and whether they have now been here three separate days. A number goes up. Nothing else is written down.",
    "之所以能这样，是因为计数发生在读者自己的手机上。他的浏览器知道自己打开过哪些页面、哪几天打开的——就像它已经知道他屏蔽了谁一样——然后只告诉我们一件事：这次是不是他今天第一次打开，以及他是不是已经来过三天。于是一个数字加一。别的什么都没写下来。",
  ],

  /* THE WAITING LIST IS THE FIRST THING WE HOLD ABOUT SOMEBODY WHO IS NOT A
     MEMBER, so it gets its own section rather than a clause. The waitlist form
     promises three things — nobody but the operator reads it, none of it
     appears on the board, and it is deleted either way — and a promise made in
     a form has to be findable here too, or it is only marketing. */
  "pv.hwait":          ["The waiting list", "等候名单"],
  "pv.pwait1": [
    "If you asked to join and are waiting, what we hold is what you typed into that one form: a name to call you, a way to reach you, and whatever you wrote about yourself. Nothing else. There is no account behind it, and asking to join does not put anything on the board — no member sees your name, and nothing you wrote appears anywhere a member can read.",
    "如果你申请加入、正在等候，我们保留的就是你在那个表单里填的东西：一个称呼、一个联系方式，以及你写的那段自我介绍，仅此而已。它背后没有账号，申请本身也不会在板上留下任何痕迹——没有成员看得到你的名字，你写的内容也不会出现在任何成员能读到的地方。",
  ],
  "pv.pwait2": [
    "Only whoever runs this board reads that list. It is deleted once you are let in, and deleted if you are not — either way it does not become a record of people who once wanted in. The number of people waiting is shown on the public page and inside the board, but only as a number, and only once enough people are waiting that the number cannot point at anybody.",
    "这份名单只有运行这个板的人会读。你被放进来之后它会被删掉，没被放进来也会被删掉——无论哪种情况，它都不会变成一份「谁曾经想进来」的记录。等候的人数会显示在公开页面和板内，但只是一个数字，而且要等到人数多到这个数字指不到任何具体的人时才会出现。",
  ],

  /* THE TWO FIELDS THAT ARE THE EXCEPTION TO THE FILTER, said next to it
     rather than left for somebody to notice. A filter that removes contact
     details from every box except two, without saying which two, teaches the
     wrong lesson about how careful to be. */
  "pv.p2c": [
    "Two boxes are the exception, because you are meant to be found through them: Instagram and LinkedIn. Both are optional, both are blank until you fill them, and anybody who opens your page can see them. A LinkedIn is the bigger step of the two — it usually carries your real name and where you work — so it is worth deciding about rather than filling in because the box is there.",
    "有两个框是例外，因为它们本来就是让别人找到你的：Instagram 和领英。两个都是选填，不填就是空的，而任何打开你主页的人都能看到。领英这一步更大——上面通常有你的真名和工作单位——所以值得想一想再填，而不是因为有这个框就填。",
  ],

  "pv.h3":             ["What we do not do", "我们不做的事"],
  "pv.p3": [
    "There are no third-party scripts on this site: no advertising network, no social widgets, no analytics from anybody else. Nothing here is sold, shared or handed to a partner. There is no advertising, so there is nothing to profile you for.",
    "本站没有任何第三方脚本：没有广告网络，没有社交插件，也没有别家的统计代码。这里的任何内容都不会被出售、共享或交给合作方。这里没有广告，所以也没有给你画像的必要。",
  ],
  "pv.p3b": [
    "Blocking somebody happens entirely on your own device and is never sent to us, which is why nobody can be told they were blocked and why it cannot be used against anyone.",
    "屏蔽完全发生在你自己的设备上，不会传到我们这边——所以没有人会被告知自己被屏蔽了，这个功能也就无法被用来针对谁。",
  ],

  "pv.h4":             ["Photographs", "照片"],
  "pv.p4": [
    "A photograph goes up the moment you add it. A face held in a queue looks to everybody else exactly like a failed upload, and that is a bad first thing to learn about a place. Anybody who sees a photograph can report it, two reports hide it until a person has looked, and it can be taken down along with the profile it belongs to. Photographs are stored on the same server as everything else and are reachable by a link nobody can guess.",
    "照片一加上就会出现。一张排队等审核的照片，在别人看来跟上传失败没有区别——这是一个人对这个地方最不该留下的第一印象。任何看到照片的人都可以举报，两条举报就会先把它隐藏起来等人处理，也可以连同它所属的资料一起撤下。照片和其他内容存在同一台服务器上，通过一个别人猜不到的链接访问。",
  ],

  "pv.h5":             ["Taking something back", "撤回内容"],
  "pv.p5": [
    "You can delete anything you posted, from the post itself, as long as you are on the same device and browser you posted from. Deleted posts stop being shown immediately. If you cannot reach something you put up — a new phone, cleared data — write to us and say which post it was, and we will take it down.",
    "只要还在发布时用的那台设备和那个浏览器上，你就可以在内容本身上删掉自己发的任何东西，删除后会立即不再显示。如果你已经没办法操作了——换了手机、清了数据——写信告诉我们是哪一条，我们会帮你撤下。",
  ],

  "pv.h6":             ["Where it lives", "存在哪里"],
  "pv.p6": [
    "On one rented server, run by us. Not a cloud platform with other people's tools attached to it. Reports and posts waiting to be read are visible to whoever is moderating, which is a very small number of people.",
    "在我们自己租的一台服务器上，由我们运行，而不是接了一堆第三方工具的云平台。举报和等待审核的内容，负责审核的人可以看到——这样的人非常少。",
  ],

  "pv.h7":             ["Children", "未成年人"],
  "pv.p7": [
    "This is for adults. It is not intended for anyone under sixteen, and we do not knowingly keep anything from them.",
    "本站面向成年人，不面向十六岁以下的人，我们也不会有意保留他们的任何信息。",
  ],

  "pv.h8":             ["If something here is wrong", "如果这里有问题"],
  "pv.p8": [
    "Report any post from the post itself — a person reads every report. If the problem is bigger than one post, or it is about us, write to the address below.",
    "任何一条内容都可以直接在内容上举报，每一条举报都由人来看。如果问题比一条内容更大，或者问题就出在我们身上，请写信到下面的地址。",
  ],
  "pv.noContact": [
    "No address is set on this deployment yet.",
    "本部署尚未设置联系地址。",
  ],
  "pv.back":           ["Back to the feed", "回到动态"],


  // The three screens, shown as phones on the landing page. Written rather
  // than screenshotted: no image to load over a mainland connection, the words
  // inside them change language with the rest of the page, and a drawing
  // cannot go stale the way a PNG of last month's UI does.
  // ---------------------------------------------------------------------
  // The second front door: students deciding whether to go abroad at all.
  //
  // Same board, same people, same queue — a different entrance. Splitting the
  // data would have opened this one empty, and an empty board is what kills a
  // community before it starts. The point is that they arrive somewhere that
  // already has people on it, and that those people are the draw: foreigners
  // who moved to another country to study are the one group who can answer
  // "what is it actually like" without being paid to say yes.
  //
  // Written Chinese-first. These are the only strings here whose Chinese is
  // the original and whose English is the translation.
  // ---------------------------------------------------------------------
  "ab.title":          ["Thinking about studying abroad", "在考虑出国"],
  "ab.kicker":         ["For students deciding", "给还在决定的人"],
  "ab.q1":             ["Is a one-year master's in the UK worth it?", "英国一年制硕士，值得吗？"],
  "ab.q2":             ["What is it actually like living there alone?",
                        "一个人在那边生活，到底是什么样？"],
  "ab.q3":             ["Did anyone regret going?", "有人后悔去了吗？"],
  "ab.q4":             ["How much is it really, all in?", "全部算下来，到底要多少钱？"],
  "ab.q5":             ["Is my English good enough?", "我的英语，够用吗？"],
  "ab.askUnder":       ["Ask somebody who is doing it.", "问问正在经历的人。"],
  "ab.lede": [
    "Everybody you can ask about this is paid to say yes. Here you can ask people who actually went — and people from the countries you are considering, who moved here to study and know exactly what that first month feels like.",
    "能问的人，几乎都是靠说“值得”赚钱的。这里可以问真正去过的人——还有来自你在考虑的那些国家、为了读书搬到中国来的人。第一个月是什么滋味，他们最清楚。",
  ],
  "ab.ctaOpen":        ["Open the feed", "看看大家在说什么"],
  "ab.ctaAsk":         ["Ask your question", "问你的问题"],
  "ab.note": [
    "No account. Nothing to install. A person reads everything before it appears.",
    "不用注册，不用下载。所有内容都由人过目之后才出现。",
  ],

  "ab.whoEyebrow":     ["Who is already here", "这里都有谁"],
  "ab.whoH2": [
    "People who moved to another country to study. Ask them what it was like.",
    "一群为了读书搬到另一个国家的人。问问他们当时是什么感觉。",
  ],
  "ab.whoSub": [
    "They came here from Germany, Korea, France, Brazil. They queued for a residence permit, could not open a bank account, ate alone for a fortnight. That is the part nobody puts in a brochure, and it is the same everywhere.",
    "他们从德国、韩国、法国、巴西来。排队办居留、办不下来银行卡、一个人吃了两个星期的饭。这些册子上不会写，而且在哪儿都一样。",
  ],
  "ab.swapH":          ["And it goes both ways", "而且是双向的"],
  "ab.swapP": [
    "They want Chinese, and someone to explain how anything here works. You want to know what a semester in their country is actually like. That is a fair swap, and it is what the study-buddy list is for.",
    "他们想学中文，也想找个人问问这边的事情怎么弄。你想知道在他们那边读一学期到底是什么样。这是一次公平的交换——学习搭子那一栏，就是干这个用的。",
  ],
  "ab.budsGo":         ["Find someone to swap with", "找个人换一换"],

  "ab.liveEyebrow":    ["On the feed right now", "动态里最新的"],
  "ab.liveH2":         ["Not a mock-up", "不是样例"],
  "ab.liveSub": [
    "Live from the board itself. Tap any of them to read the rest.",
    "直接来自动态本身。点开任意一条就能看全部。",
  ],
  "ab.seeAll":         ["See everything", "看全部"],

  "ab.rulesEyebrow":   ["How it is run", "怎么管理"],
  "ab.rulesH2": [
    "The reason an answer here is worth reading",
    "这里的回答值得看，是有原因的",
  ],
  "ab.r1h":            ["Nobody here is selling you anything", "这里没有人在向你推销"],
  "ab.r1p": [
    "No agency, no commission, no partner university with a quota to fill. Contact details are filtered out of posts, so nobody can turn a question into a sales lead.",
    "没有中介，没有佣金，也没有哪所合作院校有名额要填。内容里的联系方式会被过滤掉，所以没人能把一个问题变成一条销售线索。",
  ],
  "ab.r2h":            ["A person reads everything first", "所有内容都先由人过目"],
  "ab.r2p": [
    "Nothing appears until somebody has read it. That is slower and it is the only way a board stays worth opening.",
    "在有人看过之前，什么都不会出现。这样慢一些，但也只有这样，一个板块才值得一直打开。",
  ],
  "ab.r3h":            ["No account, and no tracking", "不用账号，也不做追踪"],
  "ab.r3p": [
    "No email, no phone number, no login. A post is tied to a random number your browser made up, hashed — just enough to let you take back your own.",
    "不要邮箱，不要手机号，不用登录。一条内容只和你浏览器随机生成的一个数字的哈希绑定——刚好够你撤回自己发的，仅此而已。",
  ],
  "ab.r4h":            ["It loads here", "在国内打得开"],
  "ab.r4p": [
    "No web fonts, no CDN, no third-party scripts. Everything comes from one machine, because a page waiting on something outside is a page that does not open.",
    "没有网络字体，没有 CDN，没有第三方脚本。全部由一台机器提供，因为一个要等墙外资源的页面，就是一个打不开的页面。",
  ],

  "ab.footBack":       ["Already studying in China?", "已经在中国读书了？"],
  "ab.footBackGo":     ["That side is here", "那边在这里"],

  "shot.eyebrow":      ["What it looks like", "长什么样"],
  "shot.h2": [
    "Three screens, and that is the whole thing.",
    "三个页面，就是全部了。",
  ],
  "shot.sub": [
    "No install, no account, no VPN. It opens where somebody sent it.",
    "不用下载，不用注册，不用翻墙。别人发给你，点开就是。",
  ],
  "shot.feed":         ["The feed", "动态"],
  "shot.feedP":        ["Ask, or answer somebody who asked.", "提问，或者回答别人的问题。"],
  "shot.me":           ["Your page", "你的主页"],
  "shot.meP":          ["A face and a name. Nothing else is asked.", "一张照片，一个名字。别的都不问。"],
  "shot.browse":       ["Browse people", "看看有谁"],
  "shot.browseP":      ["Who is here, what they study, and what they can help with.",
                        "这里都有谁、他们学什么、能帮上什么。"],

  // The words inside the drawn phones. Short on purpose — they are read at
  // about eight pixels and the point is the shape, not the sentence.
  "shot.q1":           ["Where do I get a SIM without a Chinese bank card?",
                        "没有国内银行卡，去哪儿办手机卡？"],
  "shot.q1who":        ["Ana · 3 replies", "Ana · 3 条回复"],
  "shot.q2":           ["Which gate at Renmin is open after 10?", "人大哪个门十点以后还开？"],
  "shot.q2who":        ["Marc · 1 reply", "Marc · 1 条回复"],
  "shot.q3":           ["Eight kuai, cash only, gone by ten.", "八块，只收现金，十点就没了。"],
  "shot.q3who":        ["Yuki", "Yuki"],
  "shot.meName":       ["Ana", "Ana"],
  "shot.meFacts":      ["Renmin · 4 months here", "人大 · 来了四个月"],
  "shot.meBio":        ["HSK 4 in March. Happy to read essays.", "三月考 HSK4。可以帮忙看作文。"],
  "shot.meReplies":    ["3 replies", "3 条回复"],
  "shot.brwName":      ["Yuki", "Yuki"],
  "shot.brwWhere":     ["Tsinghua · 8 months here", "清华 · 来了八个月"],
  "shot.brwGoal":      ["Wants an hour a week, out loud.", "想每周说一小时中文。"],
  "site.footWrongP":   ["Report any post from the feed itself — a person reads every one.",
                        "在动态里直接举报任何一条内容——每条都由人来看。"],
  "site.footAbout": [
    "A private meeting place for people in China and the people who want to reach them. Every report read by a person. No accounts, no tracking, nothing loaded from outside.",
    "在中国的人、和想认识中国的人的一个私密聚集地。每一条举报都由人来看。不用账号，不做追踪，不加载任何外部资源。",
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
  "me.newHere":        ["Looking for someone to study with?", "在找一起学习的人吗？"],
  // Says what the list IS, before a button offers to put you on it. "Put me on
  // the list" means nothing if nobody has said what the list is for.
  "me.setUp": [
    "There is a list of people looking for someone to study with — their campus, and which days they are free. Say who you are and they can find you. Your name goes on anything you put up, too.",
    "这里有一份名单，都是在找学习搭子的人——写着学校，还有哪几天有空。说说你是谁，他们就能找到你。你发的内容上也会显示你的名字。",
  ],
  "me.edit":           ["Edit", "编辑"],
  "me.working":        ["One moment…", "稍等…"],
  "me.myPage":         ["My page", "我的主页"],
  "me.needPhoto": [
    "Add a photo first — a profile here has a face on it.",
    "先加一张照片——这里的资料都有照片。",
  ],
  "me.photoFirst":     ["Add your photo", "先加照片"],

  // ---------------------------------------------------------------------
  // The key.
  //
  // There are no accounts here, so there is nothing to sign into — but the
  // random number the browser made up IS the person, and until now it lived
  // only in that browser and could never be seen. Change phone and you were
  // gone, with your posts and your profile no longer yours to delete.
  //
  // The key is that number, shown. Nothing new is stored and nothing personal
  // is asked for; it is the one thing already there, made portable.
  //
  // The warning is not decoration. Whoever holds it is you, and there is no
  // email to reset to and nobody to appeal to — which is the price of holding
  // nothing about anybody.
  // ---------------------------------------------------------------------
  "key.title":         ["Your key", "你的钥匙"],
  "key.body": [
    "This is you. There is no account here and no password — this one line is how you get back in on a new phone. Save it somewhere, now.",
    "这就是你。这里没有账号，也没有密码——换手机之后，就靠这一行回来。现在就存起来。",
  ],
  "key.warn": [
    "Anyone who has it is you. Do not put it in a post.",
    "谁拿到它，谁就是你。不要发在内容里。",
  ],
  "key.copy":          ["Copy", "复制"],
  "key.copied":        ["Copied", "已复制"],
  "key.show":          ["Show my key", "显示我的钥匙"],
  "key.hide":          ["Hide it", "藏起来"],

  "key.have":          ["Been here before?", "以前来过？"],
  "key.enterTitle":    ["Paste your key", "粘贴你的钥匙"],
  "key.enterBody": [
    "From the phone you used before. You will become that person again — their posts, their profile, the people they follow.",
    "从你以前用的手机上拿。粘贴之后，你就又是那个人了——他发的内容、他的资料、他关注的人。",
  ],
  "key.enterPlaceholder": ["Paste it here", "粘贴到这里"],
  "key.go":            ["Use this key", "用这把钥匙"],
  "key.cancel":        ["Cancel", "取消"],
  "key.bad": [
    "That does not look like a key from here. Check you copied all of it.",
    "这看起来不像这里的钥匙。检查一下是不是复制全了。",
  ],
  "key.replaceWarn": [
    "You have already put things up on this phone. Using another key leaves those behind, and you will need this phone's own key to get back to them.",
    "你在这台手机上已经发过内容了。换成别的钥匙之后，那些就留在原处了——想回去，需要这台手机自己的钥匙。",
  ],
  "key.done":          ["Welcome back.", "欢迎回来。"],
  "nav.browse":        ["Browse", "看看"],
  // The arrow that just goes back, wherever back was.
  "nav.back":          ["Back", "返回"],
  "nav.feed":          ["Feed", "动态"],
  "nav.profile":       ["Profile", "我的"],
  "nav.new":           ["Post", "发布"],
  "bud.speaks":        ["Languages", "会说的语言"],
  "bud.type":          ["Type sort", "性格测试"],
  "bud.follow":        ["Follow", "关注"],
  "bud.following":     ["Following", "已关注"],
  // Who followed you, and the button that answers it.
  "fol.head":          ["Following you", "关注了你"],
  "fol.new":           ["{n} new", "{n} 个新的"],
  "fol.back":          ["Follow back", "回关"],
  "bud.followers":     ["{n} following them", "{n} 人关注"],
  "bud.followers1":    ["1 person follows them", "1 人关注"],
  "feed.onlyFollowing":["People I follow", "我关注的"],
  "post.orBuddy": [
    "Looking for someone to study with?",
    "在找一起学习的人？",
  ],
  "post.orBuddyGo":    ["Say so here instead", "到这里说一声"],
  "me.editTitle":      ["Your profile", "你的资料"],
  // Two words for two different acts. Putting yourself up is not the same as
  // changing a detail a week later, and one word for both is why nobody is
  // sure which one they are doing.
  "me.newTitle":       ["A photo and a name", "一张照片，一个名字"],
  "me.post":           ["Post it", "发布"],
  "me.more": [
    "Add more — university, age, languages",
    "再多写点——学校、年龄、会说的语言",
  ],
  "me.age":            ["Age", "年龄"],
  "me.langs":          ["Languages you speak — English, a bit of Chinese",
                        "你会说的语言——英语，一点中文"],
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
  // What a dropped upload says. Not the browser's own words — "Load failed"
  // is true and useless. This one says what happened and what to do, and
  // carries the size, because a photo that is too big for a bad connection is
  // the one case where knowing the number helps.
  "me.didNotGo": [
    "That did not go up — the connection dropped partway ({mb} MB). Try once more.",
    "没能传上去——中途断了（{mb} MB）。再试一次。",
  ],
  // On your own page, where it decides whether sharing the link is worth doing
  // yet. Everywhere else it is a status; here it is a warning.
  "me.photoHeldShare": [
    "Your photograph is still waiting for a person to look at it. You can see it here; anybody you send this to sees a letter until it is through.",
    "你的照片还在等人过目。你自己看得到，但你把链接发给别人，他们看到的会是一个字母，直到审核通过。",
  ],
  "me.photoHeld": [
    "Your photo is up for you, and waiting for a person before anybody else sees it.",
    "你的照片你自己能看到，其他人要等有人过目之后才能看到。",
  ],
  "me.noContact": [
    "Take out {what} — the only ways to be reached a page here carries are Instagram and LinkedIn, each in its own box. Swap anything else privately, once you have both decided.",
    "请去掉 {what} —— 这里的资料只放 Instagram 和领英，各填在自己的框里。其他的等你们都决定了，再私下交换。",
  ],
  "me.whyNoContact": [
    "No phone, no WeChat, no email. Instagram and LinkedIn only, each in its own box — a public list of people with everybody's contact details is the one thing this must never be.",
    "不填手机、微信、邮箱。只有 Instagram 和领英，各填在自己的框里——一份人人联系方式俱全的公开名单，是这里绝对不能变成的东西。",
  ],

  // ---- finding a study buddy -----------------------------------------------
  "bud.title":         ["Study buddies", "学习搭子"],
  "bud.sub":           ["{n} people near you, looking", "附近有 {n} 个人在找"],
  "bud.subOne":        ["1 person near you, looking", "附近有 1 个人在找"],
  "bud.open":          ["Find a study buddy", "找个学习搭子"],
  // Where somebody came from is the deck, not the posts: a profile is reached
  // by browsing or by a link somebody sent, and neither of those started on the
  // feed.
  "bud.back":          ["Back to browsing", "继续看看"],
  "bud.empty.head":    ["Nobody is looking yet.", "还没有人在找。"],
  "bud.empty.body": [
    "Say you are looking and you will be the first. Most people want the same trade — their Chinese for your English.",
    "说一声你在找，你就是第一个。大多数人想要的是同一种交换——他们的中文换你的英文。",
  ],
  "bud.beFirst":       ["Say you are looking", "说你在找"],
  "bud.youAreIn":      ["You are in this list", "你在这个列表里"],
  "bud.takeMeOut":     ["Take me out", "把我移出"],
  "bud.putMeIn":       ["Put me in the list", "把我加进列表"],
  // The sentence for a joining, written on the page rather than on the server,
  // so it is in the language it is being read in.
  /* WHAT THE PERSON ACTUALLY DID. This fires when somebody ticks "Show me in
     Browse", and it used to say they were looking for a study buddy — which
     was the wording of a feature that came out for V1, describing something
     they had not done. */
  "bud.joined":        ["put a page up", "把自己的主页放上来了"],
  "bud.joinedFree":    ["Free", "有空"],
  "bud.joinedGo":      ["See the list", "看名单"],
  "bud.join":          ["Put me on the list", "把我加到名单上"],
  "bud.seeWho":        ["See who is looking", "看看谁在找"],
  // Names what the switch DOES, not how somebody feels. "I am looking for a
  // study buddy" is a mood; being in Browse is a fact about where your page
  // appears, and it is the one thing this switch decides.
  "bud.lookingLabel":  ["Show me in Browse", "在「看看有谁」里显示我"],
  "bud.lookingWhy": [
    "Your page appears in the list of people. Turn it off and you are still here — you just are not in it. Posting never puts you in on its own.",
    "你的主页会出现在名单里。关掉也不会影响你用这个应用，只是不出现在那里。单纯发内容不会把你加进去。",
  ],
  /* ---- what you are looking for, and the card two people may swap ---------
   *
   * THE ROOM NAMES ARE THE WHOLE INTERFACE. There are eleven of them and a
   * person picks three, so each one has to be understood at a glance, in a
   * second language, on a phone. Written as things somebody wants this term —
   * "raising money", not "founder" — because they are not kinds of people:
   * one person is a first-year language student AND raising money for
   * something, and the boxes have to let them be both.
   *
   * The pairing is never named on screen. You tick "raising money" and you
   * come up for somebody who ticked "investing"; nobody has to be told that is
   * how it works, and being told would only make the form look like a machine.
   */
  /* ---- the report card, as a panel about what happened --------------------
     The rows are sentences, not labels: "2 people followed you" rather than
     "Followers 2". A label with a number beside it is a dashboard, and a
     dashboard about a board with eleven people on it is mostly zeros. */
  /* ---- the grade ---------------------------------------------------------
     Every row is a real event with a real number, because one tap shows all of
     them and a grade nobody can take apart is a grade nobody believes. */
  "grade.mark":        ["today's mark", "今天的成绩"],
  "grade.of":          ["{n} points today", "今天 {n} 分"],
  "grade.yesterday":   ["Yesterday you had {g}", "昨天是 {g}"],
  "grade.none":        ["No grade yet today", "今天还没有成绩"],
  "grade.noneWhy": [
    "Answer today's card or put something up, and the day gets a letter. A day you were not here is not a failing day.",
    "答一下今天的卡片，或者发点什么，这一天就有成绩了。没来的那天不算不及格。",
  ],
  "grade.why":         ["Where it came from", "分数是怎么来的"],
  "grade.target":      ["Full marks today", "今天的满分"],
  "grade.card":        ["Answered today's card", "答了今天的卡片"],
  "grade.knew":        ["Knew it", "答对了"],
  "grade.streak":      ["{n} days in a row", "连续 {n} 天"],
  "grade.levelUp":     ["The cards moved up a level", "卡片升了一级"],
  "grade.posted":      ["Put something up", "发了内容"],
  "grade.replied":     ["Answered somebody", "回复了别人"],
  "grade.followed":    ["Followed somebody new", "关注了新的人"],
  "grade.opened":      ["{n} people opened your page", "{n} 个人打开了你的主页"],
  "grade.gotFollowed": ["{n} followed you", "{n} 个人关注了你"],
  "grade.gotReply":    ["{n} replied to you", "{n} 个人回复了你"],
  "grade.match":       ["{n} new match", "{n} 个新匹配"],

  "prof.sinceToday":   ["Since earlier today", "今天早些时候以来"],
  "prof.sinceYesterday": ["Since yesterday", "从昨天起"],
  "prof.since":        ["Since {day}", "从{day}起"],
  "prof.sinceLong":    ["Since you were last here", "自你上次来之后"],
  "prof.opened":       ["people opened your page", "个人打开了你的主页"],
  "prof.sevenDays":    ["7 days", "最近 7 天"],
  "prof.vsLast":       ["7 days · {n} the week before", "最近 7 天 · 上一周 {n} 个"],
  "prof.sparkAlt":     ["Over {n} days: {a} to {b}", "{n} 天里：从 {a} 到 {b}"],
  "prof.regulars":     ["{n} people keep coming back to your page.",
                        "有 {n} 个人反复回到你的主页。"],
  "prof.noName":       ["nobody is named", "不会告诉你是谁"],
  "prof.replied":      ["{who} replied to your post", "{who}回复了你的内容"],
  "prof.followed":     ["{n} people followed you", "{n} 个人关注了你"],
  "prof.joined1":      ["{who} joined", "{who}来了"],
  "prof.joined":       ["{n} people joined", "来了 {n} 个人"],
  "prof.posts":        ["{n} new posts on the board", "板上有 {n} 条新内容"],
  "prof.quiet": [
    "Nobody has posted since you were last here. That is {n} people all waiting for somebody else to go first — you could be the one.",
    "你上次来之后还没有人发东西。也就是说 {n} 个人都在等别人先开口——你可以当那个人。",
  ],
  "prof.quietAlone": [
    "Nothing new yet. You are early here, which is the good problem — put something up and it is the first thing anybody sees.",
    "还没有新东西。你来得早，这是好事——你现在发点什么，就是别人看到的第一条。",
  ],

  "room.lang":         ["Language exchange", "语言交换"],
  "room.lang.sub":     ["My Chinese for your English", "我的中文换你的英文"],
  "room.study":        ["Study partner", "一起学习的伙伴"],
  "room.study.sub":    ["Same course, HSK, IELTS", "同一门课、HSK、雅思"],
  "room.new":          ["New here — want someone who knows the city",
                        "刚来——想认识熟悉这座城市的人"],
  "room.host":         ["Been here a while — happy to show people around",
                        "来了有一阵了——愿意带人转转"],
  "room.job":          ["Looking for work or an internship", "找工作或实习"],
  "room.hire":         ["Hiring, or offering one", "在招人，或者能给实习机会"],
  "room.cofound":      ["Co-founder — building something", "找合伙人——一起做点东西"],
  "room.raise":        ["Raising money", "在融资"],
  "room.invest":       ["Investing, or backing people", "投资，或者支持别人做事"],
  /* THE ONE PAIR THAT IS NOT ABOUT MONEY OR STUDY. A lot of the foreigners
     who end up in China are here on the strength of a face or a portfolio, and
     the people looking for them are a real trade with a real season. Both
     sides in their own words, so nobody has to describe themselves as
     "talent". */
  "room.talent":       ["A model or creative looking for an agent",
                        "模特或创作者，在找经纪"],
  "room.agent":        ["An agent or manager looking for people",
                        "经纪或经纪公司，在找人"],
  "room.buy":          ["Buying or sourcing from China", "从中国采购"],
  "room.sell":         ["Selling or supplying from China", "从中国供货"],

  /* THE SHORT FORM, for the middle of a sentence. "You both want Language
     exchange" reads like a form talking; "you both want a language exchange"
     reads like a person. The box keeps the long label — on a tick box the
     grammar of a sentence is noise. */
  "room.lang.s":       ["a language exchange", "语伴"],
  "room.study.s":      ["a study partner", "学习搭子"],
  "room.new.s":        ["someone who knows the city", "熟悉这座城市的人"],
  "room.host.s":       ["to show people around", "带人转转"],
  "room.job.s":        ["work or an internship", "工作或实习"],
  "room.hire.s":       ["to hire somebody", "招人"],
  "room.cofound.s":    ["a co-founder", "合伙人"],
  "room.raise.s":      ["to raise money", "融资"],
  "room.invest.s":     ["to invest", "投资"],
  "room.talent.s":     ["an agent", "经纪"],
  "room.agent.s":      ["people to represent", "可以代理的人"],
  "room.buy.s":        ["to buy from China", "从中国采购"],
  "room.sell.s":       ["to sell from China", "从中国供货"],

  /* "ask" is not a room anybody ticks on a profile — it is where a question
     goes, and a vocabulary of intentions with nowhere to put a question is one
     people work around. */
  "room.ask":          ["Just asking", "就是问问"],
  "room.ask.s":        ["an answer", "一个答案"],
  "room.showMe":       ["Show me", "看什么"],
  "room.andMore":      ["and {n} more", "等 {n} 个"],
  "room.groupElse":    ["Everything else", "其他"],

  "room.head":         ["What are you looking for?", "你在找什么？"],
  "room.why": [
    "Pick up to three. Other people see these on your page — it is how anybody knows what to ask you about.",
    "最多选三个。别人会在你的主页上看到——他们才知道可以跟你聊什么。",
  ],
  "room.groupStudy":   ["Study & language", "学习与语言"],
  "room.groupSettle":  ["Settling in", "落脚"],
  "room.groupWork":    ["Work & building", "工作与创业"],
  "room.more":         ["Work, money and trade", "工作、融资与贸易"],
  "room.full":         ["Three is the most. Untick one to add another.",
                        "最多三个。想加新的，先取消一个。"],
  "room.none":         ["Nothing picked yet.", "还没有选。"],

  "room.whereHead":    ["Where should they be?", "你想认识哪边的人？"],
  "room.whereMe":      ["You are", "你在"],
  "room.whereThem":    ["You want people", "你想认识的人在"],
  "room.where.cn":     ["In China", "在中国"],
  "room.where.out":    ["Somewhere else", "在其他地方"],
  "room.wants.cn":     ["In China", "在中国"],
  "room.wants.out":    ["Outside China", "在中国以外"],
  "room.wants.any":    ["Either", "都可以"],
  "room.whereWhy": [
    "This board is one side of an exchange and the other side is everywhere else. Answer both and you stop coming up for people on the wrong side of it.",
    "这个板是交换的一边，另一边是世界其他地方。两个都选好，你就不会出现在不相干的人面前了。",
  ],

  /* On somebody else's page. Said before anybody presses anything, because
     both halves of it are already public and telling people the rule up front
     is cheaper than letting them guess at it afterwards. */
  "room.both":         ["You both want {what}", "你们都想找{what}"],
  "room.bothPair":     ["You want {mine} · they want {theirs}", "你想{mine}，他们想{theirs}"],
  "room.nothing":      ["Nothing in common — you can still follow.",
                        "没有共同点——还是可以关注。"],

  /* The match. The word does the least work here: on a board where most people
     tick a couple of the same boxes, "match" fires constantly and the reader
     learns to skip it. The ROOM is the information, so the room is what the
     line says. */
  "match.one":         ["You and {who} both want {what}.", "你和{who}都想找{what}。"],
  "match.pair":        ["You and {who}: you want {mine}, they want {theirs}.",
                        "你和{who}：你想{mine}，他们想{theirs}。"],
  "match.head0":       ["Matches", "匹配"],
  "match.head":        ["You and {who} are after the same thing",
                        "你和{who}想要的是同一件事"],
  /* THE CHAT A MATCH OPENS, offered before the card. See the note in
     matchBox: the first thing a match should buy is somewhere private to
     talk, not somebody's WeChat id. */
  "match.chatWhy": [
    "You can talk to {who} here first — a room only the two of you can see. Either of you can leave it at any time, and neither is told when the other does.",
    "你可以先在这里跟{who}聊——一个只有你们两个人看得见的房间。任何一方随时都可以退出，退出时也不会通知对方。",
  ],
  "match.chatGo":      ["Message {who}", "给{who}发消息"],
  "match.chatSent":    ["Sent. It is in Messages.", "已发送，可以在私信里看到。"],

  "match.why":         ["Why this is a match", "为什么算匹配"],
  "match.becauseOne": [
    "You both want {what}, and you followed each other.",
    "你们都想找{what}，而且互相关注了。",
  ],
  "match.becausePair": [
    "You want {mine}, they want {theirs}, and you followed each other.",
    "你想{mine}，他们想{theirs}，而且你们互相关注了。",
  ],
  "match.none":        ["No matches yet.", "还没有匹配。"],
  "match.noneWhy": [
    "A match is two people who follow each other and are after the same thing. Follow the people you want to read — this happens on its own or it does not happen.",
    "匹配是指互相关注、而且想找的东西对得上的两个人。去关注你想读的人就好——这件事要么自己发生，要么就不发生。",
  ],

  /* The card. The warning is the important string on this screen and it is
     written the way somebody would say it out loud, not the way a policy
     would: what happens, to whom, and what cannot be undone. */
  "card.title":        ["Your card", "你的名片"],
  "card.what": [
    "A WeChat id and one line, kept back until you hand it to somebody. Nobody sees this because they follow you, and nobody sees it because you matched.",
    "一个微信号和一句话，不给出去就没人看得到。别人关注你看不到，匹配了也看不到。",
  ],
  "card.wechat":       ["Your WeChat id", "你的微信号"],
  "card.line":         ["One line — email, company, when to message you…",
                        "一句话——邮箱、公司、什么时候方便联系…"],
  "card.save":         ["Save my card", "保存名片"],
  "card.saved":        ["Saved.", "已保存。"],
  "card.cleared":      ["Cleared. Nobody can open it now.", "已清空。现在谁也打不开了。"],
  "card.none":         ["You have not made one yet.", "你还没有填。"],
  "card.make":         ["Make your card", "填一张名片"],
  "card.out":          ["{n} people are holding it.", "有 {n} 个人拿着。"],
  "card.outNone":      ["Nobody is holding it.", "还没有人拿着。"],
  "card.give":         ["Send {who} my card", "把名片发给{who}"],
  "card.keep":         ["Just keep following", "先只是关注"],
  "card.warn": [
    "If you send your card, {who} sees your WeChat id. You can stop them opening it again, but you cannot take back what they have already read. Send it to people you would give it to in person.",
    "发出去之后，{who}就能看到你的微信号。你可以让他们以后打不开，但已经看过的收不回来。只发给你当面也愿意给的人。",
  ],
  "card.waiting": [
    "Sent. {who} has not sent theirs yet — you will see it here if they do.",
    "已发送。{who}还没有发他们的——如果发了，会出现在这里。",
  ],
  "card.theirs":       ["{who} gave you their card", "{who}把名片给了你"],
  "card.theyAdded":    ["They added", "他们还写了"],
  "card.takeBack":     ["Take my card back", "收回我的名片"],
  "card.takeBackWhy": [
    "Stops {who} opening it again. It does not unsend it.",
    "让{who}以后打不开。已经发出去的收不回来。",
  ],
  "card.gaveBack":     ["Taken back.", "已收回。"],
  "card.offPlatform": [
    "Everything from here happens off this app, which is the point — this board's job was to get the two of you into the same sentence, not to be where you talk.",
    "接下来的事都在这个应用之外发生，这本来就是重点——这个板的任务是让你们两个碰上，不是当你们聊天的地方。",
  ],
  "card.report":       ["Report", "举报"],
  "card.block":        ["Block", "屏蔽"],

  "bud.free":          ["Free", "有空"],
  "bud.trades":        ["Trades", "可以交换"],
  "bud.level":         ["Level", "水平"],
  "bud.here":          ["Here", "来了"],
  "bud.theirPosts":    ["On the feed", "发过的内容"],
  "bud.nothingYet":    ["Nothing on the feed yet.", "还没有发过内容。"],
  /* It used to give advice about meeting somebody — where to go the first
   * time, who to tell. That is a sentence about a thing this app does not ask
   * anybody to do, printed under a photograph, which is a strange place to
   * plant the idea. What is worth saying is the opposite: none of this needs
   * you to give anything away, or to meet anyone at all.
   *
   * IT NO LONGER SAYS "OR YOUR WECHAT". It was printed at the foot of the same
   * page that now shows a card with a WeChat id on it — a promise the screen
   * above it was already breaking. The true version is narrower and still
   * worth saying: nothing is ever asked of you, and the one thing that can be
   * swapped is swapped by two people who each pressed a button for it. */
  "bud.safety": [
    "Nothing here needs your phone number or your documents, and nobody should be asking you for them. A WeChat id is only ever swapped by two people who each chose to. You never have to meet anyone to use this.",
    "这里不需要你的电话或者证件，也不该有人向你要。微信号只在两个人都主动选择的情况下才会交换。你完全不用见面就能用这个应用。",
  ],
  "bud.days":          ["M,T,W,T,F,S,S", "一,二,三,四,五,六,日"],
  "bud.close":         ["Close", "关闭"],
  "bud.noProfile":     ["No profile yet", "还没有资料"],
  "bud.noProfileBody": ["{who} posts here but has not filled anything in.",
                        "{who} 在这里发过内容，但还没有填写资料。"],
  "bud.blockThem":     ["Hide {who}", "隐藏 {who}"],
  "bud.blocked":       ["Hidden on this phone", "已在这台手机上隐藏"],
  "bud.reportThem":    ["Report this profile", "举报这份资料"],

  // ---- browsing people, one at a time ---------------------------------------
  "brw.title":         ["Browse people", "看看有谁"],
  "brw.sub":           ["{n} on the list", "名单上有 {n} 个人"],
  "brw.of":            ["{n} of {total}", "第 {n} 个，共 {total} 个"],
  /* THE DOOR, READ FROM THE INSIDE. Two halves of one line: how many are in,
     then how many are outside. The waiting half only ever renders above the
     floor, so it is safe to write in the plural — nobody will see "5 people
     are waiting" turn into "1 person is". */
  "brw.inside":        ["{n} people are in.", "里面有 {n} 个人。"],
  "brw.atdoor":        ["{n} are waiting to get in.", "另有 {n} 个人在等着进来。"],
  "brw.hello":         ["Say hello", "打个招呼"],

  // ---- the type sort -------------------------------------------------------
  // Ported from Fern. The words that carry the point are the caveat ones: this
  // is the only type product that names the letter least worth trusting.
  // ---- the level test ------------------------------------------------------
  "lvl.eyebrow":       ["Four questions · one minute", "四道题 · 一分钟"],
  "lvl.title":         ["How good is it, really?", "到底什么水平？"],
  "lvl.lede": [
    "Ten levels, from your first week to reading a contract. Four questions is enough to find yours.",
    "十个等级，从刚来的第一周到看得懂合同。四道题就能找到你在哪一级。",
  ],
  "lvl.how": [
    "It starts in the middle and halves what is left each time — right and it goes up, wrong and it comes down. Working up from level one would mean twenty-six questions you were always going to get right.",
    "从中间开始，每答一题就把范围砍一半——答对往上，答错往下。要是从第一级一路往上考，前面二十六题你本来就都会。",
  ],
  "lvl.myChinese":     ["My Chinese", "我的中文"],
  "lvl.myEnglish":     ["My English", "我的英文"],
  "lvl.count":         ["{n} of {total}", "第 {n} 题，共 {total} 题"],
  "lvl.hear":          ["Hear it", "听一下"],
  "lvl.guess":         ["No idea is an answer. Pick one and it will come down a level.",
                        "不会就猜——猜错了它会往下调一级。"],
  "lvl.yours":         ["Around here", "大概在这一级"],
  "lvl.n":             ["Level {n} of 10", "第 {n} 级，共 10 级"],
  "lvl.rough": [
    "Four answers cannot be more certain than four answers. Treat this as a band, not a mark — one careless tap moves it a level.",
    "四道题就是四道题，不可能更准。把它当成一个范围，不是一个分数——手滑一次就差一级。",
  ],
  "lvl.again":         ["Try again", "再测一次"],
  "lvl.put":           ["Add my level to my profile", "把等级加到我的主页"],
  /* THE RESULT, READ TOP TO BOTTOM. What you are, what that means you can do,
     three facts about the run, and the one thing to do next. */
  "lvl.headline":      ["{band} \u2014 Level {n} of 10", "{band} \u2014 第 {n} 级，共 10 级"],
  "lvl.canNow":        ["What you can do now", "你现在能做到的"],
  "lvl.stTime":        ["Time", "用时"],
  "lvl.stRough":       ["Roughly", "大约"],
  "lvl.stWas":         ["Last time", "上次"],
  "lvl.stWasN":        ["Level {n}", "第 {n} 级"],
  /* The two scales a student is actually asked about, and the only two this
     has any business naming. "Roughly" is doing real work in that label: four
     questions do not place anybody on HSK or CEFR, they point at a band. */
  "lvl.hsk1":          ["HSK 1", "HSK 1"],
  "lvl.hsk23":         ["HSK 2\u20133", "HSK 2\u20133"],
  "lvl.hsk4":          ["HSK 4", "HSK 4"],
  /* WHAT WAS ABOVE YOU, not "your mistakes". In a search that halves the range
     each time, the ones you got wrong are the ones above your level — that is
     the mechanism working, not you failing, and calling them mistakes would
     teach somebody the opposite of what the screen is for. */
  "lvl.above":         ["What was just above you", "刚好比你高一点的"],
  "lvl.nextUp":        ["Next up", "接下来"],
  /* PK \u2014 a challenge that travels as a link.
     The word is PK in both languages because that is what it is called in
     Chinese, and an English translation of it would be the longer word. */
  "pk.title":          ["PK", "PK"],
  "pk.from":           ["{who} came out level {n} of 10 in {lang}.",
                        "{who} 的{lang}测出来是第 {n} 级，满分 10 级。"],
  "pk.beat":           ["Four questions. See where you land.", "四道题，看看你在哪一级。"],
  "pk.take":           ["Take the same test \u2192", "来做同一套题 \u2192"],
  "pk.other":          ["Or rank my {lang} instead", "或者改成测我的{lang}"],
  "pk.you":            ["You", "你"],
  "pk.won":            ["You are ahead.", "你领先。"],
  "pk.lost":           ["{who} is ahead \u2014 for now.", "{who} 领先——暂时的。"],
  "pk.tie":            ["Level pegging.", "打平。"],
  "pk.back":           ["Send it back \u2192", "回敬一局 \u2192"],
  "pk.challenge":      ["PK a friend \u2192", "叫朋友来 PK \u2192"],
  "pk.words":          ["I came out level {n} of 10 in {lang}. Beat that:",
                        "我的{lang}测出来是第 {n} 级，满分 10 级。你来超过我："],
  "pk.sent":           ["Sent. They get the same four questions.",
                        "发出去了，他们做的是同一套题。"],
  /* ONE CARD A DAY, drawn for the reader at the top of their own feed. Not a
     post: see daily.js for why fifty people would otherwise mean fifty cards a
     morning on a board everybody shares. */
  "day.today":         ["today", "今天"],
  /* ONE FOLD FOR ALL OF IT. The heading of the section that holds the card of
     the day and the two tests, and the line under it that says what is inside
     without opening it. */
  "prof.title":        ["From the Professor", "教授给你的"],
  "prof.sub":          ["Your report card", "你的成绩单"],
  "prof.nothing":      ["Two short tests, and a card a day", "两个小测试，每天一张卡"],
  "prof.waiting":      ["Today's card is waiting", "今天的卡还没做"],
  "prof.cardDone":     ["Today's card done", "今天的卡做完了"],
  "prof.noLevel":      ["No level yet", "还没测等级"],
  "prof.noType":       ["No letters yet", "还没测字母"],
  /* THE FIRST THING INSIDE THE FOLD. Opening a report card and having to read
     a summary line to find your own level is a report card that buries the
     mark it is named after. */
  "prof.now":          ["Where you are now", "你现在的水平"],
  /* ---- the door ----------------------------------------------------------
     Three screens: get out of WeChat, six characters, come in. The middle one
     is the shortest and the first one is the one that matters. */
  "door.wxTitle":      ["Open this in your browser", "用浏览器打开"],
  "door.wxSub":        ["Before you use your code", "先别急着输口令"],
  "door.wxSay": [
    "You are in WeChat's browser. It keeps its own storage, so a page opened here and the same page opened in Safari are two different people — and the one you use your code in is the one your profile lives in.",
    "你现在在微信的浏览器里。它的存储是单独的：在这里打开，和在 Safari 里打开，算两个人——你在哪个浏览器里用口令，主页就长在哪个浏览器里。"],
  "door.wxZh":         ["", ""],
  "door.wxStep1":      ["Tap the three dots, top right", "点右上角的三个点"],
  "door.wxStep2":      ["Open in Browser", "在浏览器打开"],
  "door.wxCopy":       ["Copy the link instead", "复制链接"],
  "door.wxCopied":     ["Copied — paste it in Safari", "已复制，去 Safari 粘贴"],
  "door.wxCopyNo":     ["Hold the address bar to copy it", "长按地址栏复制"],
  "door.wxNote":       ["Your code still works there. Use it once you have arrived.",
                        "口令在那边一样能用。到了再输。"],
  "door.wxAnyway":     ["Use it here anyway", "还是在这里用"],

  "door.title":        ["You have been invited", "有人邀请你"],
  /* THE MEMBER'S OWN INVITE, in the header where the count is. One live code
     each: it comes back the same until somebody spends it. */
  /* A headline, not a label. An uppercase micro-label set large only gets
     shouty; a sentence in the serif everything else here is set in reads as
     the offer it is. */
  "inv.head":          ["Bring someone in", "带一个人进来"],
  "inv.tap":           ["Today’s password. One person, then it changes.",
                        "今天的口令。进一个人，然后就换。"],
  /* One line on a profile, and the whole of the vouch. */
  "inv.brought":       ["Brought in by {who}", "{who}带进来的"],
  "inv.send":          ["Send the invite", "把邀请发出去"],
  /* AND ONTO THE FEED, on its own. Everybody who can read the feed is already
     in, so this is not how strangers arrive — it is how somebody who has spent
     their own code today finds a spare to pass on. */
  "inv.toFeed":        ["Put it on the feed", "发到动态里"],

  /* NO CODE, AND WHY. The head is deliberately not "you cannot invite anyone":
     the sentence a member should leave with is what an invitation is, not what
     they have been refused. Each line below is one of the four tests in
     standing() on the server, written as the thing you do rather than the
     thing you failed. */
  /* INVITE SOMEONE, not make an invite and not get one.
     "Get an invite" is what somebody outside the door does — the person
     reading this is already in. "Make an invite" is the machinery: nobody
     wants a code, they want the person. And "a friend" narrows it on a board
     that is for networking as much as for friends — the man bringing a
     supplier he trusts is not bringing a friend. "Someone" covers both, and
     it is the word the box already uses one state along: Bring someone in. */
  /* THINGS TO DO. Every one an instruction short enough to read at a glance
     and specific enough to act on without opening anything to find out what it
     means. No "complete your profile" — that is a category, not a task. */
  "todo.head":         ["Things to do", "接下来做这几件事"],
  "todo.more":         ["{n} more after these.", "后面还有 {n} 件。"],
  "todo.name":         ["Make your page.", "先把你的主页建起来。"],
  "todo.photo":        ["Add your photo.", "加一张你的照片。"],
  "todo.browse":       ["Turn on “Show me in Browse”.", "把「在名单里显示我」打开。"],
  "todo.rooms":        ["Pick your rooms.", "选你的房间。"],
  "todo.goal":         ["Say what you are looking for.", "写一句你在找什么。"],
  "todo.level":        ["Take the level test.", "做一下水平测试。"],
  "todo.card":         ["Answer today’s card.", "答一下今天的卡片。"],
  "todo.post":         ["Post something.", "发一条内容。"],
  "todo.week":         ["Post 2 things this week.", "这周发 2 条内容。"],

  "inv.needHead":      ["How to invite someone", "怎么邀请别人进来"],
  "inv.needWhy": [
    "Whoever you bring in has your name on them. So first:",
    "你带进来的人，是挂着你的名字进来的。所以先做到：",
  ],
  "inv.needFace": [
    "Be in Browse — add a photo, turn the switch on.",
    "出现在名单里——加一张照片，把开关打开。",
  ],
  "inv.needDays":      ["Be here 3 days.", "在这里待满 3 天。"],
  "inv.needSaid":      ["Post 2 things this week.", "这周发 2 条内容。"],
  "inv.needGuests": [
    "The people you brought are still here, and posting.",
    "你带进来的人还在，并且在发内容。",
  ],
  "inv.needRoom": [
    "Wait — you have {n} guests in already.",
    "等一下——你已经带了 {n} 个人进来。",
  ],
  "inv.feedWords":     ["A spare invite, if anybody needs one. It works once.\n\n{url}\n\nPassword: {code}",
                        "多的一个口令，谁要谁拿，只能用一次。\n\n{url}\n\n口令：{code}"],
  "inv.onFeed":        ["It is on the feed.", "已经发到动态里了。"],
  "inv.codeTap":       ["Copy the code", "复制口令"],
  "inv.codeDone":      ["Copied", "已复制"],
  "inv.copied":        ["Copied. Paste it into a chat.", "复制好了，粘到聊天里就行。"],
  "inv.copyNo":        ["Hold to copy: {code}", "长按复制：{code}"],
  /* TWO LETTERS, BECAUSE THEY ARE READ IN DIFFERENT PLACES.
   *
   * Pasted into WeChat, the link will be tapped inside WeChat's browser, and
   * whoever taps it meets a screen telling them to get out of it. Saying so in
   * the message beats making somebody read an instruction after they have
   * already tapped — so the WeChat letter carries the step and the other one
   * does not need to.
   */
  "inv.sharedWx": [
    "This is the students' board I mentioned — 留学生. It is private: nobody can open it without a password, and mine changes every day. Here is today's, good for one person.\n\n{url}\n\nPassword: {code}\n\nOpen it in Safari, not in here — tap ··· at the top right, then Open in Browser. WeChat's browser forgets you.",
    "就是我说的那个留学生的板子。那里是私密的，没有口令谁也打不开，我的口令每天还会换。这是今天的，只能进一个人。\n\n{url}\n\n口令：{code}\n\n别在微信里打开——点右上角的 ···，选「在浏览器打开」。微信的浏览器记不住你。"],
  "inv.shared": [
    "This is the students' board I mentioned — 留学生. It is private: nobody can open it without a password, and mine changes every day. Here is today's, good for one person.\n\n{url}\n\nPassword: {code}",
    "就是我说的那个留学生的板子。那里是私密的，没有口令谁也打不开，我的口令每天还会换。这是今天的，只能进一个人。\n\n{url}\n\n口令：{code}"],
  "inv.locked":        ["Private — nothing here opens without today’s password.",
                        "私密——没有今天的口令，这里什么都打不开。"],
  /* The two lines the board says about itself change with the door. "Anyone
     can read" is true with the door open and a plain lie with it shut. */
  "inv.taglineShut":   ["Invite only. One password each, and it changes every day.",
                        "邀请制。一人一个口令，每天都换。"],
  "inv.countShut":     ["{n} posts up. Invite only.", "已发布 {n} 条。邀请制。"],
  "inv.one":           ["One person each, and a new one tomorrow.",
                        "一个口令进一个人，明天再给你一个新的。"],
  "door.sub":          ["Not open to everybody yet", "还没有对所有人开放"],
  "door.say":          ["This board is private \u2014 nothing on it can be read without a password. Type the one your friend sent. It works once, on this browser, and their password changes tomorrow. The link on its own opens nothing.",
                        "这个板子是私密的——没有口令，里面什么都看不到。输入朋友发给你的那串。只能用一次，只在这个浏览器上；他的口令明天就换了。光有链接是打不开的。"],
  "door.zh":           ["", ""],
  "door.go":           ["Go in", "进去"],
  "door.going":        ["Opening\u2026", "正在开门\u2026"],
  "door.note":         ["No account, no password, no phone number. The code is the whole of it.",
                        "没有账号，没有密码，也不用手机号。就这一串口令。"],
  /* Each refusal says the thing worth knowing. "Used" needs two sentences,
     because the commonest cause of it is the same person in another browser. */
  "door.wrong": [
    "That code did not match. Check the last character \u2014 codes have no O, no zero, no I and no one in them. {n} tries left this hour.",
    "口令不对。看看最后一位——口令里没有 O、0、I、1 这几个字符。这一小时还能试 {n} 次。"],
  "door.used": [
    "This one has been used already. Each code lets one person in and then stops working. If that was you on another browser, you do not need a new code \u2014 paste your key below instead.",
    "这个口令已经用过了。每个口令只能进一个人。如果那是你自己在别的浏览器上用的，你不需要新口令——把钥匙贴在下面就行。"],
  "door.slow":         ["Too many tries. Wait an hour, or ask for a fresh code.",
                        "试得太多了。等一个小时，或者再要一个新口令。"],
  "door.offline":      ["That did not go through. Try again.", "没发出去，再试一次。"],

  /* FOLDED AWAY, because almost nobody reading this screen has ever had a key
     and the word means nothing to them. One quiet line they can ignore, and
     explained from nothing the moment somebody opens it — which only happens
     when they already need it, and a person who needs it will read. */
  "door.keyOpen":      ["I have used this board before", "我以前用过这个板子"],
  "door.keyTitle":     ["Been here before?", "以前来过？"],
  "door.keySay": [
    "When you joined, this board gave you a key — one long line of letters and numbers. It is how you stay the same person on a second phone or browser, since there is no account to sign back into. Paste it here and you are in, without spending anybody's password.",
    "你当初进来的时候，这里给过你一把「钥匙」——很长的一串字母和数字。这里没有账号可以登录，换手机、换浏览器还想是同一个人，靠的就是它。贴在这儿就能进，不用花别人的口令。"],
  "door.keyWhere":     ["On your other browser it is under Profile → Show my key.",
                        "在你原来那个浏览器里：「我的」→「显示我的钥匙」。"],
  "door.keyHint":      ["Your key", "你的钥匙"],
  "door.keyGo":        ["Use my key", "用我的钥匙"],
  "door.keyNo":        ["That key has not been let in yet. Use a code first.",
                        "这把钥匙还没进过门。先用一次口令。"],

  "door.inTitle":      ["You are in", "进来了"],
  "door.inSub":        ["Welcome", "欢迎"],
  "door.byWho":        ["{who} let you in", "{who} 带你进来的"],
  "door.inSay":        ["A photo, a name, and a line about you. Two minutes, and the others can find you.",
                        "一张照片、一个名字、一句话。两分钟，别人就能找到你了。"],
  "door.inZh":         ["", ""],
  "door.inGo":         ["Have a look around", "进去看看"],
  /* Where somebody learns what a key is: the one moment they have one. */
  "door.inNote":       ["Before you close this, save your key \u2014 Profile \u2192 Show my key. There are no accounts here, so that line is the only way to be you again on another phone.",
                        "关掉之前把钥匙存好——「我的」→「显示我的钥匙」。这里没有账号，换个手机想还是你自己，只能靠那一行。"],
  /* THE TRAY. Everything addressed to this person, in one place — follows and
     the card of the day. The report card below it is what they are; this is
     what has arrived. */
  "notif.title":       ["For you", "给你的"],
  "notif.none":        ["Nothing new. Follows and your card of the day arrive here.",
                        "暂时没有新的。有人关注你，还有每天那张卡，都会到这儿来。"],
  /* Asked once, then it is a line they can change their mind on. */
  "notif.askFeed":     ["Would you rather see the card of the day in your feed?",
                        "每天那张卡，你更想在动态里看到吗？"],
  "notif.yesFeed":     ["Yes, in my feed", "好，放动态里"],
  "notif.noFeed":      ["No, keep it here", "不用，就放这儿"],
  "notif.inFeed":      ["The card of the day is in your feed. Move it back here",
                        "每天那张卡在动态里。搬回这儿"],
  "notif.inTray":      ["The card of the day is here. Move it to my feed",
                        "每天那张卡在这儿。搬到动态里"],
  "prof.nolevelBig":   ["No level yet", "还没有等级"],
  "prof.nolevelWhy":   ["Four questions and you have one.", "四道题，你就有了。"],
  /* WHAT THIS CARD IS, for somebody who has just found it at the top of their
     feed and has no idea why a word is being shown to them. Folded away,
     because it is read once and then never again. */
  "day.what":          ["What is this?", "这是什么？"],
  "day.about1": [
    "One card a day, picked for the level you tested at. Only you see it \u2014 it is drawn for you here, not posted to the board.",
    "每天一张，按你测出来的水平挑。只有你能看到——它是在这儿给你一个人画出来的，不是发到板上的。"],
  "day.about2": [
    "Say you knew it and the cards move up. Miss one and they drop back a level. Three known in a row moves you up.",
    "说「我认识」，卡片就往上走；错一张，就退回一级。连着三张认识，升一级。"],
  "day.about3": [
    "The mark beside your name still comes from the four questions. Pressing \u201cI knew it\u201d is a claim; the test is the proof.",
    "名字旁边的称号还是看那四道题。点「我认识」只是你自己说的，测试才算数。"],
  "day.atLevel":       ["Level {n}", "第 {n} 级"],
  "day.show":          ["Show me", "看答案"],
  "day.knew":          ["I knew it", "我认识"],
  "day.didnt":         ["I didn't", "不认识"],
  "day.done":          ["That is today's. Another one tomorrow.",
                        "今天这张就到这儿，明天还有一张。"],
  "day.streak":        ["{n} known in a row.", "连着 {n} 张都认识。"],
  "day.up":            ["Your cards move up a level.", "你的卡片升一级。"],
  "day.down":          ["Your cards drop back a level.", "你的卡片降回一级。"],
  "day.band":          ["Your cards are in {name} now.", "你的卡片进入「{name}」了。"],
  "day.only":          ["Only you see this card.", "这张卡只有你看得到。"],
  "day.noTest":        ["These are at level {n} until you take the test.",
                        "在你做那四道题之前，这些都按第 {n} 级来。"],
  "day.retest": [
    "Your cards are running above what you tested at. Take it again and the mark beside your name can move too.",
    "你的卡片已经高过你测出来的水平了。再测一次，名字旁边的称号才会跟着动。"],
  "day.takeTest":      ["Take the four questions", "去做那四道题"],
  "lvl.aboveWhy":      ["You missed these, which is how the four questions found your level.",
                        "这几题你没答对——四道题就是这样找到你的水平的。"],
  "crown.newMark":     ["New mark: {name}", "新称号：{name}"],
  "crown.newMarkWhy":  ["Your level moved you up a mark.", "你的等级把称号往上推了一格。"],
  /* SOMEWHERE TO BE FOUND THAT IS NOT THIS BOARD. Optional, in the fold with
     the other optional things, and said plainly: a handle on a page is a
     handle anybody who opens the page can read. */
  "me.ig":             ["Instagram (optional)", "Instagram（选填）"],
  "me.igWhy":          ["Anybody who opens your page can see it.",
                        "打开你主页的人都能看到。"],
  "me.igName":         ["Instagram", "Instagram"],
  /* LINKEDIN. The reason to have it is the reason this board stopped calling
     itself the students board: the thing a business contact looks up before
     answering is not a grid of photographs. The warning is stronger than
     Instagram's because a LinkedIn is a real name and an employer. */
  "me.li":             ["LinkedIn (optional)", "领英（选填）"],
  "me.liWhy": [
    "Anybody who opens your page can see it — and a LinkedIn usually carries your real name and where you work.",
    "任何打开你主页的人都能看到——而领英上通常有你的真名和工作单位。",
  ],
  "me.liName":         ["LinkedIn", "领英"],
  /* THE MARK. Named where the strings live rather than beside the drawing,
     because these are read by people and the drawing is not. */
  "crown.what":        ["What you are wearing now", "你现在戴的"],
  "crown.zh":          ["Chinese", "中文"],
  "crown.en":          ["English", "英文"],
  "crown.next":        ["Two more levels and it changes shape again.",
                        "再上两级，它还会变个样子。"],
  "crown.top":         ["The last one. There is nothing above it.",
                        "最后一个了，上面没有了。"],
  "crown.shown":       ["It appears beside your name once your level is on your page.",
                        "把等级放到主页上，它就会出现在你名字旁边。"],
  "crown.is":          ["It is beside your name in Browse.", "它已经在「看看谁在」里你的名字旁边了。"],
  /* WHAT TO DO ABOUT THE NUMBER. A rank on its own is a verdict; the useful
     half is the next hour, and Study Pal already writes that hour. */
  "lvl.classTitle":    ["A class at this level", "来一节这个水平的课"],
  "lvl.classSay": [
    "Study Pal writes you one for a place you will actually stand in: a short conversation at your level, the words inside it, then two more ways to use them.",
    "Study Pal 按你的水平写一节课，场景是你真会遇到的：一段短对话，把里面的词挑出来，再给两个用法。"],
  "lvl.classGo":       ["Take a class \u2192", "去上这一节 \u2192"],
  /* While the lesson route is not yet deployed on Study Pal's machine — see
     STUDYPAL in level.html. Says the extra tap out loud rather than promising
     a class at your level and landing somewhere else. */
  "lvl.classSayDoor": [
    "Study Pal writes one for a place you will actually stand in: a short conversation, the words inside it, then two more ways to use them. Open it and press Take a lesson, then pick {band}.",
    "Study Pal 会写一节真实场景的课：一段短对话，把里面的词挑出来，再给两个用法。打开之后点「Take a lesson」，再选「{band}」。"],
  "lvl.classAway":     ["Opens Study Pal \u00b7 liuxuesheng.help",
                        "会打开 Study Pal \u00b7 liuxuesheng.help"],
  /* Study Pal's own three bands, in its own words, because the link hands it
     one of these and the person should see the same name at both ends. */
  "lvl.spNew":         ["New here \u00b7 HSK 1", "刚来 \u00b7 HSK 1"],
  "lvl.spGetting":     ["Getting by \u00b7 HSK 2\u20133", "能应付 \u00b7 HSK 2\u20133"],
  "lvl.spComfortable": ["Comfortable \u00b7 HSK 4", "比较自如 \u00b7 HSK 4"],
  "lvl.had":           ["You came out at level {n} last time.", "你上次是第 {n} 级。"],
  "lvl.honest": [
    "Nobody sees this unless you put it on your page. The questions are a first draft.",
    "除非你自己放到主页上，否则没人看得到。题目还是初稿。",
  ],

  "type.eyebrow":      ["Twenty choices · two minutes", "二十道选择 · 两分钟"],
  // Say which test this is in the first line. "A personality test" could be
  // anything; the four letters are the thing people already recognise, and
  // showing four of the sixteen says it faster than naming the instrument.
  "type.title":        ["The four letters", "那四个字母"],
  "type.egs":          ["INFJ · ESTP · ENFP · ISTJ", "INFJ · ESTP · ENFP · ISTJ"],
  "type.lede": [
    "The type test most people mean — the sixteen four-letter codes. Twenty pairs, no middle option, no right answers.",
    "就是大家常说的那个性格测试——十六种四字母类型。二十组二选一，没有中间选项，也没有标准答案。",
  ],
  // The reason to take this one rather than any of the others.
  "type.lean": [
    "The difference here: it shows which way you LEAN on each of the four, and how far. A letter decided 3-2 and a letter decided 5-0 look identical everywhere else. Here they do not.",
    "这个测试不一样的地方：它会告诉你在这四条上各自偏向哪边、偏多少。别处 3 比 2 定下的字母和 5 比 0 定下的字母看起来一模一样，这里不会。",
  ],
  "type.start":        ["Start", "开始"],
  "type.count":        ["{n} of {total}", "第 {n} 题，共 {total} 题"],
  "type.back":         ["← back one", "← 退回上一题"],
  "type.yours":        ["Where you sat", "你的结果"],
  "type.again":        ["Take it again", "再做一次"],
  "type.done":         ["Back to browsing", "继续看看"],
  "type.put":          ["Add my four letters to my profile", "把四个字母加到我的主页"],
  "type.puton":        ["It is on your profile.", "已经加到你的主页了。"],
  // The letters travel in the words, not in the link. There is no page that
  // says INFJ about somebody who has not chosen to say it themselves.
  // ---- a result, put on the feed -------------------------------------------
  // Written as somebody would write it about themselves, because that is who
  // is posting. Not "user completed the type sort".
  /* NAME WHAT GETS POSTED. "Put this on the feed" was read as sending the
     page itself rather than the result on it — the word "this" has a whole
     screen to point at, and it picked the wrong half. */
  "share.feed":        ["Post my result", "把成绩发到动态"],
  "share.feedLvl":     ["A card with your level on it, under your name.",
                        "会以你的名义发一张卡片，上面是你的等级。"],
  "share.feedType":    ["A card with your four letters on it, under your name.",
                        "会以你的名义发一张卡片，上面是你的四个字母。"],
  "share.takeIt":      ["Take it yourself", "你也来测测"],
  "share.cardTap":     ["Tap to take it \u2192", "点一下，你也测测 \u2192"],
  // Sending the test itself. Written as an invitation rather than as a link:
  // this is the one that brings somebody who has never been here.
  "share.invite":      ["Send this to a friend", "发给朋友"],
  "share.inviteType":  ["Which of the sixteen are you? Twenty choices, two minutes:",
                        "你是十六种里的哪一种？二十道选择，两分钟："],
  "share.inviteLevel": ["How good is your Chinese, really? Four questions:",
                        "你的中文到底什么水平？四道题就知道："],
  "share.up":          ["Posted. It is on the feed.", "发好了，已经在动态里。"],
  "share.type":        ["I came out {code}.", "我做出来是 {code}。"],
  "share.typeTitled":  ["I came out {code} — {title}.", "我做出来是 {code}——{title}"],
  "share.levelZh": [
    "My Chinese came out at level {n} of 10 — {band}. {can}",
    "我的中文测出来是第 {n} 级（共 10 级）——{band}。{can}",
  ],
  "share.levelEn": [
    "My English came out at level {n} of 10 — {band}. {can}",
    "我的英文测出来是第 {n} 级（共 10 级）——{band}。{can}",
  ],

  "type.share":        ["I came out {code}. Twenty choices, two minutes:",
                        "我做出来是 {code}。二十道选择，两分钟："],
  "type.shareTitled":  ["I came out {code} — {title}. Twenty choices, two minutes:",
                        "我做出来是 {code} —— {title}。二十道选择，两分钟："],
  "type.outOf":        ["{n} of {total} answers", "{total} 题里有 {n} 题"],
  // Said in the same breath as the code, never below the fold: an axis
  // answered 3-2 produces a letter as confidently as one answered 5-0.
  "type.soft": [
    "Your {a} / {b} letter is the closest to the middle — that is the one most likely to come out differently another day.",
    "你的「{a} / {b}」这条最接近中间——换一天再做，最可能变的就是这个字母。",
  ],
  "type.softTitle": [
    "One axis sits close enough to the middle that the name above would change on a different day. The letters hold up better than the title does.",
    "有一条几乎在正中间，所以上面那个名字换一天就可能不一样。字母比名字靠得住。",
  ],
  "type.honest": [
    "Nobody sees this unless you put it on your page. The questions are a first draft and the result is a description, not a diagnosis.",
    "除非你自己放到主页上，否则没人看得到。题目还是初稿，结果是一种描述，不是诊断。",
  ],
  "tut.typeGo": [
    "INFJ, ESTP and the other fourteen. Twenty quick choices — and it tells you which way you lean, not just the letters.",
    "INFJ、ESTP，还有另外十四种。二十道快速选择——它还会告诉你每条偏向哪边，不只给你四个字母。",
  ],
  // The row under the deck, and the card at the end of it. Both only exist
  // while there is no face on this phone, and both go the moment there is.
  "brw.you":           ["You", "你"],
  "brw.mine":          ["Add your photo", "加上你的照片"],
  "brw.mineWhy":       ["Nobody here can see who you are yet.", "这里还没人知道你是谁。"],
  // Your own card is not in the deck — browsing your own photograph is not a
  // feature — so this row is the only place in the app that answers "did my
  // face go up?". It has to answer it in both of the states that follow.
  "brw.mineHeld":      ["Your photo is in", "照片已经收到"],
  "brw.mineHeldWhy": [
    "You can see it. A person looks at every photograph before anybody else does.",
    "你自己看得到。每张照片都要先由人过目，之后别人才看得到。",
  ],
  // The one that says you are NOT in it, which is a thing a page can be: your
  // own page exists, has a face on it, and is not in the deck because the
  // switch is off. Every page made before that switch was on the form is here.
  "brw.mineOff":       ["You are not in Browse", "你还没出现在名单里"],
  "brw.mineOffWhy": [
    "Your page is made, but it is not in the list of people. Tap to turn Show me in Browse on.",
    "你的主页已经做好了，但还没出现在学生名单里。点一下打开「在名单里显示我」。",
  ],
  "brw.mineUp":        ["You are in Browse", "你已经在名单里了"],
  "brw.mineUpWhy": [
    "This is what everybody else sees when they find you.",
    "别人找到你的时候，看到的就是这些。",
  ],
  "brw.yourTurn":      ["Your turn", "该你了"],
  "brw.yourTurnWhat": [
    "That is everyone. Put your own face up and you are on the list too.",
    "人就这些了。把你自己的照片放上来，你也就在名单上了。",
  ],
  "brw.next":          ["Next", "下一个"],
  "brw.none":          ["Nobody on the list yet", "名单上还没有人"],
  // Named the study-buddy list, which is not in V1 — and said "nobody", which
  // is wrong for the commonest case: somebody whose own page exists and is
  // switched off is reading this about themselves.
  "brw.noneBody": [
    "Nobody is showing in Browse yet. Put your photo up and you are the first person anybody sees.",
    "还没有人在这里显示。把你的照片放上来，你就是别人第一个看到的人。",
  ],
  "brw.open":          ["Browse students", "看看有谁"],
  // "the study-buddy list" named a page that is not in V1.
  "brw.openWhat": [
    "Everybody who asked to be findable, with what they are studying.",
    "所有愿意被找到的人，还有他们在学什么。",
  ],

  // ---- the tutor ------------------------------------------------------------
  "tut.name":          ["The Tutor", "导师"],
  "tut.hi": [
    "I am the Tutor. I help you work out what to do here.",
    "我是导师。帮你想清楚在这里能做什么。",
  ],

  // The two that exist. Kept apart from the three that do not, because a list
  // where half the buttons lead nowhere teaches people not to press any of them.
  "tut.now":           ["You can do these now", "现在就能做"],
  "tut.setup":         ["Set up your page", "填好你的资料"],
  "tut.setupWhat":     ["A photo, a name, and a line about you. Two minutes.",
                        "一张照片、一个名字，一句关于你的话。两分钟。"],
  "tut.buddy":         ["Find a study buddy", "找学习搭子"],
  "tut.buddyWhat":     ["Who is looking, which campus, which days they are free.",
                        "谁在找、在哪个学校、哪几天有空。"],
  "tut.go":            ["Open", "打开"],

  // The three that do not.
  // One thing left in this group, so it is no longer a question about which.
  "tut.next":          ["Not built yet", "还没做的"],
  "tut.type":          ["The four-letter type test", "四个字母的性格测试"],
  "tut.level":         ["Test your Chinese or English", "测测你的中文或英文"],
  "tut.levelGo": [
    "Four questions, one minute. Ten levels, and it finds yours by halving the range each time.",
    "四道题，一分钟。十个等级，每答一题范围减半，很快就能定位。",
  ],
  "tut.typeWhat": [
    "Twenty quick choices, two minutes. It names the one answer least settled in you.",
    "二十道快速选择，两分钟。它会告诉你哪一项最不稳定。",
  ],
  "tut.compare":       ["Compare yourself with a friend", "和朋友比一比"],
  "tut.compareWhat": [
    "How far apart the two of you sit, and where the difference actually shows.",
    "你们俩差多远，差别具体在哪里。",
  ],
  "tut.language":      ["A language test", "语言水平测试"],
  "tut.languageWhat": [
    "Where your Chinese actually is, rather than which class you were put in.",
    "你的中文到底在什么水平，而不是你被分到哪个班。",
  ],
  "tut.pick":          ["I would use this", "我会用这个"],
  "tut.onList":        ["Noted", "记下了"],
  "tut.honest": [
    "This one does not exist yet — pressing only tells me somebody wants it.",
    "这个还没做——按一下只是告诉我有人想要。",
  ],

  // ---- notes: one message, answered once -----------------------------------
  "note.say":          ["Say hello", "打个招呼"],
  "note.title":        ["Write to {who}", "写给 {who}"],
  "note.how": [
    "Only {who} sees this. Put your WeChat in it if you want them to reach you — that is what it is for. You get one message; they can answer once. After that you carry on wherever you swapped.",
    "只有 {who} 能看到。想让对方联系你，就把微信号写进去——这条消息就是干这个用的。你只能发一条，对方可以回一条。之后就到你们交换的地方去聊。",
  ],
  "note.placeholder":  ["Hi — I am also at Tsinghua on Tuesdays. WeChat: …",
                        "你好——我周二也在清华。微信：…"],
  "note.send":         ["Send it", "发送"],
  "note.sending":      ["Sending…", "发送中…"],
  "note.answerIt":     ["Answer", "回复"],
  "note.answerHow": [
    "One answer, and then this is finished. If you want to carry on, put something in it they can reach you on.",
    "只能回一条，回完就结束了。想继续聊的话，把联系方式写进去。",
  ],
  "note.sent":         ["Sent. It is theirs to answer now.", "已发送。等对方回复。"],
  "note.waiting":      ["You have written to {who}. It is theirs to answer.",
                        "你已经写给 {who} 了。等对方回复。"],
  "note.closed":       ["You have both written. Carry on where you swapped.",
                        "你们都写过了。到交换的地方继续聊吧。"],
  /* AN OPEN THREAD, which only two people who matched ever have. The words
     are deliberately plainer than the introduction's: an introduction is a
     thing you compose, a conversation is a thing you are in. */
  "note.write":        ["Write", "写点什么"],
  "note.openHow": [
    "You matched, so this one stays open. Either of you can leave it at any time, and neither of you is told when the other does.",
    "你们匹配上了，所以这个对话会一直开着。任何一方随时都可以退出，退出时也不会通知对方。",
  ],
  "note.leave":        ["Leave this chat", "退出这个对话"],
  "note.leaveSure": [
    "Leave the chat with {who}? Neither of you can write again. {who} is not told.",
    "退出和 {who} 的对话？之后你们都不能再写了。{who} 不会收到通知。",
  ],
  "note.shut":         ["This conversation is closed.", "这个对话已经结束了。"],
  "note.needProfile":  ["Fill in your own profile first — an introduction from nobody is not one.",
                        "先填好自己的资料——没有名字的自我介绍不算自我介绍。"],
  "note.enough":       ["That is enough messages for one day.", "今天发得够多了。"],
  "note.gone":         ["That person is not on the list any more.", "这个人已经不在名单上了。"],
  "note.failed":       ["It did not send. Try again.", "没有发出去，再试一次。"],

  /* GROUPS. The words are plain on purpose: a group is an ordinary thing and
     the only sentence here doing real work is the one about who can be in it. */
  "grp.title":         ["Groups", "群组"],
  "grp.sub":           ["Rooms with more than two people in them.", "两个人以上的房间。"],
  "grp.count":         ["{n} of them", "共 {n} 个"],
  "grp.start":         ["Start a group", "建一个群"],
  "grp.yours":         ["Your groups", "你的群"],
  "grp.none":          ["No groups yet", "还没有群"],
  "grp.noneBody": [
    "A group is a room only the people in it can see. You can start one with anybody you have matched with.",
    "群是一个只有群里的人才看得见的房间。你可以和任何一个跟你匹配上的人建一个。",
  ],
  "grp.nobody": [
    "Nobody to add yet. You can put people in a group once you have matched with them — you follow each other and you are after the same thing.",
    "还没有人可以加。要先跟对方匹配上，才能把他拉进群——也就是互相关注，而且想找的是同一件事。",
  ],
  "grp.who": [
    "Anybody you have matched with. You are always in it, so there is room for {n} more.",
    "任何跟你匹配上的人都可以加。你自己一定在里面，所以还能再加 {n} 个。",
  ],
  "grp.add":           ["Add", "加入"],
  "grp.added":         ["Added", "已加"],
  "grp.namePlaceholder": ["Call it something. Optional.", "起个名字。可以不写。"],
  "grp.make":          ["Create group ({n})", "建群（{n} 人）"],
  "grp.limit": [
    "Everybody in a group can see every message in it and everybody who is in it. Anybody can leave, and nobody can be thrown out.",
    "群里的每个人都能看到群里的所有消息，也能看到都有谁在群里。任何人都可以退群，但没有人能把别人踢出去。",
  ],
  "grp.inIt":          ["{n} people in it", "群里有 {n} 个人"],
  "grp.quiet":         ["Nothing said yet.", "还没有人说话。"],
  /* One word on the small line under a message, not a call to action beside
     every sentence: a room that asks you about every message is not a room
     anybody relaxes in. */
  "grp.flag":          ["Report", "举报"],
  "grp.placeholder":   ["Say something to the group.", "跟群里说点什么。"],
  "grp.leave":         ["Leave this group", "退出这个群"],
  "grp.leaveSure": [
    "Leave this group? You will not see it again, and what you said stays where it is.",
    "确定退群？之后你就看不到它了，你说过的话会留在原处。",
  ],

  "note.inbox":        ["Messages", "私信"],
  "note.inboxSub":     ["Introductions to you, and the ones you sent.", "别人写给你的，和你写出去的。"],
  "note.none":         ["Nothing yet", "还没有消息"],
  "note.noneBody": [
    "When somebody writes to you about studying together, it lands here. Nobody can write to you twice, and nobody can see this but you.",
    "有人想约你一起学习时，消息会到这里。没有人能给你连发两条，也没有人能看到这里。",
  ],
  "note.fromThem":     ["{who} wrote to you", "{who} 写给你"],
  "note.toThem":       ["You wrote to {who}", "你写给 {who}"],
  "note.newOnes":      ["{n} new", "{n} 条新消息"],
  "note.report":       ["Report this message", "举报这条消息"],
  "note.reportWhy":    ["What is wrong with it? Somebody will read it.",
                        "哪里有问题？会有人看的。"],
  "note.reported":     ["Reported. Somebody will read it.", "已举报，会有人看的。"],
  "note.openProfile":  ["Open their profile", "查看对方资料"],
  "note.safety": [
    "Nobody here should ask you for money, a deposit, or photographs of your documents. Report anybody who does.",
    "这里不该有人向你要钱、要押金，或者要你证件的照片。遇到了就举报。",
  ],

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
export function pickLang(fallback = "en") {
  try {
    const saved = localStorage.getItem("board:lang");
    if (saved === "en" || saved === "zh") return saved;
  } catch { /* private window */ }
  const nav = (navigator.languages || [navigator.language || ""]).join(",");
  if (/\bzh\b|zh-/i.test(nav)) return "zh";
  // The fallback, so a page written for a Chinese audience can open in Chinese
  // without overruling somebody who has already picked. A saved choice still
  // wins above, which is the part that matters: the switch has to stick.
  return fallback === "zh" ? "zh" : "en";
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
