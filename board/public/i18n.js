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
  "board.club":        ["Posts from the Uni Club", "大学社团的帖子"],
  "board.empty.head":  ["Nothing here yet.", "这里还什么都没有。"],
  "board.empty.body":  ["The first thing anybody puts up appears here. Somebody reads everything before it does.",
                        "第一条内容会出现在这里。所有内容都会先由人过目。"],
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
    "A place for exchange students to ask the question you are embarrassed to ask, compare notes on courses and on how to actually get by, and find someone to study with. Nothing to install. No account. No VPN.",
    "留学生问问题的地方：那些不好意思问的问题、哪门课怎么样、在这里生活的门道，也可以找个一起学习的人。不用下载，不用注册。",
  ],
  "site.hanzi": [
    "留学生 · liúxuéshēng — a student studying abroad. It is who this is for, so it is what it is called.",
    "留学生 —— 这是给谁做的，就叫什么。",
  ],
  "site.open":         ["See who is on it", "看看有谁在"],
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
    "A photograph is read by a person before it appears, because a picture is the one thing that cannot be taken back once somebody has saved it. Photographs are stored on the same server as everything else and are reachable by a link nobody can guess.",
    "照片在出现之前会由人过目，因为照片是唯一一样别人一旦保存就收不回来的东西。照片和其他内容存在同一台服务器上，通过一个别人猜不到的链接访问。",
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
    "This is for university students. It is not intended for anyone under sixteen, and we do not knowingly keep anything from them.",
    "本站面向大学生，不面向十六岁以下的人，我们也不会有意保留他们的任何信息。",
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
  "shot.browse":       ["Browse students", "看看有谁"],
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
  "bud.joined":        ["is looking for someone to study with", "在找一起学习的人"],
  "bud.joinedFree":    ["Free", "有空"],
  "bud.joinedGo":      ["See the list", "看名单"],
  "bud.join":          ["Put me on the list", "把我加到名单上"],
  "bud.seeWho":        ["See who is looking", "看看谁在找"],
  // Names what the switch DOES, not how somebody feels. "I am looking for a
  // study buddy" is a mood; being in Browse is a fact about where your page
  // appears, and it is the one thing this switch decides.
  "bud.lookingLabel":  ["Show me in Browse", "在「看看有谁」里显示我"],
  "bud.lookingWhy": [
    "Your page appears in the list of students. Turn it off and you are still here — you just are not in it. Posting never puts you in on its own.",
    "你的主页会出现在学生名单里。关掉也不会影响你用这个应用，只是不出现在那里。单纯发内容不会把你加进去。",
  ],
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
   * you to give anything away, or to meet anyone at all. */
  "bud.safety": [
    "Nothing here needs your phone number, your WeChat or your documents, and nobody should be asking you for them. You never have to meet anyone to use this.",
    "这里不需要你的电话、微信或者证件，也不该有人向你要。你完全不用见面就能用这个应用。",
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
  "brw.title":         ["Browse students", "看看有谁"],
  "brw.sub":           ["{n} on the list", "名单上有 {n} 个人"],
  "brw.of":            ["{n} of {total}", "第 {n} 个，共 {total} 个"],
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
  "lvl.put":           ["Put this on my page", "放到我的主页上"],
  /* WHAT TO DO ABOUT THE NUMBER. A rank on its own is a verdict; the useful
     half is the next hour, and Study Pal already writes that hour. */
  "lvl.classTitle":    ["A class at this level", "来一节这个水平的课"],
  "lvl.classSay": [
    "Study Pal writes you one for a place you will actually stand in: a short conversation at your level, the words inside it, then two more ways to use them.",
    "Study Pal 按你的水平写一节课，场景是你真会遇到的：一段短对话，把里面的词挑出来，再给两个用法。"],
  "lvl.classGo":       ["Take a class \u2192", "去上这一节 \u2192"],
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
  "type.put":          ["Put this on my page", "放到我的主页上"],
  "type.puton":        ["On your page.", "已经放上去了。"],
  // The letters travel in the words, not in the link. There is no page that
  // says INFJ about somebody who has not chosen to say it themselves.
  // ---- a result, put on the feed -------------------------------------------
  // Written as somebody would write it about themselves, because that is who
  // is posting. Not "user completed the type sort".
  "share.feed":        ["Put this on the feed", "发到动态里"],
  "share.takeIt":      ["Take it yourself", "你也来测测"],
  "share.cardTap":     ["Tap to take it \u2192", "点一下，你也测测 \u2192"],
  // Sending the test itself. Written as an invitation rather than as a link:
  // this is the one that brings somebody who has never been here.
  "share.invite":      ["Send this to a friend", "发给朋友"],
  "share.inviteType":  ["Which of the sixteen are you? Twenty choices, two minutes:",
                        "你是十六种里的哪一种？二十道选择，两分钟："],
  "share.inviteLevel": ["How good is your Chinese, really? Four questions:",
                        "你的中文到底什么水平？四道题就知道："],
  "share.up":          ["It is on the feed.", "已经发到动态里了。"],
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
    "Your page is made, but it is not in the list of students. Tap to turn Show me in Browse on.",
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
  "note.needProfile":  ["Fill in your own profile first — an introduction from nobody is not one.",
                        "先填好自己的资料——没有名字的自我介绍不算自我介绍。"],
  "note.enough":       ["That is enough messages for one day.", "今天发得够多了。"],
  "note.gone":         ["That person is not on the list any more.", "这个人已经不在名单上了。"],
  "note.failed":       ["It did not send. Try again.", "没有发出去，再试一次。"],

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
