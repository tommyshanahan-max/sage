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
  /* THE OLD NAME, KEPT ON PURPOSE. The masthead reads site.title now — see
     the note where it is set. This pair is left because HOUSE matches on it,
     so notices the board posted under its own name before the rename still
     carry the house mark instead of showing up as a member nobody knows.
     Do not translate it afresh; it has to stay the string those posts were
     actually filed under. */
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

  /* THE HOME SCREEN. The other half of the same strip: the invite line is what
     a stranger reads, this is what a member reads, and they are never both up.
     install.js decides which of the three a phone gets.

     NAMED, NOT DESCRIBED. "Add to Home Screen" and "添加到主屏幕" are the exact
     words iOS prints in the share sheet in each language — a paraphrase sends
     somebody looking for a row that is not there. Same reason for ⋯: it is the
     glyph WeChat draws, not a description of it. */
  "ins.ios": [
    "Put The Exchange on your home screen \u2014 tap {icon}, then Add to Home Screen.",
    "把「交换」放到主屏幕：点 {icon}，选「添加到主屏幕」。",
  ],
  "ins.can": [
    "Put The Exchange on your home screen.",
    "把「交换」放到主屏幕。",
  ],
  "ins.go":  ["Add", "添加"],
  /* WeChat cannot install anything, so this says how to get out of WeChat
     rather than how to install — and it says where the button is, because ⋯ in
     the corner is not somewhere anybody looks unless told. */
  "ins.wx": [
    "To keep this on your home screen: tap \u22ef top right, open in the browser.",
    "想放到主屏幕：点右上角 \u22ef，用浏览器打开。",
  ],
  "ins.no":  ["Not now", "以后再说"],

  /* THE OTHER PICTURES. Said as a state, not as an apology — a person who has
     just uploaded something wants to know it arrived, and "waiting" says that
     where "pending review" says they may have done something wrong. */
  "shot.waiting":  ["waiting", "审核中"],
  "shot.add":      ["Add a photo", "加一张照片"],
  "shot.more": [
    "Up to six more, for the work. Your face stays the one on your card.",
    "最多再放六张，放你的作品。名片上还是用你那张头像。",
  ],
  "shot.full":     ["That is six — take one down to add another.", "已经六张了，想加就先撤一张。"],
  "shot.drop":     ["Take down", "撤下"],

  /* THE BUZZ. Said as what it does for them, not as "enable notifications" —
     the thing somebody wants is to stop missing messages, and "notifications"
     is the word every app uses just before it starts sending things nobody
     asked for. The board sends exactly one kind and this says so. */
  /* THE WAITING ROOM, SAID TO THE PERSON IN IT. Not "you do not have
     permission" — they have not done anything wrong and nothing is being
     withheld from them as a judgement. They are early, which is the truth and
     is also the better thing to be told. */
  /* wroom.*, NOT soon.*. "soon.head" already exists further down this file and
     belongs to a different screen — index.html reads it for #soonhead, which
     says "Not open yet." Two keys of the same name is the later one winning
     silently and a sentence appearing on a page nobody was looking at. */
  "wroom.line": [
    "Not yet — you are in the waiting room. Finish your page and somebody will look at it.",
    "还没开放——你在等候室里。先把自己的主页填好，会有人来看。",
  ],
  "wroom.head": ["You are in the waiting room", "你在等候室"],
  /* THREE SENTENCES, THEN ONE, THEN THIS.
     It explained that nothing working is not their fault, and then that
     finishing the page is what somebody reads. Both true, and both saying in
     prose what the ticked list two lines below says as a list. So the prose
     stops at the one fact the list cannot carry — that the app is dead for
     them — and hands straight over.
     Counted, because "1 things left" is the sort of thing a person reading
     with half their attention does notice. Same reason act.reply1 exists. */
  "wroom.body2": [
    "Nothing works yet. Two things left \u2014",
    "现在还点不动。还差两样——",
  ],
  "wroom.body1": [
    "Nothing works yet. One thing left \u2014",
    "现在还点不动。还差一样——",
  ],
  /* WHAT IS LEFT AND HOW LONG THERE IS. The server has been sending all
     three of these since the waiting room was built and no page drew any of
     them, so being moved up was a grey line saying the buttons do not work
     yet. "Finish your page" with no idea what is missing is a demand. */
  "wroom.needPhoto":   ["A photo", "一张照片"],
  /* "What you are and what you are looking for" was eight words on a tick
     item read at a glance. The board calls it the sentence everywhere else. */
  "wroom.needSay":     ["Your sentence", "一句话"],
  /* The clock only appears once it is running — it starts when they open it,
     not when they were moved up, so before that there is honestly no deadline
     to name. */
  "wroom.left":        ["{n} hours left", "还剩 {n} 小时"],
  "wroom.done":        ["Finished. Somebody will read it.", "填完了，会有人来看。"],

  /* LOSING THE PLACE, which is the one thing on this board that cannot be
     undone. Their row lives in this browser's storage and nowhere else, and
     the commonest way to lose it is not a lost phone — it is opening the link
     in WeChat's browser rather than the one they joined in.
     The heading says what is at stake rather than naming a feature: "Sign in
     with email" is a setting, "this phone is the only place your place
     exists" is a reason. */
  "lose.head":         ["This phone is the only place you exist",
                        "你现在只存在于这一台手机上"],
  /* Four sentences to one. It explained what is lost, how it gets lost, what
     happens if you rejoin, and then the fix — read at a glance, all of that
     is in the way of the box underneath it. The heading already says what is
     at stake; this says what to do about it. */
  "lose.why": [
    "Leave an email and six digits bring it back.",
    "留个邮箱，六位数字就能找回来。",
  ],
  "lose.save":         ["Save it", "保存"],
  "lose.done":         ["Saved. Your place can come back now.", "存好了。现在能把位置找回来了。"],

  "push.head": ["Know when somebody writes", "有人给你留言，第一时间知道"],
  "push.later":["Not now", "以后再说"],
  "push.ask":  [
    "Your phone buzzes. Nothing is in it but that \u2014 no name, no message.",
    "手机会响一下。里面什么都没有——没有名字，也没有内容。",
  ],
  "push.on":   ["Turn on", "打开"],
  "push.wait": ["…", "…"],
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
  /* THE FOOTER WAS THE FINE PRINT, ALL OF IT — three sentences about reports,
     the device number and hiding people, set in grey at the bottom of every
     screen. Every word true and none of it read, because a paragraph nobody
     opened is not a disclosure, it is a paragraph. It is on /privacy now,
     which is a page somebody goes to on purpose, and this is one line and a
     way there. */
  "board.foot": [
    "A person reads every report, and anything here can be taken down.",
    "每一条举报都由人来看，这里的任何内容都可以撤下。",
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

  /* The composer asks WHERE, not WHAT. It answers with a dropdown whose
     default is Everyone, and "What is this about? Everyone" is not a
     sentence. A post goes to the main feed unless somebody picks a room. */
  "post.room":         ["Where does this go?", "发到哪里？"],
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
  /* "on this phone" was true and is not any more — a block is a row now, so it
     follows the person to their laptop, and it stops messages as well as
     hiding a face. Both halves of what it does, because a safety control that
     undersells itself is one people do not press. It does not say the other
     person is not told; nothing on this screen should raise the question. */
  "rep.alsoBlock":     ["Also block ", "同时屏蔽 "],
  "rep.alsoBlock2":    [" \u2014 they leave Browse and cannot write to you",
                        " —— 他不会再出现在你的「看看」里，也不能再给你留言"],
  "rep.go":            ["Report it", "提交举报"],
  "rep.needReason":    ["Pick a reason, or write one. A report with nothing in it cannot be acted on.",
                        "选一个理由，或者写一个。没有内容的举报无法处理。"],
  "rep.failed":        ["That did not send. Try once more \u2014 and they are blocked either way.",
                        "没有发送成功。再试一次——不过屏蔽已经生效了。"],
  "rep.sent":          ["Sent. A person reads every one of these.", "已提交。每一条都由人来看。"],

  // ---- the landing page ----------------------------------------------------
  /* THE NAME.
     "Liuxuesheng" was true when this was a board for people who had gone
     abroad to study, and it stopped being true when the rooms outgrew it — a
     director looking for an agent does not open something called the students
     board. The Exchange is what the place actually does: two sides, and one
     trades with the other. It keeps the language-exchange meaning it started
     with, so nothing already said to anybody becomes untrue.

     The address is still liuxuesheng.io. A link already forwarded in a WeChat
     thread has to keep working, and a domain is a separate decision from a
     name. */
  "site.title":        ["The Exchange", "交换"],
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
    "交换 · jiāohuàn — a swap. One person has what the other is short of, and the whole board is built on finding that pair. It began as a place for people who had gone abroad to study; the rooms outgrew that, and the name caught up.",
    "交换 · jiāohuàn —— 一方有的，正是另一方缺的；这个板子做的全部事情，就是把这两个人凑到一起。它一开始是给留学生做的，后来装下的东西多了，名字也就跟上了。",
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
  // The way to the fine print, now that it is not standing in the middle of
  // Browse. See the note where .psafety used to be.
  "site.privacy":      ["What is kept about you", "关于你的信息我们留了什么"],
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
  /* COLLABORATION RANK, IN CREDITS.
     Five titles and one line each. Every one describes a thing that happened
     rather than a quantity, because a board this size where everybody knows
     each other cannot carry a ranking of its members without becoming a worse
     place. See rankOf in server.js for what earns each one.

     The credits are not a metaphor stretched over the rungs — they are the
     industry's own words for these exact things. A series regular IS the
     person who keeps turning up. A producer IS the credit for assembling
     other people. And "speaking part" is the plainest way anybody has ever
     said that somebody answered you: you got a line. */
  "rank.head":         ["Where you stand", "你现在的位置"],
  "rank.headThem":     ["Where {who} stands", "{who} 现在的位置"],
  "rank.guest":        ["Extra", "群演"],
  "rank.guestWhy": [
    "Nobody has answered you yet. Put something up that somebody can answer.",
    "还没有人回过你。发点别人能接话的东西。",
  ],
  "rank.contact":      ["Speaking part", "有台词"],
  "rank.contactWhy": [
    "Somebody answered you. That is the whole difference between having joined and having arrived.",
    "有人回过你了。这就是「注册了」和「真的到了」之间的全部区别。",
  ],
  "rank.regular":      ["Series regular", "常驻"],
  "rank.regularWhy": [
    "You have put something up in three separate weeks. The one thing a board cannot fake is somebody who keeps coming back.",
    "你在三个不同的周里都发过东西。一个板子唯一装不出来的，就是有人一直回来。",
  ],
  "rank.connector":    ["Producer", "制片人"],
  "rank.connectorWhy": [
    "Two people you brought are still here, and have spoken. This is the one that is about somebody else being here rather than you.",
    "你带进来的两个人还在，而且开过口。这一级说的是别人在不在，而不是你在不在。",
  ],
  "rank.principal":    ["Showrunner", "主创"],
  "rank.principalWhy": [
    "Three who stayed and spoke, and five different people have answered you. This board is different for you being on it.",
    "三个人留下来并且开了口，还有五个不同的人回过你。因为有你，这个板子才是现在这个样子。",
  ],
  /* What the next rung needs, said as the thing to do rather than the score
     to reach. Only ever shown to the person themselves. */
  "rank.next":         ["Next: {what}", "下一步：{what}"],
  "rank.toContact":    ["somebody answering you", "有人回你一句"],
  "rank.toRegular":    ["something up in three separate weeks", "在三个不同的周里各发点东西"],
  "rank.toConnector":  ["two people you brought staying and speaking", "你带进来的两个人留下来并开口"],
  "rank.toPrincipal":  ["three who stayed, and five people who answered you", "三个人留下来，五个人回过你"],
  "rank.top":          ["Nothing above this one.", "这已经是最上面一级了。"],

  /* THE DOORS. Same board behind every one of them — only the sign
     changes, and the sign is written in the words of the person who followed
     that link. The "under" line is the same promise on all four: this is one
     room in one building, and the rest of the building is the point. */
  "door.film.head": [
    "Who do I get to shoot in Beijing in November?",
    "十一月要在北京拍，找谁？",
  ],
  "door.film.under":   ["Somebody two floors up has already done it.", "楼上那位早就干过这事。"],
  "door.film.say": [
    "Directors, casting, producers and crew who are in China — and the fixers, the lawyers and the money who make a shoot happen. They are all on the same board, which is the point of it.",
    "在中国的导演、选角、制片和剧组——以及让一部片子真正拍成的中间人、律师和出钱的人。他们都在同一个板子上，这正是它的意义所在。",
  ],
  "door.invest.head": [
    "Who is actually building something here?",
    "这里到底有谁在做事？",
  ],
  "door.invest.under": ["Not the ones who post about it.", "不是那些天天发帖说的人。"],
  "door.invest.say": [
    "Founders in China, and the people already backing them. Plus the operators, the lawyers and the film crews they end up needing — all on the same board, which is the point of it.",
    "在中国做事的创始人，以及已经在支持他们的人。还有他们迟早会需要的操盘手、律师和拍摄团队——都在同一个板子上，这正是它的意义所在。",
  ],
  "door.raise.head": [
    "Who writes the first cheque here?",
    "在这里，第一张支票是谁开的？",
  ],
  "door.raise.under": ["Somebody in this room already knows.", "这屋里有人已经知道答案。"],
  "door.raise.say": [
    "People raising in China and the people who back them, in one place. Along with the operators, the lawyers and the crews you will need after the money — which is the point of it being one board.",
    "在中国融资的人，和给他们钱的人，在同一个地方。还有拿到钱之后你会需要的操盘手、律师和团队——这正是它只做一个板子的意义。",
  ],
  "door.trade.head": [
    "Who has actually been to the factory?",
    "谁真去过那家工厂？",
  ],
  "door.trade.under":  ["Not the one with the best website.", "不是网站做得最好看的那家。"],
  "door.trade.say": [
    "People sourcing from China, and the factories and trading companies supplying them — with the agents, the distributors and the lawyers who sit in between. All on the same board, which is the point of it.",
    "从中国采购的人，和给他们供货的工厂与外贸公司——还有夹在中间的代理、经销商和律师。都在同一个板子上，这正是它的意义所在。",
  ],
  "door.other.head": [
    "Who would you ring, if you knew them yet?",
    "如果你认识那个人，你会给谁打电话？",
  ],
  "door.other.under": ["That is the whole of it.", "就这么一件事。"],
  "door.other.say": [
    "People connecting in China, and with China. Film, money, hiring, language — different rooms, one building, and the introductions worth having are the ones that cross between them.",
    "在中国、以及跟中国打交道的人。影视、资金、招人、语言——不同的房间，同一栋楼；而真正值钱的引荐，往往是跨房间的那些。",
  ],

  /* THE SENTENCE. "I am a Director looking for an Agent."
     The article used to be glued on here — "I am a" + the bare role — which
     is right fourteen times out of fifteen and wrong on the fifteenth: the
     app said "I am a Agent", on Tom's own card, in a screenshot. English
     articles depend on the word after them, so they belong to the word, and
     the words that carry them already existed for the other half of the
     sentence (role.a.*, including "Crew", which takes none at all). Both
     halves use them now and this is left with just the verb. Chinese needs no
     article on either side and is unchanged. */
  "say.iam":           ["I am", "我是"],
  "say.in":            ["in", "在"],
  "say.lookingFor":    ["looking for", "我在找"],
  /* The second and third lines. "And a Founder looking for an Investor" —
     where they are does not change between one sentence and the next, so it
     is asked once, on the first line, and not repeated. */
  "say.and":           ["and", "还是"],
  /* THE LINE WHEN WHAT THEY ARE IS ALREADY KNOWN. It read "I am an Investor
     looking for —", with the first half a word nobody could change. A control
     that does not respond, in the middle of the one thing on the screen that
     does, so it went: the card carries only the half that moves. */
  "say.want1":         ["Looking for", "我在找"],
  "say.andOnly":       ["and", "还有"],
  /* Short enough to sit in a pill inside a sentence. The segmented rows these
     replace could afford "Somewhere else"; a word in the middle of a line
     cannot. */
  "say.where.cn":      ["China", "中国"],
  "say.where.out":     ["elsewhere", "其他地方"],
  "say.wants.cn":      ["China", "中国"],
  "say.wants.out":     ["outside China", "中国以外"],
  "say.wants.any":     ["anywhere", "哪里都行"],
  "say.pickMe":        ["what I am", "我是做什么的"],
  "say.pickWant":      ["what I need", "我需要什么"],
  "say.make":          ["Making the work", "做事的人"],
  "say.back":          ["Backing it", "支持的人"],
  "say.more":          ["＋ and something else", "＋ 还想找别的"],
  "say.drop":          ["remove", "删掉"],
  // The sentence saves itself now that it lives on Browse. Three short states
  // and no button: the pill IS the button.
  "say.saving":        ["saving…", "保存中…"],
  "say.saved":         ["saved", "已保存"],
  "say.saveno":        ["That did not save. Try again.", "没保存上，再试一次。"],

  "role.director":     ["Director", "导演"],
  "role.writer":       ["Writer", "编剧"],
  "role.performer":    ["Performer", "演员"],
  "role.crew":         ["Crew", "剧组"],
  "role.founder":      ["Founder", "创始人"],
  "role.student":      ["Student", "学生"],
  "role.maker":        ["Manufacturer", "工厂"],
  "role.agent":        ["Agent", "经纪人"],
  "role.producer":     ["Producer", "制片人"],
  "role.brand":        ["Brand", "品牌方"],
  "role.investor":     ["Investor", "投资人"],
  "role.lawyer":       ["Lawyer", "律师"],
  "role.recruiter":    ["Recruiter", "招聘方"],
  "role.buyer":        ["Buyer", "采购方"],
  "role.distributor":  ["Distributor", "经销商"],

  /* And in the plural, for "you would come up for agents". English needs three
     forms of the same word in one sentence and Chinese needs one; writing them
     out is shorter than the code that would guess. */
  "role.p.director":   ["directors", "导演"],
  "role.p.writer":     ["writers", "编剧"],
  "role.p.performer":  ["performers", "演员"],
  "role.p.crew":       ["crew", "剧组的人"],
  "role.p.founder":    ["founders", "创始人"],
  "role.p.student":    ["students", "学生"],
  "role.p.maker":      ["manufacturers", "工厂"],
  "role.p.agent":      ["agents", "经纪人"],
  "role.p.producer":   ["producers", "制片人"],
  "role.p.brand":      ["brands", "品牌方"],
  "role.p.investor":   ["investors", "投资人"],
  "role.p.lawyer":     ["lawyers", "律师"],
  "role.p.recruiter":  ["recruiters", "招聘方"],
  "role.p.buyer":      ["buyers", "采购方"],
  "role.p.distributor": ["distributors", "经销商"],

  /* ---- the people one login speaks for -----------------------------------
   *
   * The Chinese here is written rather than translated, and two of them are
   * deliberately not the obvious word. 代理 is what a Chinese producer calls
   * this arrangement; "经纪人代管" is the phrase they would use for one login
   * holding several artists' pages, and it is what goes on the button.
   *
   * The orange bar is the one string that matters most. It has to be read in
   * half a second by somebody about to type, so it is short, it names the
   * person, and it says whose the words are — not "you are in Mia's account",
   * which describes a setting, but "everything you write is hers", which
   * describes a consequence. */
  "run.title":      ["The people you speak for", "你代管的人"],
  /* SOMEBODY WHO IS ALREADY ON THE BOARD. Adding a name mints a row for
     somebody who has never opened this; this is for the person who has, and
     it is six characters they type rather than a handle you pick — the press
     belongs to whoever holds the row. */
  "run.repTitle":   ["Already on here?", "他已经在上面了？"],
  "run.repBody": [
    "Do not add their name again — that makes a second them. Get these six characters to them and they type them into their own profile.",
    "别再输一次他的名字，那会多出一个他。把下面这六个字符给他，让他在自己的资料页里填进去。",
  ],
  "run.repGo":      ["Get the six characters", "拿六个字符"],
  "run.repWhere":   ["They open Profile › Edit, and it is at the bottom.", "他打开「个人主页 › 编辑」，在最下面。"],
  "run.repTill":    ["Good for a day.", "一天内有效。"],
  "run.repAgain":   ["New code", "换一个"],
  "run.repNo":      ["Could not make one. Try again.", "没生成成功，再试一次。"],

  "run.board":      ["The board", "返回"],
  "run.lede":       ["Everyone here has their own page and their own matches. You run all of them from this login — and the conversations come to you.",
                     "他们每个人都有自己的主页、自己的匹配。你用一个账号全部代管，谈事的时候对方找的是你。"],
  "run.you":        ["You", "你自己"],
  "run.being":      ["You are {who}. Everything you write is theirs.",
                     "你现在是 {who}。你写的每一句都算她/他说的。"],
  "run.beback":     ["Back to me", "变回我自己"],
  /* Over the rail, because a row of faces that scrolls sideways is where every
     app these people use puts stories, and round faces mean "tap to watch".
     Tapping here means becoming somebody. The label is the cheap half of the
     fix; the tiles being square is the other half. */
  "run.railhead":   ["Posting as", "现在以谁的身份"],
  "run.desk":       ["On a laptop? Drag the whole folder in instead \u2192",
                     "用电脑的话，整个文件夹拖进去就行 \u2192"],

  /* The door, when the person coming through it represents other people.
     两句话就够：他们进来不是为了逛，是为了把手上的人弄上去。 */
  "door.agentSub":  ["You are in. Next: the people you represent \u2014 drag their files in and they get pages of their own.",
                     "进来了。下一步是把你带的人弄上去——把他们的资料拖进来，一人一个主页。"],
  "door.agentGo":   ["Bring your people on", "把你的人弄上去"],
  "door.agentSay":  ["Their files are enough \u2014 drag the folder in and it writes the pages. You check them before anybody else sees them.",
                     "有他们的资料就够了——文件夹拖进去，主页它来写。别人看到之前你先过一遍。"],

  "run.count":      ["{show} of {all} showing in Browse. Your own page shows all of them.",
                     "{all} 个人里有 {show} 个在「逛逛」能刷到。你自己的主页上他们都在。"],
  "run.none":       ["Nobody yet. Drop a folder, or type a few names.",
                     "还没有人。把文件夹拖进来，或者直接打几个名字。"],
  "run.tagshow":    ["Showing", "在逛逛"],
  "run.taghide":    ["Not showing", "没在逛逛"],
  "run.tagdraft":   ["Draft", "草稿"],
  "run.waiting":    ["{n} waiting", "{n} 条没看"],
  "run.full":       ["Browse shows {n} of yours at a time. Take one out first — your own page still shows everybody.",
                     "「逛逛」里同时最多放你 {n} 个人。先撤下一个——你自己的主页上谁都不少。"],

  "run.addhead":    ["Add someone", "加人"],
  "run.drophead":   ["Drop a folder", "把文件夹拖进来"],
  "run.dropsub":    ["— one folder per person, however you already keep them.",
                     "——一个人一个文件夹，你原来怎么存的就怎么拖。"],
  "run.choose":     ["Choose a folder", "选文件夹"],
  "run.dropwhy":    ["Headshots, CVs, bios. The folder names say who is who; nothing is published until you have read it.",
                     "定妆照、简历、个人介绍都行。谁是谁看文件夹名字；你没过目之前，谁都看不到。"],
  "run.orhead":     ["Or just the names, one a line:", "或者直接打名字，一行一个："],
  "run.namesph":    ["Mia Chen\nJen Alvarez\nTom Hale", "陈弥雅\n李真\n韩沐"],
  "run.addgo":      ["Add them", "加进来"],
  "run.added":      ["{n} added. Tap a name to be them and fill in their page.",
                     "加了 {n} 个。点名字就变成他，去把主页填上。"],

  "run.reading":    ["Reading {n} files\u2026", "正在看这 {n} 个文件……"],
  "run.nonames":    ["Nothing here says whose files these are. Put each person's files in a folder with their name on it.",
                     "看不出这些文件是谁的。每个人的东西放进一个以他名字命名的文件夹里。"],
  "run.runfull":    ["That is {n} people, which is as many as one login holds. Ask and it can be raised.",
                     "一个账号最多带 {n} 个人，满了。要加跟我们说。"],
  "run.allalready": ["All {n} are already here. Nothing added.", "这 {n} 个都已经在了，没重复加。"],
  "run.contact":    ["One of those has a phone number or a WeChat id in it. Profiles here carry neither.",
                     "里面有手机号或者微信号。这儿的主页不放这些。"],
  "run.nopage":     ["Finish your own page first — that is where theirs starts from.",
                     "先把你自己的主页填完，他们的是从你这儿来的。"],
  "run.failed":     ["That did not go through. Try again.", "没成功，再试一次。"],

  "run.reviewhead": ["Read this before anybody else does", "先过一遍，别人还看不到"],
  "run.reviewwhy":  ["Written from the files you dropped, and held until you say so. Check it: it can only be as right as the paperwork was.",
                     "这是照着你拖进来的文件写的，你不点确认谁也看不到。看一眼——文件里怎么写的，它就怎么写。"],
  "run.reviewnokey":["Names and faces came out of the folders. The words are yours to write — tap a name after this to fill in their page.",
                     "名字和照片是从文件夹里拿的。介绍得你自己写——确认完点名字就能去填。"],
  "run.loose":      ["{n} files were not in anybody's folder and were left out.",
                     "有 {n} 个文件不在任何人的文件夹里，没算进来。"],
  "run.nowords":    ["Nothing readable in their files.", "他的文件里没读出什么来。"],
  "run.stripped":   ["Contact details were taken out.", "里面的联系方式去掉了。"],
  "run.approve":    ["Put them on the board", "放上去"],
  "run.approved":   ["{n} are on the board.", "{n} 个已经上去了。"],

  /* ---- the laptop console ------------------------------------------------
   * A different register from /run: this is somebody at a desk with a folder
   * of files open beside the browser, not somebody on a phone in a taxi. It
   * can afford a sentence. What it must not do is imply the sorting is
   * reliable — "check the names" is the instruction, and it is first. */
  "ob.title":       ["Bring your people on", "把你的人一次弄进来"],
  "ob.welcome":     ["Welcome", "欢迎"],
  "ob.skip":        ["Or skip this for now \u2014 it will be on your profile when you want it.",
                     "也可以先放着——想弄的时候在你主页上找得到。"],
  /* Two steps, not two options — the page stopped being a fork. */
  "ob.lede":        ["Two things, in this order.", "两步，按顺序来。"],
  "ob.rolehead":    ["They are", "他们是"],
  /* ONE PERSON FIRST. The words are about the outcome, not the mechanism —
     "put them on the board" is what the agent wants; "create a profile" is
     what the software does. And the Chinese says 放上去, which is where they
     go, rather than a word for creating a record. */
  "ob.p1ph":        ["Their name", "他的名字"],
  "ob.p1save":      ["Put them up", "放上去"],
  "ob.p1say": [
    "One at a time, and they are on the board the moment you press it. Add the next one straight after.",
    "一次一个，一按就在板上了。接着加下一个。",
  ],
  "ob.p1needName":  ["A name first.", "先写名字。"],
  "ob.p1up":        ["on the board", "已上线"],
  /* The pile, offered rather than imposed. Somebody with forty performers
     should find this; somebody with three should never have to think about
     folders at all. */
  "ob.pileOpen": [
    "Got a folder of their photos? Add several at once",
    "有一整个文件夹的照片？可以一次加好几个",
  ],
  "ob.fieldhead":   ["Drag it all in here", "全拖到这儿"],
  "ob.fieldsub":    ["A folder, or a pile. Nothing is made until you say so.", "一个文件夹，或者一堆文件。你不点，什么都不建。"],
  "ob.choose":      ["Choose files", "选文件"],
  /* The same step, said to a thumb. No folders, no dragging — a camera roll,
     which is where these photographs already are. */
  "ob.phonehead":   ["Their photos", "他们的照片"],
  "ob.phonesub":    ["Pick as many as you like. Nothing is made until you say so.",
                     "想选几张选几张。你不点，什么都不建。"],
  "ob.phonego":     ["Choose photos", "从相册选"],
  "ob.reading":     ["Reading {n} files and working out who is who\u2026", "正在看这 {n} 个文件，分一下谁是谁……"],
  "ob.sorted":      ["{n} people. The names and the words came out of the files \u2014 check them, and drag a file onto somebody else if it landed wrong.",
                     "分出来 {n} 个人。名字和介绍都是从文件里读出来的——核对一下，分错了就把文件拖到别人那儿。"],
  "ob.sortednokey": ["{n} people, sorted by their file names. The words are yours to write.",
                     "按文件名分出来 {n} 个人。介绍得你自己写。"],
  "ob.already":     ["{n} were already on your roster.", "有 {n} 个你已经带了。"],
  "ob.nonames":     ["Nothing in that pile says whose files these are. Put each person's files in a folder with their name on it, or rename them.",
                     "这堆文件看不出是谁的。给每个人建个以他名字命名的文件夹，或者把文件名改一下。"],
  /* When nothing in the pile carries a name. Not an error and not an
     instruction to go and rename things — a question, with the box to answer
     it already open. */
  "ob.whois":       ["Nothing in there says who this is. Type a name and it is theirs.",
                     "里面看不出这是谁。打个名字就归他了。"],
  "ob.addwho":      ["+ Another person", "+ 再加一个人"],

  /* The two halves of what an agent is here for. Written as alternatives
     rather than as steps: plenty of agents will do one and not the other, and
     numbering them would make the second look like homework.
     一个人和一群人是两件事，所以并排放，不是第一步第二步。 */
  "ob.trayhead":    ["Could not tell whose these are \u2014 drag them onto somebody",
                     "这几个不知道是谁的——拖到对应的人身上"],
  "ob.guessed":     ["Worked out", "猜的"],
  "ob.fromfolder":  ["From your folder", "按你的文件夹分的"],
  "ob.movetip":     ["Drag onto somebody else", "拖到别人那儿"],
  "ob.whoph":       ["Their name", "名字"],
  "ob.goalph":      ["What they do, in their own voice.", "他是干什么的，用他自己的口气写。"],
  "ob.tradeph":     ["Line of work", "行当"],
  "ob.cityph":      ["City", "城市"],
  "ob.drop":        ["Leave out", "不要这个"],
  "ob.keep":        ["Put back", "还是要"],
  "ob.make":        ["Make {n} pages", "建 {n} 个主页"],
  "ob.tally":       ["{files} files \u00b7 {n} people", "{files} 个文件 · {n} 个人"],
  "ob.made":        ["{n} made, and held. Read them on your roster, then put them on the board.",
                     "建好了 {n} 个，先存着。去名单里过一遍，再放上板。"],

  "role.a.director":   ["a Director", "导演"],
  /* Asked of an agent who came in on an agent invite and has a row with
     nothing on it. Not "create your profile": they are not here to make a
     profile, they are here to put nine people up, and this is the one fact
     that has to exist first. */
  /* ---- two steps, in the order the board actually needs them --------------
   * This was two numbered options to choose between, and an agent had to pick
   * one before doing anything — which is not how any app they have ever used
   * begins. Every one of them opens with a photograph, a name, and then the
   * next thing.
   * Their pages are built out of the agent's: the sentence, the city, and the
   * line saying who represents them. So it is not a menu, it is an order, and
   * the numbers finally mean what numbers mean. */
  "ob.s1head":      ["You", "你自己"],
  "ob.s1say":       ["Your page is what producers and brands find. Everybody you add starts from it \u2014 your sentence, your city, and the line on their page saying you represent them.",
                     "制片方、品牌方是通过你的主页找到你的。你加进来的每个人也都从这儿来——你那句话、你的城市，还有他们主页上写的「由你代理」。"],
  "ob.s2head":      ["The people you represent", "你带的人"],
  "ob.s2say":       ["A page each, all run from this login. Nothing is published until you have read it.",
                     "一人一个主页，都用你这个账号管。别人看到之前，你先过一遍。"],
  "ob.toobig":      ["That photo is too big. Anything under 25MB is fine.",
                     "这张照片太大了，25MB 以内都行。"],
  "ob.sending":     ["Sending the photo\u2026", "照片上传中……"],
  /* Six words. The reason — their pages say you represent them, your WeChat is
     the one that crosses — is in ob.s1say, which a laptop shows and a phone
     does not, because on a phone this is read with half an eye. */
  "ob.mylabel":     ["What should we call you?", "叫你什么？"],
  "ob.myph":        ["Your name", "你的名字"],
  "ob.mysave":      ["That is me", "就叫这个"],
  "role.a.writer":     ["a Writer", "编剧"],
  "role.a.performer":  ["a Performer", "演员"],
  "role.a.crew":       ["Crew", "剧组"],
  "role.a.founder":    ["a Founder", "创始人"],
  "role.a.student":    ["a Student", "学生"],
  "role.a.maker":      ["a Manufacturer", "工厂"],
  "role.a.agent":      ["an Agent", "经纪人"],
  "role.a.producer":   ["a Producer", "制片人"],
  "role.a.brand":      ["a Brand", "品牌方"],
  "role.a.investor":   ["an Investor", "投资人"],
  /* The open answer, and only ever on the "looking for" side — see ANYONE in
     store.js. Not "everyone": that reads as a broadcast. "Anyone" reads as
     being open, which is what it means. */
  "role.a.anyone":     ["anyone", "谁都行"],
  "role.a.lawyer":     ["a Lawyer", "律师"],
  "role.a.recruiter":  ["a Recruiter", "招聘方"],
  "role.a.buyer":      ["a Buyer", "采购方"],
  "role.a.distributor": ["a Distributor", "经销商"],

  /* THE FRONT PAGE.
     "Airbnb meets Tinder" is a good line to say to somebody across a table
     and a bad one to print: the first association is hotels and the second is
     one-night stands, and neither is what a person doing business in China
     wants to be told this is. The mechanism said plainly is the same claim
     and carries none of that — you are vouched for by a member, and nothing
     happens between two people until each is what the other is looking for. */
  "land.title":        ["the other half of doing business in China",
                        "在中国做事，你缺的那一半"],
  "land.kicker":       ["Invite only · doing business in China", "邀请制 · 在中国做事"],
  /* THE HEADLINE ON /about, and it stopped working the day the matcher came
     off the page. "Who are you missing?" was a question with the answer
     directly underneath it — two dropdowns you could move — so the question
     was an invitation to try the thing. Above a join form and nothing else it
     is a question the page never answers.
     A statement instead. It says what the place is for in five words, which
     is what a headline over a form has to do.
     The Chinese is not the sentence translated. "你在中国的生意伙伴" assumes
     the reader is outside China looking in, and half the people this is for
     are inside it looking out. So it names the person rather than the side:
     in China, the one you are short of. */
  /* THE POSITIONING, IN THE SHAPE PEOPLE ALREADY UNDERSTAND.
     "Your business partner in China" says who you get and nothing about what
     the thing is, so a stranger's guesses are directory, agency or scam. Two
     names they already know do the job in three words — and the head under it
     stays the human line, because a page that is only a comparison is a page
     about two other companies.
     It read "Shark Tank × LinkedIn × Tinder" for a night. Shark Tank was the
     odd one out and it was doing damage: LinkedIn and Tinder are things people
     use, Shark Tank is a show people watch, so it tipped the promise towards
     pitching for money — and two of the four doors, Film & TV and Factories &
     buyers, are not about money at all. It also puts the reader in the chair
     being judged, which is the opposite of what happens here.
     Then "LinkedIn × Tinder" for an hour, and the problem with that one is
     what it is standing next to. The line under it says everybody here was
     let in by somebody already in, and the line above it was measuring this
     place against the two largest open sign-up products on earth. A club does
     not compare itself to LinkedIn.
     So: the mechanic, and neither name borrowed. "Matched" keeps the whole of
     what Tinder was doing there — two people, one line each, and nothing said
     to either until both of them press — without handing a reader an app to
     picture instead of this one. "Not listed" is what is left of LinkedIn: a
     directory is a page of people who are all findable by anybody, and this is
     the opposite arrangement.
     It said "A private club that matches" for ten minutes, which was a third
     go at being exclusive on a line that did not need to be. The two lines
     under it already say invite only and then print how few are in — the
     exclusivity is stated twice and counted once before a reader reaches the
     button. A third claim reads as a velvet rope, and a velvet rope directly
     above "Get on the waiting list" is telling somebody they cannot come in
     and asking them to queue in the same breath. The eyebrow says what
     happens to you; the page says who gets in.
     互相看对眼才算 is how it would be said out loud rather than a rendering of
     "matches": it only counts if you both like what you see. 配对 would have
     been the dictionary word and reads like software. 不是名录 — not a
     directory — is the same half of the line as "not listed", and 名录 is the
     word for exactly the kind of book this is not.
     It read "for professionals" for a few minutes. Both halves of an eyebrow
     have to earn their place, and that one did not: "not listed" is a thing a
     reader can check against this page — there is no directory here and
     nobody is findable in one — where "for professionals" is a claim every
     product aimed at work makes about itself, and a reader has no way to
     agree or disagree with it. The half doing the work is "Matched" either
     way; the second half is the one that has to say something. */
  "land.eyebrow":      ["Matched, not listed", "不是名录 · 互相看对眼才算"],
  /* THE HEADLINE IS THE BLANK, and the blank is the product.
     It was a line out of a deck ("the room you keep asking people for"), which
     needed the slide before it to make sense, and then a plain description,
     which said what the place is and nothing about what you do there. This is
     the thing itself: the sentence the whole board runs on, with the half that
     is about you left open — and the demonstration two lines below fills the
     same blank in, so the headline is a question the page immediately answers.
     The Chinese keeps the blank in the same place. It reads as an unfinished
     sentence in both, which is the point. */
  "land.head":         ["Find your ______ to do business with",
                        "找到你的 ______，一起做生意"],
  /* WHAT IT COSTS TO BE IN IT, said where somebody decides whether to bother.
     It was on the form further down and in the door's own words, both of which
     come after that decision. A private room is the product; saying so late
     makes it read as a hurdle rather than the point.
     "Somebody already inside decides" and not "we decide": the second is a
     company with a policy, the first is a club — and the first is what
     actually happens, because a member vouching is how anybody gets in. */
  /* WHAT KIND OF PLACE IT IS, in the two facts that make it different from a
     directory: you say a line rather than upload a CV, and nobody is in here
     who was not let in by somebody who already is.
     "let in by somebody already in" rather than "we screen everybody": the
     second is a company with a policy, the first is a club — and the first is
     what actually happens. It is also the honest version of "quality people":
     nobody is vetted, somebody is vouched for, and those are different claims. */
  /* THE FACT UNDER THE POLICY. "Invite only" is something a page says about
     itself; two numbers are something a reader can check against what they
     see. Not a boast and never rounded — whatever is in the file tonight.
     The Chinese is the way it would be said out loud: inside, and outside
     the door, which is also what the four rooms are called.
     Both halves or neither. "41 inside" alone is a small company; "120
     waiting" alone is a queue for nothing. */
  /* THE POLICY AND THE FACT, in one line, because the paragraph that carried
     the policy is gone from the hero.
     "Invite only" on its own is a claim anybody can make. The two numbers
     after it are what make it believed — and they are never a target and never
     rounded: whatever this says tonight is what is actually in the file. The
     server withholds the queue below a floor, because a number that small is
     nearly a name, and then this line does not draw at all. */
  "land.few":          ["Invite only. {in} inside, {out} waiting to be let in.",
                        "只能被邀请进来。里面 {in} 个人，门外 {out} 个在等。"],
  /* WHAT IT IS, TO SOMEBODY WHO HAS NEVER HEARD OF IT.
   *
   * This said "One line instead of a CV. Invite only — everybody here was let
   * in by somebody already in." Three faults, and they only showed once an
   * unfamiliar person read it.
   *
   * "One line instead of a CV" answers a question nobody has asked yet — the
   * line is further down the page and they have not seen it. From outside the
   * product it is jargon.
   *
   * It explained the MECHANIC, which is now the entire band underneath: the
   * sentence, the two pickers, the person who answers. The hero was saying the
   * same thing worse, thirty pixels higher up.
   *
   * And it stacked two claims in one breath, so neither landed.
   *
   * NOT "a marketplace". A marketplace is a place you browse and transact in,
   * which is a directory of people — the exact thing the line above this one
   * promises it is not. The two would contradict each other with four
   * centimetres between them.
   *
   * What is left is the sentence Tom actually says out loud when he explains
   * it, which the invitation and the door's link card already use. Saying it
   * in three places is not repetition; it is the thing having a name.
   *
   * 人脉 rather than a translation of "network": in a mainland ear the English
   * word means Facebook, and 人脉 is the people you can actually call. */
  "land.only": [
    "A private club for doing business through who you know.",
    "一个靠人脉做生意的私人圈子。"],
  /* Who it is for and how you get in — the half of the old line worth keeping,
     on its own, small, beside the button it explains. It is the reason the
     button says "waiting list" rather than "sign up", and a stranger who does
     not read it wonders why they cannot simply join. */
  "land.onlyhow": [
    "Cross-border investment and entertainment, mostly. Invite only — everybody here was let in by somebody already in.",
    "主要是跨境投资和影视娱乐。只能被邀请进来——这里的每个人，都是里面的人放进来的。"],
  /* THREE FRAMES, ONE STORY, and the order is the argument: two people who do
     not know each other, then the only thing this product does.
     They were three unrelated screens — browse, cards, the door — which showed
     the app and not the point. A stranger reading left to right now watches a
     deal start. */
  "land.frames":       ["How it goes", "大概是这样"],
  /* TWO CAPTIONS, NOT THREE, because the picture is now two phones leaning
     into each other and one standing on its own. The first names both people
     and why they come up for each other; the second is the only thing this
     product actually does.
     "never because they matched" is load-bearing and stays in both languages:
     matching does not hand anybody a WeChat id. A person decides to send it. */
  "land.frame1": [
    "Wei is raising for his second company. Elena writes first cheques. Each line is the other half of the other's — so they come up for each other.",
    "小魏的第二家公司在融资，Elena 是投第一笔钱的人。两句话正好是彼此的另一半——于是两个人互相出现在对方眼前。"],
  "land.frame2": [
    "One of them writes. Nobody's contact is handed over by the board — a person decides to answer.",
    "然后有人先开口。这里不会替谁把联系方式交出去——回不回，是本人决定的。"],
  /* TWO WORDS OVER EACH HALF OF THE PICTURE. The composition made the argument
     and people still asked what they were looking at, which means the picture
     needed a caption it could not carry — so it gets a label instead.
     "Connect" and not "Message": the app's word for the press is Connect, and
     a landing page that teaches a different word teaches the wrong one. */
  /* ONE LINE UNDER ONE SCREEN. The three steps that used to be here explained
     a picture that was sitting directly underneath them, and people still said
     they did not get it — because nobody studies a page a friend forwarded
     them. This says the only thing the picture does not: that it goes both
     ways, and that nothing happens until it does.
     中文写的不是翻的：「对上眼」就是这个意思，比「匹配」这种词实在。 */
  /* WHAT IT IS, IN FOUR WORDS. It was an eyebrow for a while and it scrolled
     past; it is the headline now, because everybody already knows what both of
     those are and the shape of the thing lands before the sentence is
     finished. Not translated — both names are read in English in Chinese tech
     and entertainment circles, and 领英×探探 would name two products that are
     not these and are not what anybody means. */
  "land.big":          ["LinkedIn \u00d7 Tinder.", "LinkedIn \u00d7 Tinder\u3002"],
  "land.say1":         ["You say one line \u2014", "你说一句话 \u2014\u2014"],
  "land.say2":         ["I am a ___ looking for a ___", "我是 ___，在找 ___"],
  "land.say3":         ["\u2014 and it finds the people who said the other half.",
                        "\u2014\u2014 然后它把说了另一半的人找给你。"],
  "land.miniName":     ["Mia", "Mia"],
  "land.miniWho":      ["Agent \u00b7 Shanghai", "\u7ecf\u7eaa\u4eba \u00b7 \u4e0a\u6d77"],
  "land.miniFollow":   ["Follow", "关注"],
  "land.miniMatched":  ["You matched", "对上了"],
  "land.miniWhy":      ["She followed you back, and you sent her your card.",
                        "她也关注了你，你把名片给了她。"],
  "land.miniGo":       ["Message", "发消息"],
  "land.miniRole1":    ["an Agent", "经纪人"],
  "land.miniRole2":    ["a Performer", "演员"],

  /* ---- the sentence's two pickers, and the person on the other side -------
   *
   * NINE INVENTED PEOPLE, one per role that can stand on the right of the
   * sentence. They are invented and they have to be: the alternative is
   * putting real members on a public page, which would make a private board
   * browsable from outside by role — a directory, which is the one thing
   * "Matched, not listed" promises it is not, and the thing every member was
   * told when they joined.
   *
   * Written the way a real row reads: a first name, a city, and one line of
   * what they actually do. No adjectives, no "passionate", no company names.
   * Half of them are on each side of the border, because that is what this
   * board is and a homepage full of Shanghai would say something else.
   *
   * The articles are their own keys rather than being glued on in code:
   * a/an is an English problem that does not exist in Chinese, and a template
   * that concatenates one would be wrong in half the languages here. */
  "art.founder":       ["a Founder", "创始人"],
  "art.investor":      ["an Investor", "投资人"],
  "art.agent":         ["an Agent", "经纪人"],
  "art.producer":      ["a Producer", "制片人"],
  "art.performer":     ["a Performer", "演员"],
  "art.writer":        ["a Writer", "编剧"],
  "art.maker":         ["a Manufacturer", "工厂"],
  "art.buyer":         ["a Buyer", "采购方"],
  "art.brand":         ["a Brand", "品牌方"],
  /* Under the crop box. Says what to do and nothing about why — the box is
     the card's own shape, so the reason is visible. */
  "me.cropSay":        ["Drag the photo to move your face into the frame.",
                        "拖一下照片，把脸挪到框里合适的位置。"],
  /* WHEN A GHOST PRESSES FOLLOW. The board's own logic said back to them, not
     a rule quoted at them: they can see these people because those people let
     themselves be seen.
     中文写的不是翻的：「露个面」比「开启可见性」像人话。 */
  "fol.needShow":      ["You can see these people because they let themselves be seen. Turn on Show me in Browse and you can follow them.",
                        "你能看到这些人，是因为他们愿意露面。你也露个面，就能关注他们了。"],
  "fol.needPage":      ["Put a name on your page first. You can see these people because they let themselves be seen.",
                        "先给自己的主页起个名字。你能看到这些人，是因为他们愿意露面。"],

  /* The app's own chrome, drawn round the card. Taken from the real screens so
     somebody who joins recognises the page they were shown. */
  "land.phTop":        ["Not public yet \u2014 invite only.", "还没公开 \u2014 只能被邀请。"],
  "land.phFew":        ["Invite only.", "只能被邀请进来。"],
  "land.phEye":        ["Browse people", "看看都有谁"],
  "land.phFollow":     ["Follow", "关注"],
  "land.phNext":       ["Next", "下一个"],

  "who.investor.name": ["Elena", "Elena"],
  "who.investor.city": ["Shanghai", "上海"],
  "who.investor.line": ["I write the first cheque. Consumer and marketplaces, China and Southeast Asia.",
                        "我投第一笔钱。消费和平台，中国和东南亚。"],
  "who.founder.name":  ["Wei", "小魏"],
  "who.founder.city":  ["Shenzhen", "深圳"],
  "who.founder.line":  ["Second company. Hardware for small factories \u2014 eleven of them paying, no salespeople.",
                        "第二家公司。做小工厂用的硬件，十一家在付钱，没有销售。"],
  "who.agent.name":    ["Andy", "Andy"],
  "who.agent.city":    ["Sydney", "悉尼"],
  "who.agent.line":    ["Twenty-two years, mostly drama. I do not send people who are not right for it.",
                        "做了二十二年，主要是正剧。不合适的人我不会推。"],
  "who.producer.name": ["Lin", "林"],
  "who.producer.city": ["Beijing", "北京"],
  "who.producer.line": ["Two features a year, co-productions mostly. Casting from March.",
                        "一年两部，基本都是合拍。三月开始定角。"],
  "who.performer.name":["Mia", "Mia"],
  "who.performer.city":["Shanghai", "上海"],
  "who.performer.line":["Mandarin and English. Two features and a series. Free from March.",
                        "中英文都行。两部电影、一部剧。三月之后有档期。"],
  "who.writer.name":   ["Jun", "俊"],
  "who.writer.city":   ["Hangzhou", "杭州"],
  "who.writer.line":   ["Half-hour comedy. One series made, one sitting in a drawer.",
                        "半小时喜剧。拍过一部，还有一部压在抽屉里。"],
  "who.maker.name":    ["Fai", "阿辉"],
  "who.maker.city":    ["Dongguan", "东莞"],
  "who.maker.line":    ["Small-batch metal, fifty people. I would rather have four buyers than forty.",
                        "小批量五金，五十个人。宁可四个长期客户，不要四十个。"],
  "who.buyer.name":    ["Hui", "阿慧"],
  "who.buyer.city":    ["Guangzhou", "广州"],
  "who.buyer.line":    ["Homeware for forty stores. I place orders twice a year and I pay on time.",
                        "四十家店的家居用品。一年下两次单，从不拖款。"],
  "who.brand.name":    ["Rachel", "Rachel"],
  "who.brand.city":    ["Melbourne", "墨尔本"],
  "who.brand.line":    ["Skincare, four years old. Looking for the factory, not the middleman.",
                        "护肤品，做了四年。想直接找工厂，不要中间商。"],
  /* The other two pairs the sentence cycles through on the front page. Chosen
     one per room that has people in it, so the range is shown rather than
     claimed — a manufacturer who sees only founders and investors decides this
     is a startup board and leaves. */
  "land.pairMake":     ["a Manufacturer", "工厂"],
  "land.pairBuy":      ["a Buyer", "采购方"],
  "land.pairWrite":    ["a Writer", "编剧"],
  "land.pairProd":     ["a Producer", "制片人"],
  /* The line under both cards, and the only one that is a promise rather than
     a description. It is why this is not a directory. */
  "land.one":          ["Nobody's contact opens until both sides agree.",
                        "两边都点了头，联系方式才出现。"],
  "land.step1":        ["Step 1 · Say it once", "第一步 · 说一句话"],
  "land.step2":        ["Step 2 · You match", "第二步 · 匹配上"],
  "land.step3":        ["Step 3 · Connect and do business", "第三步 · 联系上，开始谈"],
  /* WHAT IT DOES, ON THE FRONT PAGE, SHOWN RATHER THAN DESCRIBED.
     The headline names who you get and nothing said how, so a stranger off a
     forwarded link had to guess — and the guesses are directory, agency, or
     scam. These four fragments are the sentence the whole product runs on,
     filled in with one real pair. Four keys rather than one string with
     placeholders because the two halves are pills and the two joins are not,
     and Chinese puts them in a different order — see .doesline. */
  "land.does1":        ["I am", "我是"],
  /* THE SAME PAIR THE OTHER TWO STEPS USE. It was an Agent and a Performer,
     which is a real pair on this board and the wrong one here: step two shows
     Wei the founder and Elena the investor, and step three is their
     conversation. A reader met one pair in step one and a different pair
     immediately after, and had to work out that the sentence was an example
     rather than the story. One pair, three steps. */
  "land.does2":        ["a Founder", "创始人"],
  "land.does3":        ["looking for", "在找"],
  "land.does4":        ["an Investor", "投资人"],
  /* IT SAID "tells neither of you until you both do" AND THERE WAS NOTHING FOR
     `do` TO POINT AT. The only verb in the sentence is saying your half, which
     the reader has already done, so the condition reads as one they have
     already met. Two mechanisms in one clause: the sentence pairs you, and
     Follow is what confirms it. This names the button, so the next act is a
     thing on screen rather than a promise. */
  "land.doesWhy": [
    "Say it once. You see who said the other half — and nobody is told until you both press Follow.",
    "说一次就行。谁说了另一半，你就看得到——在你们都点了「关注」之前，谁也不会知道。"],

  /* EACH DOOR FILLS THE SAME SENTENCE WITH ITS OWN PAIR. A link into a film
     group should not open on an investor's example. Only the two pills change;
     the joins and the line under them are the same words every time. Rooms
     without a pair here keep the general one. */
  "door.film.does2":   ["a Producer", "制片人"],
  "door.film.does4":   ["a Performer", "演员"],
  "door.invest.does2": ["an Investor", "投资人"],
  "door.invest.does4": ["a Founder", "创始人"],
  "door.raise.does2":  ["a Founder", "创始人"],
  "door.raise.does4":  ["an Investor", "投资人"],
  "door.trade.does2":  ["a Buyer", "采购方"],
  "door.trade.does4":  ["a Manufacturer", "工厂"],

  "land.under":        ["Say it in one line.", "一句话说清楚。"],
  "land.lede": [
    "Members bring members, and their name stays on whoever they brought. Nothing happens between two people until each of them is what the other is looking for.",
    "成员带成员，带进来的人身上一直挂着带他进来那个人的名字。而两个人之间不会发生任何事，除非彼此正好是对方要找的人。",
  ],
  /* Under the two pills, in the reader's own terms — the product explained by
     doing it once rather than described. */
  "land.enter":        ["I have a password", "我有口令"],
  /* THE OTHER DOOR, AND THE ONE MOST PEOPLE NEED. It sat at the bottom of the
     page with no button anywhere above it, so the only thing a stranger could
     press said "I have a password" — which most of them do not.
     "Waiting list" and not "Sign up": the queue is the product's best line
     about itself. 等候名单 is the phrase used for a restaurant or a school
     with more people than places, which is exactly the feeling. */
  "land.join":         ["Get on the waiting list", "加入等候名单"],
  /* THE SAME DOOR, IN THE WIDTH A PHONE'S TOP BAR ACTUALLY HAS. The full
     sentence ran off the right edge of a 390px screen — the word "list" was
     over the fold, which is the one word that says what the button does. The
     hero button two lines down still says the whole thing. */
  "land.joinbar":      ["Get on the list", "加入名单"],
  /* What that same button says to somebody who is already through the door.
     The public page has two readers and only one of them is outside. */
  "land.inside":       ["Go to the board", "回到板子"],
  "land.invite":       ["Invite only — a member has to bring you.", "邀请制——得有成员带你进来。"],
  "land.doors":        ["Which one are you here for", "你是为哪一件来的"],
  "land.foot": [
    "A private board for people connecting in China, and with China.",
    "一个私密板子，给在中国、以及跟中国打交道的人。",
  ],
  "land.rules":        ["House rules", "这里的规矩"],
  "land.privacy":      ["What is kept", "我们保留什么"],
  /* For whoever runs the board, in the footer where the other two are. Named
     for what it shows rather than "Admin": a stranger reading the footer of a
     private board should not be told there is a control room behind it.
     land.doors was already the eyebrow above the four rooms. */
  "land.counted":      ["Doors", "门口"],
  /* The moderation panel, on its own hostname behind its own login. Named for
     the room rather than for the rank: Doors is who arrived, Panel is what
     they said, and both together are what "admin" would have meant. */
  "land.panel":        ["Panel", "后台"],
  "land.queue":        ["Waiting", "门外"],

  "peek.head":         ["Inside, right now", "里面此刻的样子"],
  "wait.only":         ["Invite only", "仅限邀请"],
  "wait.waiting":      ["waiting to get in", "个人在等着进来"],
  /* Said only when the server sent a number that really is about that room —
     below the floor it sends the whole board's figure instead. */
  "wait.waitingIn":    ["in {room}\nare waiting", "个 {room} 的人在等"],
  /* WHICH ROOM, in four words a stranger can read. Not the board's thirteen —
     those are the vocabulary of somebody already inside. See WAITROOMS. */
  /* The one line worth adding back to a box everything else came off. */
  /* ---- THE PERSON ON THE DOOR --------------------------------------------
     Outside only. A member has Ask the Professor inside, which is ten written
     answers and costs nothing; this is for the stranger deciding whether to
     trust a friend's link, where a page cannot anticipate the question. */
  "host.head":         ["Not sure what this is? Ask.", "不太清楚这是什么？问一下。"],
  "host.ask":          ["Type your question", "打字问吧"],
  "host.go":           ["Ask", "问"],
  "host.q.what":       ["What is this?", "这是个什么？"],
  "host.q.safe":       ["Who can see my details?", "谁能看到我的信息？"],
  "host.q.cost":       ["Does it cost anything?", "要钱吗？"],
  "host.thinking":     ["\u2026", "\u2026"],
  "host.slow":         ["One at a time. Try again in a minute.",
                        "一次一个问题，过一分钟再来。"],
  "host.busy":         ["Too many questions today. Ask whoever sent you the link.",
                        "今天问得太多了，去问发你链接的那个人吧。"],
  "host.no":           ["That did not go through. Try again.", "没发出去，再试一次。"],
  /* Said on the box, not buried in a policy. Somebody typing a question into
     a stranger's website is owed the two facts that matter about it. */
  "host.note": [
    "Answered by a machine, from a written brief about this board. Your question is not stored and nobody here reads it. Do not type anything private.",
    "这是机器按一份写好的说明回答的。你的问题不会被保存，这边也没人看。别在这儿写私密的东西。",
  ],

  "wait.sentBy":       ["{who} thought you should be on this.", "{who} 觉得你该在这上面。"],
  "wait.which":        ["What are you here for?", "你是为了什么来的？"],
  "waitroom.film":     ["Film & TV", "影视"],
  "waitroom.invest":   ["Investing", "投资"],
  "waitroom.raise":    ["Raising", "融资"],
  "waitroom.trade":    ["Factories & buyers", "工厂与买家"],
  "waitroom.other":    ["Something else", "别的"],
  "wait.name":         ["Your name", "你的名字"],
  /* Short enough not to be cut off in the box it sits in. It was three
     examples and a clause, and the clause was the half that got truncated. */
  "wait.reach":        ["WeChat or email", "微信或邮箱"],
  "wait.why":          ["One line about you (optional)", "一句话介绍自己（选填）"],
  "wait.go":           ["Join the list", "加入名单"],
  "wait.both":         ["A name and one way to reach you.", "名字和一个联系方式。"],
  "wait.done":         ["You are on the list.", "已经加进名单了。"],
  "wait.again":        ["Changed — the old answer is replaced.", "改好了，旧的那条已经被替换。"],
  "wait.already":      ["You are already a member. Open the board.",
                        "你已经是这里的人了，直接打开就行。"],
  /* THE WHOLE PROMISE, AND IT CHANGED THE DAY THE ROOM SHIPPED.
   *
   * It used to say one person reads this, which was true and was the reason
   * the queue could only ever be a queue: a member deciding about a stranger
   * had nothing to decide with. There is a room behind this form now, and
   * everybody in it can see everybody else — so the line says that, in the
   * order it matters. What is shown, why it is shown, what is never shown,
   * and that it goes either way.
   *
   * IT ONLY BINDS PEOPLE WHO READ IT. Every row written before this wording
   * changed is invisible for ever — see `shown` in store.js — because they
   * agreed to the older sentence and nothing about a product changing is
   * their problem.
   *
   * The contact is the half that did not move, and saying so plainly is what
   * keeps the rest of it a promise rather than a category. */
  /* "SHOWN TO NOBODY" IS STILL TRUE AND IS NO LONGER THE WHOLE OF IT. An
     address left here is now also how somebody gets their place back on a new
     phone — see /api/signin. Shown and used are different words, and a form
     that says the first while quietly doing the second is the kind of thing
     this board exists not to be. One clause, on the line people read. */
  "wait.note": [
    "Members and the others waiting see your name and your line — that is how somebody brings you in. Your WeChat or email is shown to nobody; if it is an email, it is also how you get your place back on a new phone. Deleted either way.",
    "成员和其他在等的人能看到你的名字和这句话——你就是这样被带进来的。微信或邮箱不给任何人看；要是填的是邮箱，换手机的时候也靠它把你的位置找回来。无论结果如何都会删掉。",
  ],
  /* THE SAME PROMISE WITH ONE AUDIENCE TAKEN OUT. On a door sent to people who
     compete with each other, the other names in the queue are the reason not
     to answer. Members still see it, because somebody has to be able to vouch.
     See `quiet` in cleanWait and QUIET_PAGES in wait.js. */
  "wait.noteQuiet": [
    "Only members see your name and your line — that is how somebody brings you in. Nobody else waiting sees you, and your WeChat or email is shown to nobody; if it is an email, it is also how you get your place back on a new phone. Deleted either way.",
    "只有成员能看到你的名字和这句话——你就是这样被带进来的。其他在等的人看不到你，微信或邮箱也不给任何人看；要是填的是邮箱，换手机的时候也靠它把你的位置找回来。无论结果如何都会删掉。",
  ],

  /* ---- the waiting room ---------------------------------------------------
     wr.* and not room.*, which is already the eleven rooms of the board and
     would put "You are on the list" in a run of Language exchange / Job /
     Raising. Everything somebody on the list sees. The rule that governs every line of
     it: this is how members find you, never this is how you qualify. Nothing
     here admits anybody, nothing is scored against a pass mark, and the
     moment it reads as an exam the people worth having stop bothering. */
  "wr.title":        ["While you wait", "等着的时候"],
  "wr.on":           ["You are on the list.", "你已经在名单上了。"],
  "wr.onWhy": [
    "Members are looking through the people at the door. This is what they see of you.",
    "里面的人在翻门口这些人的卡片。他们看到的你，就是这一张。",
  ],
  /* THEIR NUMBER AND THE SIZE OF THE QUEUE, in one line. "5 asked before
     you" gave the gap without the scale — being fifth of six and fifth of
     ninety are different situations and the page was telling them the same
     thing. */
  "wr.ahead":        ["You are number {n} of {t} waiting",
                      "你排在第 {n} 位，共 {t} 人在等"],
  "wr.aheadNone":    ["You are first in the queue", "你排在最前面"],
  "wr.yourcard":     ["Your card", "你的卡片"],
  /* The empty card, said out loud. A screen that draws three blanks and says
     nothing about them reads as a page that failed to load. */
  "wr.thin":         ["Three empty spaces. Nothing to go on but a sentence.",
                        "三个空格。除了一句话，没别的可看。"],
  "wr.full":         ["Three things a member can judge without meeting you.",
                        "三件事，不用见面就能判断。"],
  /* NOT "Fill them in". That is a to-do list, and a to-do list handed to
     somebody at a door is an entrance exam however gently it is worded — at
     which point the busy people leave, and the busy people are who this is
     for. It is something to do while waiting, it is optional, and both of
     those are said rather than implied. */
  "wr.fill":         ["Something to do while you wait", "等着的时候，随便玩玩"],
  "wr.fillWhy": [
    "None of it is required. It just gives a member more to go on than one line.",
    "都不是必须的。只是让成员多一点可以看的东西，而不只是一句话。",
  ],
  "wr.done":         ["Done", "已经填了"],
  "wr.take":         ["Take it", "去做"],
  "wr.again":        ["Again", "重做"],

  "wr.t1":           ["How good is your Chinese?", "你中文什么水平？"],
  "wr.t1sub":        ["Four questions", "四道题"],
  "wr.t2":           ["Which of the sixteen are you?", "十六种里你是哪种？"],
  "wr.t2sub":        ["Twenty choices", "二十道选择"],
  "wr.t3":           ["What are you looking for?", "你在找什么？"],
  "wr.t3sub":        ["Two answers", "两个选择"],
  "wr.t3save":       ["Put it on the card", "放到卡片上"],

  /* The three chips, and the dashed outline each one leaves while it is
     empty. Named for what is missing rather than left blank: three blanks
     read as a card that failed to load, three labels read as three things
     to do. */
  "wr.c1":           ["Chinese —", "中文 —"],
  "wr.c2":           ["Type —", "类型 —"],
  "wr.c3":           ["Looking for —", "在找 —"],
  "wr.zh":           ["中文 {n} / 10", "中文 {n} / 10"],
  "wr.en":           ["English {n} / 10", "英文 {n} / 10"],
  "wr.wants":        ["Wants: {who}", "在找：{who}"],
  /* On the card itself, after the room: "Film & TV · waiting". It says the
     same thing on their own copy as on the members' side, because a card
     that reads differently to the person it is about is one they cannot
     trust. */
  "wr.flag":         ["waiting", "等候中"],
  "wr.pill":         ["On the list", "在名单上"],

  /* The one line that connects the form to everything behind it. Said as an
     invitation to look rather than an instruction, because nothing in the
     room is required and the first words about it should not sound like it. */
  /* On the two tests, for somebody who has no profile to add anything to.
     The member's version of this button says profile; saying that to
     somebody on the waiting list is offering them something they have not
     got. */
  "wr.putcard":      ["Put it on my card", "放到我的卡片上"],
  "wr.putdone":      ["It is on your card.", "已经在你的卡片上了。"],
  /* THE PHOTOGRAPH. Offered, never required, and every line about it says
     what it does for them rather than what it is for. "You will get picked
     faster" is true — a member choosing between a face and a letter chooses
     the face — so it is said out loud rather than left as a nudge. */
  "wr.photoBig":     ["That photo is too large to send. Try another.",
                      "这张照片太大了，传不上去。换一张试试。"],
  "wr.photoAdd":     ["Add a photo", "加一张照片"],
  "wr.photoAgain":   ["Change the photo", "换一张照片"],
  /* The third state, in the same words as the other two. "Was not put up"
     described the mechanism; "did not pass" describes the check the other
     two lines just promised, which is what somebody reading this was told to
     expect. No reason is given because none is known here — and the useful
     half is the second sentence. */
  "wr.photoNo":      ["That photo did not pass. You can add a different one.",
                      "那张照片没通过。可以换一张。"],
  "wr.photoWhy":     ["Optional. Cards with a face get picked first.",
                      "可以不加。有照片的卡片会先被看到。"],
  /* "Nobody else sees it until it has been looked at" was accurate and it
     read as suspicion — somebody is examining you. This says the same two
     facts in the order that matters: it arrived, and it goes public after a
     check.
     It still leads with Saved rather than "will be uploaded", because it HAS
     been uploaded; what is pending is other people seeing it. A line that
     said otherwise would be a lie on the one screen where somebody is
     wondering whether the thing worked. */
  "wr.photoHeld":    ["Saved. It goes live once it has been checked.",
                      "已保存。通过检查后就会公开。"],
  "wr.photoLive":    ["Live. Everybody can see it.", "已通过，大家都看得到了。"],
  "wr.open":         ["See your card", "看看你的卡片"],
  "wr.back":         ["You are already on the list. See your card.",
                      "你已经在名单上了。看看你的卡片。"],

  /* ---- the seat, outside the door -------------------------------------
     NOT A FIGURE ANYWHERE. No money, no percentage, no chart — those are on
     the seat page behind the door, where the reader is a member. Out here it
     is a count out of a hundred, three rows and a link, and one line saying
     in as many words that none of it is a promise of money. */
  "wr.seat":         ["Founding early adopters", "创始早期成员"],
  /* PLACES LEFT, NOT SEATS TAKEN. "20 of 100 are in" told somebody deciding
     whether to bother that nobody was here yet. Same subtraction, and the
     other side of it is the one that is also useful. */
  "wr.seatLeft":     ["{n} places left", "还剩 {n} 个名额"],
  "wr.seatShut":     ["When the hundred is full, the founding group closes.",
                      "一百人满了，创始这一批就关闭了。"],

  /* WHAT THE WORDS MEAN, because a name nobody can define is a name nobody
     trusts. Said as what it is and what it is not — no job, nothing bought,
     no certificate — so the reader can decide rather than guess. */
  "wr.seatWhat":     ["What is a founding early adopter?", "什么叫创始早期成员？"],
  "wr.seatWhatP": [
    "One of the first hundred people whose page goes up here. Your number is set the day you are let in and never moves again, and the lower it is, the more it counts. It is not a job, it is not bought, and it is not a share certificate. It is a place in the group that showed up first.",
    "在这里最早发布个人页的一百个人之一。你的号码在被放进来那天定下，之后不再变动；号码越靠前，算得越多。这不是一份工作，不用花钱买，也不是股权证书。它是最早来的那一批人里的一个位置。",
  ],

  "wr.seatNow":      ["Your share today", "你今天的份额"],
  "wr.seatPts":      ["{p} points · {pc}% of what the hundred hold",
                      "{p} 分 · 占一百人总数的 {pc}%"],
  "wr.seatNoMoney":  ["{p} points of what the hundred hold",
                      "在一百人总数里的 {p} 分"],

  /* THE ONE ACT WORTH THE MOST, at the top, with the figure it moves. The
     block used to lead with the seat number, which is worth 41 points at seat
     24 — the smallest number on the screen in the largest type. One person
     who gets in and stays is 100. That ordering is the whole block. */
  "wr.seatLift":     ["Bring one person in who stays", "带一个留下来的人进来"],
  "wr.seatLiftP": [
    "One person who is let in and posts is worth {n} points, every time.",
    "一个被放进来并且发帖的人，每次值 {n} 分。",
  ],
  /* THE GATE, SAID OUT LOUD. Anybody can send a link; only the ones let in
     count, and letting in is not theirs to do. Said here rather than
     discovered later by somebody who sent forty. */
  "wr.seatGate": [
    "Sending a link pays nothing on its own. It counts when that person is let in and posts — and who gets let in is not up to you.",
    "光把链接发出去本身不算数。要等那个人被放进来并且发帖才算——而放谁进来不由你决定。",
  ],
  "wr.seatSent":     ["{n} sent so far", "已经发出 {n} 个"],
  "wr.seatSentNone": ["none sent yet", "还没发过"],

  "wr.seatRest":     ["The rest, once you are in", "进来之后的其他部分"],
  "wr.rowCard":      ["An introduction that lands", "一次促成的引荐"],
  "wr.rowHeard":     ["Someone answers your post", "有人回你的帖子"],
  "wr.rowWeek":      ["A week you show up", "你出现的每一周"],
  "wr.rowSeat":      ["Being seat {n} — counted once", "第 {n} 号——只算一次"],
  "wr.rowPts":       ["{n} pts", "{n} 分"],
  "wr.rowEach":      ["{n} pts each", "每次 {n} 分"],

  "wr.seatSend":     ["Send your link", "把你的链接发出去"],

  /* WHERE THE MONEY COMES FROM, on the screen with the figure rather than a
     page away from it. A number whose inputs are visible is an illustration;
     the same number on its own is a forecast, and a forecast is the thing
     nobody should be reading here. */
  "wr.seatEx": [
    "Worked at a sale of {sale} with members holding {cut}%. Both are examples for showing the arithmetic — not offers, not forecasts, and not a valuation of anything.",
    "按售价 {sale}、成员共持有 {cut}% 算出来的。这两个数字只是用来演示算法的例子——不是报价，不是预测，也不是对任何东西的估值。",
  ],
  /* THE DILUTION, said before somebody works it out and concludes they were
     had. The figure is what one person holds if they do this and others do
     not; everybody doing it grows the denominator. */
  "wr.seatDilute": [
    "This is what you would hold if you did it and others did not. The more people everybody brings, the more ways the same pool divides.",
    "这是在别人没这么做、而你做了的情况下你会持有的份额。大家带进来的人越多，同一份池子分的份数就越多。",
  ],

  "wr.seatFine": [
    "Your number moves as people are let in or turned down. What a place comes to is up to whoever runs this board, could change, and only means anything if it is ever sold. Nothing here is a promise of money.",
    "随着有人被放进来或被回绝，你的号码会变动。一个位置最后值什么，由运营这个板子的人决定，可能会变，而且只有在这个板子真的被卖掉时才有意义。这里没有任何关于钱的承诺。",
  ],

  /* SAID WHILE THE ARITHMETIC IS HIDDEN. An intention, in as many words —
     "will be offered", not "you have", and a plain admission that how it
     works does not exist yet. Nothing here is a number and nothing is a
     promise; the moment either becomes one it belongs in the block, behind
     the switch, with its inputs on the screen beside it. */
  "wr.soon": [
    "The first hundred people in will be offered a share of this board. How that works is still being written, and none of it is settled.",
    "最早进来的一百个人，将会获得这个板子的一部分。具体怎么算还在拟定中，都还没有定下来。",
  ],

  /* SHARING, SAID AS A THING TO DO RATHER THAN A BUTTON TO FIND. It was one
     line inside the seat block, so turning that block off removed the only
     way to do the one thing this room asks for. Out here it is its own
     panel, above the fold, with the address visible — WeChat's browser has
     no share sheet and often no clipboard either, and a link somebody can
     read and long-press is the one that works when both are missing. */
  "wr.shareHead":    ["Your link", "你的链接"],
  /* WHAT IT PAYS, FIRST AND IN THE SAME BREATH AS THE BUTTON. "Counted as
     brought in by you" is bookkeeping; moving up the list is the thing
     somebody waiting actually wants, it happens the moment the row is
     created, and it is true — see queueOrder in server.js, where a place is
     the arrival order minus the people brought in. */
  "wr.shareWhy": [
    "Every person who joins through your link moves you one place up the list.",
    "每有一个人通过你的链接加入，你就在名单上往前一位。",
  ],
  /* THE NUMBER, BIG, ABOVE THE BUTTON. It was a grey line under the sentence
     — the fact somebody is actually here for, set smaller than the
     explanation of it. It is the headline of this panel now. */
  "wr.sharePlace":   ["You are", "你现在排"],
  "wr.shareOf":      ["of {t} waiting", "共 {t} 人在等"],
  /* WHAT A WEB PAGE CAN ACTUALLY DO. "Share to WeChat" promised something no
     page can do from inside WeChat — it blocks the share API on purpose and
     there is no way to hand it a link. Copying is the thing that works, so
     the button says that, and the sentence under it points at WeChat's own
     menu, which is the real way. A button that does nothing when tapped is
     worse than no button. */
  "wr.shareGo":      ["Share Invite", "分享邀请"],
  "wr.shareSheet":   ["Share Invite", "分享邀请"],
  /* Only shown inside WeChat, where it is the answer. Everywhere else the
     share sheet already has WeChat in it and this is noise. */
  "wr.shareWeChat": [
    "To put it in a chat: tap ••• at the top right, then Send to Friend — or Open in Safari and use Share.",
    "要发到聊天里：点右上角的 •••，选「发送给朋友」——或者「在 Safari 中打开」再用分享。",
  ],
  "wr.shareHold":    ["Or press and hold to copy it:", "或者长按复制："],

  "wr.others":       ["Waiting with you", "和你一起等的人"],
  "wr.othersNone": [
    "Nobody else has joined since the list started keeping cards.",
    "从名单开始保留卡片以来，还没有别人加进来。",
  ],
  "wr.inside":       ["Inside, this week", "里面，这周"],
  "wr.locked": [
    "Messages open when somebody brings you in.",
    "有人把你带进来之后，就能发消息了。",
  ],
  /* The two tabs. There were three: the third was a feed nobody outside the
     door can be shown, which would have been either a locked screen or the
     blurred shape they already scrolled past to get here. It arrives the day
     they are let in, and its arriving is part of what that feels like. */
  "wr.tabWait":      ["Waiting", "等候"],
  "wr.tabYou":       ["You", "你"],
  "wr.edit":         ["What members see", "成员看到的"],
  "wr.editSave":     ["Save", "保存"],
  "wr.saved":        ["Saved.", "已保存。"],
  "wr.gone": [
    "You are not on the list on this browser.",
    "这个浏览器不在名单上。",
  ],
  "wr.goneGo":       ["Ask to join", "申请加入"],
  "wr.inAlready":    ["You are a member. Open the board.", "你已经是这里的人了，直接打开。"],

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
  /* THE COOKIE, said here because the paragraph above stopped being the whole
     truth the day it was added. It holds the same hash and a signature, no
     name and nothing readable, and it exists because Safari deletes the
     number above after seven days without a visit — which was quietly losing
     people their profile, and then their waiting card. Saying "you become a
     new person" while a cookie was putting them back would be the page
     describing a product that no longer exists. */
  "pv.p1c": [
    "There is also a small cookie holding that same hash and a signature of it — no name, nothing readable, and no third party can see it. It is there because some browsers delete the number above after a week of not visiting, which was quietly costing people the profile or the waiting card they had built. Clear your cookies as well, or open it on a different phone, and you are a new person again.",
    "还有一个很小的 cookie，里面装的是同一个哈希值和它的签名——没有名字，读不出任何东西，任何第三方也看不到。它存在的原因是：有些浏览器超过一周没访问就会把上面那个数字删掉，而这会让人悄无声息地丢掉自己的资料或等候卡片。如果你把 cookie 也一起清掉，或者换一台手机打开，那你依然会变成一个新的人。",
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
  /* AN ADDRESS IS THE SECOND THING THIS SERVER HOLDS THAT CAN REACH SOMEBODY
     OFF THE BOARD, so it is documented the way cards are: its own section,
     next to the other one, with the cost said plainly rather than implied. */
  "pv.hmail":          ["Signing in", "登录"],
  "pv.pmail1": [
    "There are no accounts here. What identifies you is a random number your browser made up, and everything you write hangs off a hash of it. That number is your key, and it is shown to you on your own profile.",
    "这里没有账号。认出你的，是你浏览器随手生成的一串数字；你写的所有东西都挂在它的哈希值下面。那串数字就是你的钥匙，在你自己的资料页上能看到。",
  ],
  "pv.pmail2": [
    "Because most people do not save it, you can leave an email address instead. It is used for one thing: sending you six digits so you can get back in on another phone. It is never shown to another member, never sent anywhere else, and nothing on this board is gated on having one.",
    "因为大多数人不会把钥匙存下来，你也可以留一个邮箱地址。它只有一个用处：给你发六位数字，让你换手机之后还能回来。别的会员看不到它，它也不会被发去任何别的地方，而且这里没有任何功能是非留不可的。",
  ],
  /* The queue has the same problem and no separate box for it — see the note
     on /api/signin. Said here because it is the one place a contact somebody
     gave for one purpose is also used for another, and that is exactly the
     kind of thing this page exists to say out loud. */
  "pv.pmail4": [
    "If you are on the waiting list rather than in, the same six digits go to the way of reaching you that you typed on the form, when what you typed was an email address. It puts you back on your own row instead of making a second one. Nothing else is done with it.",
    "如果你还在等候名单上，同样的六位数字会发到你在表单里填的那个联系方式——前提是你填的是邮箱。它只是把你放回你自己那一行，而不是多出一行。除此之外不会用它做别的。",
  ],
  "pv.pmail3": [
    "The honest cost: it is an address, held on the same server as everything else, and whoever runs this board can read the file — the same trade a card asks for. Clear the box and it is gone from the row; delete your account and it goes with everything else. Anyone who can read your inbox can become you, which is true of every service that works this way.",
    "老实说代价在哪：那是一个地址，和别的东西存在同一台服务器上，运行这个板的人能看到那个文件——和名片是同一笔交换。把框清空，它就从那一行里消失；把账号删掉，它跟着一起没。谁能看你的邮箱，谁就能变成你——所有这样做的服务都是这样。",
  ],
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

  /* BEING TOLD A MESSAGE ARRIVED. Its own section rather than a clause under
     Messages, because it is the first thing this board does that REACHES
     OUTWARD — every other row here sits still until somebody opens a page, and
     this one wakes a phone. A person is owed the shape of that: what is
     stored, what travels, and what a lock screen can therefore leak, which is
     nothing. */
  "pv.hpush":          ["Being told a message arrived", "消息提醒是怎么做的"],
  "pv.ppush1": [
    "If you turn notifications on, your browser makes a subscription and we keep it: a web address at Apple, Google or Mozilla that reaches this browser, and two keys your browser generated. That is the whole row. It carries no name, no address, and nothing that says who you are — and if you never turn it on, none of it is stored at all.",
    "如果你打开了消息提醒，浏览器会生成一个订阅，我们把它存下来：一个苹果、谷歌或 Mozilla 那边的网址（能找到这个浏览器），加上浏览器自己生成的两把钥匙。整行就这些。里面没有名字、没有联系方式，也没有任何能指认你的东西——如果你从来没打开过，这些我们一条都不会存。",
  ],
  "pv.ppush2": [
    "Nothing is sent through it. The notification carries no message, no name and not even which conversation it came from — it says somebody wrote to you, and that is all it is capable of saying. So a phone on a table with the screen showing gives nothing away, and it means we cannot leak on a lock screen what we would not say anywhere else. Turning it off removes the subscription, and deleting your account takes it with everything else.",
    "我们不会通过它发送任何内容。提醒里没有消息正文、没有名字，连是哪一段对话都没有——它只说「有人给你留言了」，也只能说这一句。所以手机放在桌上亮着屏，别人也看不到什么；这也意味着我们不可能在锁屏上泄露那些本来就不该说出去的东西。关掉提醒就会删掉这个订阅，注销账号也会把它一并带走。",
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

  /* AN ANNOUNCEMENT IS THE ONE PAGE HERE ANYBODY CAN OPEN, so the one number
     it keeps has to be on this page too. Somebody reading it has not agreed to
     anything and may never have heard of this board — which is exactly the
     person a counter is easiest to be quiet about. */
  "pv.pcount3": [
    "A poster somebody pasted into a group chat counts the same way, and it is the only thing on this board readable without a password. One number: how many browsers opened it. Not who, not from where, not which chat it was forwarded into — none of that is asked for and none of it is written down. Putting your name down on it is the ordinary waiting list, below.",
    "别人转到群里的那种页面也是一样的算法，而且那是这个板子上唯一不用口令就能打开的东西。只有一个数字：有多少个浏览器打开过。不记谁、不记从哪儿来、不记被转到了哪个群——这些都不问，也都不写下来。在上面留名字，就是下面说的那个普通的候补名单。",
  ],

  /* THE WAITING LIST IS THE FIRST THING WE HOLD ABOUT SOMEBODY WHO IS NOT A
     MEMBER, so it gets its own section rather than a clause. The waitlist form
     promises three things — nobody but the operator reads it, none of it
     appears on the board, and it is deleted either way — and a promise made in
     a form has to be findable here too, or it is only marketing. */
  "pv.hwait":          ["The waiting list", "等候名单"],
  "pv.pwait1": [
    "If you asked to join and are waiting, what we hold is what you typed into that one form — a name to call you, a way to reach you, and whatever you wrote about yourself — plus anything you added afterwards in the waiting room: a language level, a type, what you are looking for. There is no account behind any of it.",
    "如果你申请加入、正在等候，我们保留的就是你在那个表单里填的东西——一个称呼、一个联系方式，以及你写的那段自我介绍——再加上你之后在等候室里补的：语言水平、类型、你在找什么。这些背后都没有账号。",
  ],
  "pv.pwait2": [
    "Your name, your line and what you added are shown to members and to the other people waiting. That is the point of them: it is how somebody decides to bring you in, and there is no other way in. The way to reach you is shown to nobody at all — not to a member, not to the room, only to whoever runs this board. The list is deleted once you are let in, and deleted if you are not.",
    "你的名字、那句话，以及你补上的东西，会给成员和其他在等的人看。这正是它们存在的意义：有人就是这样决定把你带进来的，除此之外没有别的路。联系方式则不给任何人看——成员看不到，等候室里的人也看不到，只有运行这个板的人能看到。你被放进来之后名单会被删掉，没被放进来也会被删掉。",
  ],
  /* WHO THIS DOES NOT APPLY TO, said here because it is the whole reason the
     paragraph above can be honest. */
  "pv.pwait3": [
    "Everybody who asked to join before this changed answered a different question — one that promised no member would ever see their name. Nothing about them is shown to anybody, and that does not expire. The number of people waiting is still only ever a number, and only once enough people are waiting that it cannot point at anybody.",
    "在这条改动之前申请的人，当时回答的是另一个问题——那个版本承诺过任何成员都不会看到他们的名字。关于他们的任何东西都不会给任何人看，而且这一点不会过期。等候人数依然只是一个数字，而且要等到人数多到这个数字指不到任何具体的人时才会出现。",
  ],
  /* WHAT NOBODY HERE WILL ASK YOU FOR. This lived under the deck on Browse
     as four lines of fine print, between the faces and the waiting list. True
     and worth saying once — and standing in the middle of the screen people
     came to look at people, which is the wrong place to make a promise about
     safety. It belongs here, where somebody who wants to know what is kept
     about them comes to look. */
  "pv.hsafe":          ["What nobody here will ask you for",
                        "这里没有人会向你要的东西"],
  "pv.psafe1": [
    "Nothing here needs your phone number or your documents, and nobody should be asking you for them. A WeChat id is only ever swapped by two people who each chose to. You never have to meet anyone to use this.",
    "这里不需要你的电话或者证件，也不该有人向你要。微信号只在两个人都主动选择的情况下才会交换。你完全不用见面就能用这个应用。",
  ],
  "pv.psafe2": [
    "If somebody does ask, that is worth reporting — a person reads every report, and anything here can be taken down.",
    "如果真有人问你要，那值得举报——每一条举报都有人看，这里的任何内容都可以撤下。",
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
  /* Asked once, then it stops standing in the way. So it is an invitation
     rather than a refusal: "add one first" is a door being held shut, and
     what is true is that a page with a face on it is read and one without is
     scrolled past. */
  "me.needPhoto": [
    "Add a photo — a page with a face on it gets read. You can do it after.",
    "加一张照片吧——有照片的主页才有人看。也可以之后再加。",
  ],
  /* The same button, once it has asked for a photo and been pressed anyway. */
  "me.postAnyway":     ["Put me in without one", "没有照片也先进去"],
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
  // ---------------------------------------------------------------------
  // SOMEBODY ELSE'S PROFILE, FROM YOUR OWN.
  //
  // The console was reachable only by people who came through the agent door
  // or who already had somebody on their roster — which meant a member who
  // decided halfway through that they wanted to put a friend up had no way to
  // do it and no way to find out it was possible. The server never had that
  // rule: /api/run/add has always only asked that you have a page of your own
  // and are not yourself run by somebody. This is that permission, said out
  // loud, on the screen where somebody is already editing a profile.
  // ---------------------------------------------------------------------
  "me.runTitle":       ["Someone else", "帮别人建"],
  "me.runBody": [
    "Put up a profile for somebody you represent, and run it from your phone. They never need the app.",
    "你可以帮你代管的人建个主页，在你手机上打理。他们本人不用下载、不用注册。",
  ],
  "me.runGo":          ["Add someone", "加一个人"],
  /* THE OTHER HALF OF THE QUESTION, and it is asked on this side of the wire
     on purpose. Whoever holds the row presses the button — see /api/me/agent.
     The sentence under it is not softened: it says what the agent will be
     able to do, because a person handing over their account is exactly who
     this board must not be vague with. */
  "me.repGo":          ["Somebody handles this for me", "有人帮我打理这个号"],
  "me.repSay": [
    "Ask them for their six characters. They will be able to post as you, read your cards and follow for you — it is your account, in their hands. They can hand it back.",
    "找他要那六个字符。给了之后，他就能用你的身份发内容、看你的名片、替你关注——这个号还是你的，但在他手里。他也可以再还给你。",
  ],
  "me.repLab":         ["Their six characters", "他的六个字符"],
  "me.repDo":          ["Hand it over", "交给他"],
  "me.repOk":          ["Done. {who} runs this now.", "好了。现在由 {who} 打理。"],
  "me.repBad":         ["Those six do not work.", "这六个字符用不了。"],
  "me.repOld":         ["That code has run out. Ask for another.", "这个码过期了，让他再给一个。"],
  "me.repSelf":        ["That is your own code.", "这是你自己的码。"],
  "me.repAlready":     ["Somebody already handles this.", "已经有人在帮你打理了。"],
  "me.repRuns":        ["You speak for other people, so nobody may speak for you.", "你在替别人打理，所以不能再让别人替你打理。"],
  "me.repFull":        ["Their list is full.", "他那边满了。"],
  // Shown instead of everything above, once it is done.
  "me.client":         ["{who} handles this account.", "这个号由 {who} 打理。"],

  /* Two links, because by the time there is a roster the console is the
     useful screen and the setup page is a detour. */
  "me.runMore":        ["The people you speak for", "你代管的人"],
  "key.title":         ["Your key", "你的钥匙"],
  /* It used to say "this one line is how you get back in", which was true
     until the box above it existed and reads as a contradiction now. The key
     is still the mechanism; the address is the door most people will use. */
  "key.body": [
    "This is you. There is no account here and no password — the address above brings you back, and this line does it without one. Worth keeping somewhere.",
    "这就是你。这里没有账号，也没有密码——上面那个邮箱能把你带回来，这一行不用邮箱也行。找个地方存一份。",
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

  /* SIGNING IN, WHICH IS THE KEY WITH A DOOR PEOPLE RECOGNISE ON IT.
   *
   * The key above is the real mechanism and it stays. What it is not is a
   * thing most people have ever seen: they do not save it, and they find out
   * what it was for on the day they change phone. An address and six digits is
   * the shape everybody already knows, and underneath it does exactly what
   * pasting a key does — see the note above /api/signin.
   *
   * The address is never shown to anybody, which is said here rather than
   * assumed: on a board that asks for no phone number and no documents, a box
   * wanting an email needs to say in the same breath where it goes. */
  "mail.title":        ["The way back in", "换手机之后怎么回来"],
  /* The tray row. It reports rather than asks — see drawSetts — so the label
     is the address itself when there is one. */
  "set.mailNo":        ["No way back in", "还没有回来的路"],
  "set.mailNoWhy": [
    "Change phone and you would lose this page. An address fixes that.",
    "换手机就找不回这个主页了。留个邮箱就不会。",
  ],
  "set.mailYesWhy":    ["Six digits here gets you back in on any phone.",
                        "任何手机上，六位数字就能回来。"],
  "set.mailAdd":       ["Add", "去留"],
  "set.mailChange":    ["Change", "改"],
  "mail.body": [
    "Leave an address and you can get back in from any phone: we send six digits, and that is the whole of it. Nobody on the board ever sees it.",
    "留个邮箱。以后换手机，我们发你六位数字，你就能回来。板上没有人看得到这个地址。",
  ],
  "mail.ph":           ["your@email", "你的邮箱"],
  /* The waiting room's version of the same question. Written for somebody who
     has not been let in yet: what they stand to lose is a place in a queue,
     not a page. See the note beside it in room.html — the box is write-only,
     so it says which state they are in rather than showing an address back. */
  "wr.backLab":        ["If you change phone", "万一你换了手机"],
  "wr.backYes": [
    "You gave an email, so six digits can put you back on this row.",
    "你留的是邮箱，六位数字就能把你放回这一行。",
  ],
  "wr.backNo": [
    "You gave a WeChat id, which cannot bring you back. Leave an email and your place survives a new phone.",
    "你留的是微信号，换手机就找不回来了。留个邮箱，位置就还在。",
  ],
  "wr.backNew":        ["A different email", "换一个邮箱"],
  "mail.keep":         ["Save it", "存下来"],
  "mail.saved":        ["Saved.", "存好了。"],
  "mail.cleared":      ["Removed.", "已经删掉了。"],
  "mail.bad":          ["That does not look like an address.", "这不太像一个邮箱地址。"],
  "mail.taken":        ["Somebody here already uses that address.",
                        "这个地址板上已经有人在用了。"],

  "in.title":          ["Sign in", "登录"],
  /* NOT "on your profile". Half the people who reach this are on the waiting
     list and have no profile — what they have is the address they typed when
     they asked to join. One sentence that is true of both. */
  "in.body":           ["The email address you left here. We send you six digits.",
                        "你在这儿留过的那个邮箱。我们发你六位数字。"],
  "in.send":           ["Send me a code", "给我发验证码"],
  "in.codeTitle":      ["Six digits", "六位数字"],
  "in.codeBody": [
    "Sent to {mail}. It works for ten minutes. If nothing arrives, look in the spam folder.",
    "已经发到 {mail}，十分钟内有效。要是没收到，翻一下垃圾邮件。",
  ],
  "in.go":             ["Go in", "进去"],
  "in.cancel":         ["Cancel", "取消"],
  /* NOT "that address is not registered". The reply is the same whether or not
     anybody here uses it — see /api/signin — so the words have to be true of
     both cases, and this is what is true of both: if it is a member's address,
     a code is on its way. */
  "in.sent":           ["If that address belongs to somebody here, six digits are on their way.",
                        "如果这个地址是这里某个人的，六位数字已经在路上了。"],
  "in.bad":            ["That code is not right.", "这个验证码不对。"],
  "in.left":           ["That code is not right. {n} tries left.",
                        "验证码不对，还能试 {n} 次。"],
  "in.old":            ["That code has run out. Ask for another.",
                        "验证码过期了，重新要一个吧。"],
  "in.spent":          ["Too many tries. Ask for another code.",
                        "试太多次了，重新要个验证码。"],
  /* Rebinding moves; it does not copy — so this is said before it happens
     rather than discovered afterwards. See the note above /api/signin/code. */
  "in.here": [
    "This phone is already somebody here. Signing in leaves that person behind, and it would take their key to get back to them.",
    "这台手机上已经是某个人了。登录之后，那个人就留在原处——要回去，得有他的钥匙。",
  ],
  "in.anyway":         ["Sign in anyway", "还是登录"],
  "in.done":           ["Welcome back, {who}.", "欢迎回来，{who}。"],
  "in.haveKey":        ["I have a key instead", "我有钥匙，用钥匙"],
  "in.off": [
    "Signing in by email is not set up on this board. Use your key.",
    "这块板还没开邮箱登录。用钥匙进吧。",
  ],

  /* LEAVING FOR GOOD. It lists what goes before it goes, because a plain
     "are you sure?" makes somebody guess, and the guess is always smaller
     than the truth — most people think this hides a profile. */
  "gone.go":           ["Delete everything and leave", "删除全部内容并离开"],
  "gone.head":         ["Delete everything?", "确定要删除全部内容吗？"],
  "gone.body": [
    "This cannot be undone, and there is no way to get any of it back. Your number stops working the moment you press it.",
    "这个操作没法撤销，删掉的东西也拿不回来。你的那串数字，一按下去就失效了。"],
  "gone.l1":           ["Your profile and your photo", "你的资料和照片"],
  "gone.l2":           ["Everything you have posted", "你发过的所有内容"],
  "gone.l3": [
    "Every message, including the ones written to you",
    "所有私信，包括别人写给你的"],
  "gone.l4": [
    "Your card, and it stops working for everyone you gave it to",
    "你的名片，收到过的人也都看不到了"],
  "gone.l5":           ["Everyone you follow, and everyone following you",
                        "你关注的人，和关注你的人"],
  "gone.keeps": [
    "Two things stay, with your name taken off them: the record that your invite code was used, and any offer somebody has already accepted. Neither can be traced back to you.",
    "有两样会留下，但会把你的名字去掉：你的邀请码被用过的记录，还有已经被人接受的邀约。这两样都追溯不到你。"],
  "gone.no":           ["Keep my account", "先不删"],
  "gone.yes":          ["Delete everything", "全部删除"],
  "gone.going":        ["Deleting…", "正在删除……"],
  "gone.failed":       ["That did not work. Nothing has been deleted.",
                        "没成功。什么都还没删掉。"],
  "gone.done": [
    "Everything is deleted. Nothing of yours is left here.",
    "已经全部删除，这里不再有你的任何内容。"],

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
  "nav.cards":         ["Cards", "名片"],
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
  /* WHAT THE BUTTON DOES, ON A SCREEN HEADED "A photo and a name".
     "Post it" read as posting a message. Joining does put you on the board —
     that is the point of the button — so it says so. */
  /* "The board" is the house word for this, not a word a new member has met.
     What the button does is make them findable by the people in the room. */
  "me.post":           ["Put me in the room", "把我放进房间"],
  /* WHAT IS ACTUALLY LEFT BEHIND IT.
     LinkedIn, Instagram and the line about what somebody is working on used to
     be in here too, and the first member to look for LinkedIn read a button
     offering university and age and correctly concluded it was not in there.
     Those three are on the form now; a disclosure should hold the things
     nobody is hunting for, and only those. */
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
  /* THE BIO. Six hundred characters, which is a real paragraph, and it shows
     on the profile under the name — but it was called "what you are working
     on" and sized like a one-liner, so members with a bio already written
     could not see where to put it. Same field, same store; it is named for
     what people arrive wanting to write. */
  /* ASKS FOR TWO SENTENCES, and says so, because the box asking for "a few
     lines" got paragraphs. What reads best on this board is somebody saying
     plainly what they do and what they want; the ones worth having are not the
     ones who write the most. */
  "me.goal": [
    "Two sentences. What you do, and what you are here for.",
    "两句话就够：你做什么，来这儿想干什么。",
  ],
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
  /* Two strings, because "1 people followed you" is the product misspelling
     its own good news. And the word follows the deck's button. */
  "prof.connected1":   ["Somebody followed you", "有人关注了你"],
  "prof.connected":    ["{n} people followed you", "{n} 个人关注了你"],
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
  /* THE SAME ROOMS, AS CHIP LABELS.
     The room names are written for the profile form, where somebody is
     choosing what they want and a full sentence is the right length — "New
     here — want someone who knows the city" tells them exactly what they are
     ticking. As chips in the composer those sentences are one full line each,
     and fourteen of them is a wall.
     So a second, shorter pair per room, for anywhere a room is a tag rather
     than a choice. Two or three words, the same meaning, and never a dash:
     if the short one needs a qualifier it is not short. */
  "room.t.lang":       ["Language exchange", "语言交换"],
  "room.t.study":      ["Study partner", "学习伙伴"],
  "room.t.new":        ["New here", "刚来"],
  "room.t.host":       ["Showing people around", "带人转转"],
  "room.t.job":        ["Looking for work", "找工作"],
  "room.t.hire":       ["Hiring", "招人"],
  "room.t.cofound":    ["Co-founder", "找合伙人"],
  "room.t.raise":      ["Raising money", "融资"],
  "room.t.invest":     ["Investing", "投资"],
  "room.t.buy":        ["Buying from China", "从中国采购"],
  "room.t.sell":       ["Supplying from China", "从中国供货"],
  "room.t.talent":     ["Looking for an agent", "找经纪人"],
  "room.t.agent":      ["Agent or manager", "经纪或经理人"],
  "room.t.ask":        ["Just asking", "就是问问"],

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

  /* THE SHELF. The matches list came out of the notification tray, where it
     showed two rows inside a summary somebody had to open, and became a tab
     of its own. These are the strings that only exist because it is a screen
     now rather than a line in a digest. */
  /* THE OFFER PAGE. Read by somebody who may never have heard of this board —
     so nothing here assumes they know what The Exchange is, and none of it
     asks them to learn before they can answer. */
  /* THE COMPOSER, in the tray. Written for somebody who is about to reach a
     person who may not be a member — so it says what the link does before it
     asks for anything. */
  "mko.lab":           ["Make an offer", "发一个邀约"],
  "mko.why": [
    "You get one link. It opens for anybody — no code, no account — and whoever accepts it is in the room from that moment.",
    "你会拿到一个链接。任何人都能打开，不需要邀约码、不需要注册；谁接受了，谁就从那一刻起进来了。"],
  "mko.who":           ["Who it is for", "发给谁"],
  "mko.whoHint":       ["A note to yourself", "只有你自己看得到"],
  "mko.give":          ["What they would be doing", "他们要做的"],
  "mko.giveHint":      ["Two days on a beauty campaign, Shanghai.", "上海，美妆拍摄，两天。"],
  "mko.money":         ["What it pays", "报酬"],
  "mko.moneyHint":     ["¥6,400 for the day", "一天 6,400 元"],
  "mko.want":          ["What you would expect", "你希望对方做到的"],
  "mko.wantHint":      ["A fitting on the Thursday before.", "拍摄前的周四试装。"],
  "mko.kind":          ["What it is", "是什么"],
  "mko.kindJob":       ["A job", "一份工作"],
  "mko.kindProject":   ["A project", "一个项目"],
  "mko.moneyOpenHint": ["Leave it blank if it is not settled", "还没定就先空着"],
  "mko.giveProjectHint": [
    "A short film, shooting in Chengdu next spring. Looking for a lead.",
    "一部短片，明年春天在成都拍，找一位主演。"],
  "mko.go":            ["Make the link", "生成链接"],
  "mko.made":          ["Tap it to send.", "点一下发出去。"],
  "mko.madeWx":        ["Tap it to copy, then paste it into the chat.",
                        "点一下复制，然后粘贴到聊天里。"],
  /* WHAT LANDS IN THE CHAT. It says what the link is before somebody taps a
     strange address, and never what the offer says — that card can sit in a
     conversation other people are reading. */
  "mko.share": [
    "I have made you an offer. Open it here — nothing happens until you accept.\n{url}",
    "我给你发了一个邀约，点这里看：接受之前什么都不会发生。\n{url}"],
  "mko.copied":        ["Copied. Paste it into WeChat.", "已复制，粘贴到微信发出去。"],
  "mko.copyfail":      ["Copy it by hand — press and hold.", "长按手动复制。"],
  "mko.nopage":        ["Put your own page up first.", "先把你自己的主页建好。"],
  "mko.failed":        ["That did not go through. Try again.", "没有成功，再试一次。"],

  "off.title":         ["You have been made an offer.", "有人给你发了一个邀约。"],
  "off.lede": [
    "Read it, and put your name to it if you want it. Nothing happens until you do, and nobody is told if you do not.",
    "看一下，愿意的话签个名。在那之前什么都不会发生；不愿意也没人会知道。"],
  /* The one refusal at the door that is not a refusal: /i/CODE and /o/CODE are
     one letter apart, and somebody sent the second who lands on the first has
     the right code and the wrong screen. */
  "door.isOffer": [
    "That is an offer, not an invitation — opening it.",
    "这是一个邀约，不是入场码——正在打开。"],
  "off.kJob":          ["a job", "一份工作"],
  "off.kProject":      ["a project", "一个项目"],
  "off.moneyOpen": [
    "Not settled yet — that is what you would talk about.",
    "还没谈定——这正是要聊的事。"],
  "off.head":          ["The offer", "邀约内容"],
  "off.give":          ["What you would be doing", "你要做的"],
  "off.money":         ["What it pays", "报酬"],
  "off.want":          ["What they would expect", "对方希望的"],
  "off.signsay": [
    "Your name here is your signature. It goes on the record with today's date.",
    "在这里写下名字就是签名，会连同今天的日期一起记录下来。"],
  "off.yourname":      ["Your name", "你的名字"],
  "off.yourreach":     ["Your WeChat, so they can answer you", "你的微信，方便对方回复你"],
  "off.take":          ["Accept", "接受"],
  "off.fine": [
    "No account, no password, no phone number.",
    "不需要注册、不需要密码、不需要手机号。"],
  "off.donehead":      ["Accepted.", "已接受。"],
  /* WHAT ACCEPTING ACTUALLY DID. It records the deal and puts them in the
     queue — it does not open the door, and this used to say it did. Nobody
     walks into this room, including somebody holding a link that was meant
     for them. */
  "off.donesay": [
    "It is on the record. You are on the list with this offer against your name — {who} still has to let you in, and that is usually quick. Put a photograph and a line up while you wait.",
    "已经记录下来了。你已经在名单上，名字后面附着这个邀约——还需要{who}放你进来，通常很快。等的时候可以先放一张照片、写一句话。"],
  "off.donego":        ["See where you are", "看看你的位置"],
  /* A member who accepts is already inside and must not be told to wait. */
  "off.doneIn": [
    "It is on the record. Nothing else to do — you are already in.",
    "已经记录下来了。你本来就在里面，不用再做什么。"],
  "off.doneGoIn":      ["Go in", "进去看看"],
  "off.someone":       ["whoever sent it", "发给你的人"],
  "off.already": [
    "Somebody has already taken this one.",
    "这个邀约已经被别人接了。"],
  "off.yours":         ["This is your own offer.", "这是你自己发出的邀约。"],
  "off.failed":        ["That did not go through. Try again.", "没有成功，再试一次。"],
  "off.withdrawn":     ["This offer has been withdrawn.", "这个邀约已经被收回了。"],
  "off.gone":          ["There is no offer at this address.", "这个地址上没有邀约。"],
  "off.nocode":        ["That link is missing its code.", "这个链接少了邀约码。"],

  "cards.head":        ["Your cards", "你的名片夹"],
  /* Two strings, because "1 people you have matched with" is the product
     miscounting the one thing on the screen. */
  "cards.n1":          ["1 match", "1 个匹配"],
  "cards.n":           ["{n} matches", "{n} 个匹配"],
  /* THE SHELF, IN ONE LINE, and in the words somebody would actually use.
     It said "your sentence and theirs answer each other", which is how the
     matching works and not how a person thinks about it. What they want to
     know is who these people are and whether anything has already gone out. */
  /* FOUR SENTENCES BECAME ONE. It read "This is where the fun starts.
     Everyone here is looking for what you've got. Nobody has your WeChat yet.
     Press Connect to send it." — an explanation of a mechanism that is now
     DRAWN on every row underneath it: two cards and an arrow. A paragraph
     above a picture of the same thing is the paragraph nobody reads. */
  "cards.what": [
    "Swap details. Yours goes first.",
    "互换联系方式。你先发。"],
  "cards.none":        ["No cards yet.", "还没有名片。"],
  "cards.noneWhy": [
    "A card lands here when you and somebody else follow each other and want the same kind of thing. Nothing arrives on its own — go and look at who is here.",
    "当你和某个人互相关注、而且想找的东西对得上时，这里就会多一张名片。名片不会自己出现，先去看看这里都有谁。"],
  "cards.noneGo":      ["Look at who is here", "看看这里有谁"],
  /* MATCHED, NOTHING SENT YET. This was "{who} has not given you their card
     yet", which described the wrong half: the reader is the one who can move,
     and the row now says so. Nothing here is being withheld by the app — see
     the note on .meet in index.html. */
  "cards.matchHead":   ["You matched", "你们匹配上了"],
  "cards.matchWhy": [
    "Neither of you has sent anything yet.",
    "你们都还没发出任何东西。"],
  "cards.give":        ["Connect with {who}", "和{who}建立联系"],
  /* THE BUTTON ON THE SHELF DROPS THE NAME. It is directly under the row that
     says who this is, so repeating it makes a longer button saying the same
     thing. cards.give keeps the name because it heads the SHEET, where the
     row is no longer on screen. */
  "cards.giveGo":      ["Connect", "建立联系"],
  /* THE ONE LINE UNDER THE PICTURE — whose move it is, which is the only part
     two cards and an arrow cannot draw. */
  "cards.capYours":    ["Send yours to get theirs", "先发你的，才能拿到他的"],
  "cards.capSent":     ["Sent — waiting for theirs", "已发出——等他的"],
  // Theirs arrived first. The row looked finished while the other person was
  // still waiting on you, so it now says which way round it is.
  "cards.capTheirs":   ["They sent theirs — send yours", "他发过来了——把你的发给他"],
  /* THE END OF IT. Not "matched", which is the beginning: this is two people
     who have each other's details and can now talk anywhere they like. */
  "cards.swapDone":    ["Connected — swap complete", "已连上——名片互换完成"],
  "cards.giveHow": [
    "{who} gets your WeChat and a line from you. You get theirs if they send it back.",
    "{who}会收到你的微信号和你写的一句话。对方回发，你才拿到他们的。"],
  "cards.sentHead":    ["Sent to {who}", "已发给{who}"],
  "cards.sentWhy": [
    "{who} has your WeChat now. Theirs shows up here if they send it back.",
    "{who}已经有你的微信了。对方回发，这里就会出现他们的。"],
  "cards.takeBack":    ["Take it back", "收回"],

  /* THE SHEET. One line and one field: who you are, and what to reach you on.
     Not a message box — see the block comment above openGive in index.html. */
  "give.head":         ["Connect with {who}", "和{who}建立联系"],
  "give.hint":         ["You and {who} matched.", "你和{who}匹配上了。"],
  "give.ph": [
    "Say who you are and what you're after.",
    "说说你是谁，你在找什么。"],
  "give.count":        ["{n} left", "还剩 {n} 字"],
  "give.mine":         ["Goes with it", "一起发过去"],
  "give.wxPh":         ["Your WeChat id", "你的微信号"],
  "give.wxHow": [
    "Only they can read it, and you can take it back.",
    "只有对方看得到，你随时可以收回。"],
  "give.wxHowQr": [
    "Your code goes with it. Only they can read either, and you can take it back.",
    "你的二维码也会一起发过去。只有对方看得到，你随时可以收回。"],
  "give.needWx":       ["Put a WeChat id in first — there is nothing to send yet.",
                        "先填一个微信号，不然没东西可发。"],
  "give.failed":       ["That did not send. Try again.", "没发出去，再试一次。"],
  "give.no":           ["Not now", "先不发"],
  "give.go":           ["Connect", "建立联系"],
  "cards.copy":        ["Copy", "复制"],
  "cards.copied":      ["Copied", "已复制"],
  /* THE HANDOVER, in the order the two halves actually work in.
     "Open WeChat" alone was a dead button — WeChat has no link that opens a
     chat with a stranger — so the code comes first and the id sits under it. */
  "cards.qrHow": [
    "Press and hold to save it, then in WeChat: Scan · from album.",
    "长按保存，然后在微信里：扫一扫 · 从相册选取。"],
  "cards.qrHowWx": [
    "Press and hold the code to save it, then Scan · from album.",
    "长按二维码保存，再用扫一扫 · 从相册选取。"],
  /* "Open WeChat" is gone, string and all. WeChat has no link that opens a
     chat with somebody you have never spoken to, so the button could only
     launch the app and abandon the person on whatever screen it was left on.
     It survived because there was nowhere else to talk; Messages is a real
     messenger now, and the button under a card is the conversation. */
  // The conversation, from the card. Both of you agreed to talk by swapping.
  "cards.talk":        ["Message them", "给他发消息"],
  "cards.idHow": [
    "In WeChat: search, paste the id, Add.",
    "在微信里搜索，粘贴微信号，添加。"],
  "card.theyAdded":    ["They added", "他们还写了"],
  "card.takeBack":     ["Take my card back", "收回我的名片"],
  "card.takeBackWhy": [
    "Stops {who} opening it again. It does not unsend it.",
    "让{who}以后打不开。已经发出去的收不回来。",
  ],
  "card.gaveBack":     ["Taken back.", "已收回。"],
  "card.qrLab":        ["Your WeChat code", "你的微信二维码"],
  "card.qrWhy": [
    "A picture of your own code. Plenty of accounts cannot be found by searching an id, and this one can always be scanned from the photo roll. Only the people you hand your card to ever see it.",
    "上传你自己的二维码截图。很多号搜微信号是搜不到的，而二维码从相册里总能扫出来。只有你把名片给到的人才看得到。"],
  "card.qrHow": [
    "Press and hold to save it, then in WeChat: Scan · from album.",
    "长按保存，然后在微信里：扫一扫 · 从相册选取。"],
  "card.qrSending":    ["Sending…", "正在上传…"],
  "card.qrSaved":      ["Saved.", "已保存。"],
  "card.qrBig":        ["That picture is too big.", "图片太大了。"],
  "card.qrFailed":     ["That did not go through. Try again.", "没有成功，再试一次。"],
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
  /* THE LEDGER, in a member's own words.
     Points and a share, never an amount and never the word ownership — what a
     point turns into is a promise on paper somewhere else, and a screen that
     hints at money before that paper exists is a screen that lies. */
  "stake.head":        ["Your seat", "你的位置"],
  /* Under the number in the ring. Share, never ownership — and not "equity",
     which is the word that describes a security and would put a page anybody
     can open into a category it does not belong in. What a point comes to is
     the operator's intention, said in stake.note below. */
  "stake.ring":        ["of the points", "占积分"],
  "stake.total":       ["Total points", "总积分"],
  /* NOT "{n}% of the board", which is the sentence a shareholder says. It is
     a share of the points counted so far and nothing else — the same number,
     naming the thing it is actually a proportion of. */
  "stake.share":       ["{n}% of the points so far", "占目前全部积分的 {n}%"],
  "stake.seat":        ["Seat {n} of {seats}", "第 {n} 号，共 {seats} 个"],
  "stake.left":        ["{n} seats left", "还剩 {n} 个位置"],
  "stake.last":        ["1 seat left", "只剩 1 个位置了"],
  "stake.full":        ["The seats are taken", "位置已经满了"],
  "stake.none": [
    "The hundred seats were taken before you arrived. Everything else on this board works the same for you.",
    "那一百个位置在你来之前就满了。这个板子上其他所有东西，对你都是一样的。",
  ],
  /* One line, not three. The panel is read in ten seconds by somebody who
     already knows what it is; the long version of this was the paragraph
     everybody scrolled past to reach the button underneath. */
  /* WHAT STOPS ON THE DATE IS THE COUNTING. "Fixed" was about the points and
     could be read as an entitlement becoming fixed, which is a commitment
     nobody has made. The sentence says which of the two it is. */
  "stake.moves": [
    "Counting goes on until {date}.",
    "积分会一直算到 {date}。",
  ],
  "stake.frozen":      ["Counting stopped on {date}.", "积分已于 {date} 停止计算。"],
  /* What earned it, in the order it is worth reading: the big one first. */
  "stake.p.guests":    ["{n} you brought in, who stayed", "{n} 个你带进来、并且留下的人"],
  "stake.p.heard":     ["{n} people answered you", "{n} 个人回过你"],
  "stake.p.cards":     ["{n} introductions that landed", "{n} 次真的接上头的引荐"],
  "stake.p.weeks":     ["{n} weeks you turned up", "{n} 周你都在"],
  /* One of each. English needs the singular and Chinese does not, which is
     why every Chinese half below is the same sentence as the plural above. */
  "stake.p.guests1":   ["1 you brought in, who stayed", "1 个你带进来、并且留下的人"],
  "stake.p.heard1":    ["1 person answered you", "1 个人回过你"],
  "stake.p.cards1":    ["1 introduction that landed", "1 次真的接上头的引荐"],
  "stake.p.weeks1":    ["1 week you turned up", "1 周你都在"],
  "stake.p.found":     ["Being here early", "来得早"],
  /* Shorter, and still says the three things it has to: not money, not
     transferable, and the paper elsewhere is what counts. */
  /* WHAT THIS LINE MAY NOT DO IS CLAIM A DOCUMENT.
     It said "a separate promise in writing", and there is no such document —
     which makes the most careful sentence on the screen the only untrue one,
     and makes every figure above it rest on a piece of paper nobody can be
     shown. What it says instead is exactly where things stand: an intention,
     the operator's, changeable, and worth nothing unless the board is ever
     sold. When the terms are written down this becomes a link. */
  "stake.note": [
    "Points, not money, and not transferable. What they come to is up to whoever runs this board, could change, and only means anything if it is ever sold.",
    "是积分，不是钱，也不能转给别人。最后值什么，由运营这个板子的人决定，可能会变，而且只有在这个板子真的被卖掉时才有意义。",
  ],
  "brw.inside":        ["{n} people are in.", "里面有 {n} 个人。"],
  /* The queue, as a list rather than a number — see /api/queue. Only somebody
     already in ever sees these, and never how to reach anybody. */
  /* THE HEAD OF THE LIST, and the list is under it either way now. It led
     with the first three names while it was a shut button that had to be
     worth opening. Open by default, the rows do that job themselves, so the
     head says the thing nobody should have to work out: these people are
     OUTSIDE, and there is something a member can do about it. */
  /* THE FEED, BEFORE THERE IS ONE. Not an empty state — the feed is full of
     rows nobody in the room wrote, and showing those is worse than showing
     nothing. See drawSoon. */
  "soon.lab":          ["The feed", "动态"],
  "soon.head":         ["Not open yet.", "还没开放。"],
  "soon.say": [
    "This is where members talk to each other. It opens the day somebody here posts — until then there is nothing worth reading, and a busy-looking page would only be the board talking to itself.",
    "这里是会员之间说话的地方。等有人发第一条，它就开了——在那之前没什么好看的，硬撑出来的热闹只是自说自话。",
  ],
  // The comma between two roles on the shut row. English uses its own;
  // Chinese uses the one for lists of nouns.
  "brw.qjoin":         [", ", "、"],
  "brw.qlab":          ["The waiting list", "等候名单"],
  "brw.qh":            ["{n} people want in", "{n} 个人想进来"],
  "brw.qwhy":          ["Vouch for somebody and they move up.",
                        "帮谁说句话，他就往前挪一位。"],
  "brw.qof":           ["{n} on the list. These are the ones who agreed to be shown.",
                        "名单上共 {n} 人，这些是同意公开的。"],
  "brw.qnone":         ["Nobody is waiting.", "目前没有人在等。"],
  "brw.qbrought":      ["brought {n} in", "带进来 {n} 人"],

  /* WAITING FOR YOU — the queue counted against the reader's own sentence.
     See the block above /api/queue's response.

     "{n} agents are waiting" and not "{n} people are waiting": the whole
     point of this block is that it is not the same number for everybody. The
     role words are the plurals already used on the rows underneath, so a
     member reads the same word in both places. */
  "brw.qpfor":         ["Waiting for you", "在等你"],
  "brw.qpn":           ["{n} {who} waiting", "{n} 位{who}在等"],
  /* The stronger half: they are what you are after AND you are what they are
     after. One line, because two numbers that mean different things need the
     difference said out loud. */
  "brw.qpboth":        ["{n} of them are looking for {who}", "其中 {n} 位在找{who}"],
  "brw.qpin":          ["{n} already in", "室内已有 {n} 位"],
  "brw.qpnone":        ["none in here yet", "室内还没有"],
  /* Vouching. A member saying somebody is worth letting in moves them one
     place, the same as bringing somebody in does. */
  "brw.vouch":         ["Vouch", "推荐"],
  "brw.vouched":       ["Vouched", "已推荐"],
  "brw.qvouches":      ["{n} vouched", "{n} 人推荐"],
  /* NAMED, because a name is the whole of a vouch — see /api/queue. The count
     stays for the rows with more names than fit. */
  "brw.qvby":          ["{who} vouched", "{who} 推荐了"],
  "brw.qvplus":        ["{who} +{n}", "{who} +{n}"],
  /* THE ONE SETTING, AND IT READS AS A STATE. It said "coming soon" for a
     day, next to a tick box in the profile form that had done exactly this
     since the form existed — so the tray was telling people a lie about
     their own settings. The row now names which way round they are, the line
     under it says what that costs, and the button does the other one.

     "You are in Browse" is the line that used to sit on the deck itself.
     This is where it went. */
  "set.head":          ["Your settings", "你的设置"],
  "set.incogIn":       ["You are in Browse", "你在浏览中"],
  "set.incogOut":      ["You are hidden", "你已隐藏"],
  "set.incogInWhy":    ["Everybody in here can see your card.",
                        "这里的每个人都能看到你的名片。"],
  "set.incogOutWhy":   ["Nobody sees your card. You still see theirs.",
                        "别人看不到你的名片，你仍然能看到他们的。"],
  "set.incogGo":       ["Hide me", "隐藏我"],
  "set.incogBack":     ["Show me", "显示我"],
  /* Its own string rather than a plural rule. There is one number this ever
     applies to and English is the only side that cares — Chinese counts the
     same either way, which is why the pair below is not two sentences. */
  "brw.inside1":       ["1 person is in.", "里面有 1 个人。"],
  "brw.atdoor":        ["{n} are waiting to get in.", "另有 {n} 个人在等着进来。"],
  "brw.atdoor1":       ["1 is waiting to get in.", "另有 1 个人在等着进来。"],
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
  /* ---- WHO LEFT THIS FOR YOU ---------------------------------------------
     The greeting in front of the door, when the link carried a name. Both
     names are typed by whoever made the link and neither opens anything —
     the six characters still do that. Everything here is said out loud by
     the browser's own voice as well as written down; keep it speakable, which
     mostly means short sentences and no punctuation a voice cannot hear. */
  "hi.tag":            ["Somebody left you a message", "有人给你留了句话"],
  "hi.tagFrom":        ["{who} left you a message", "{who} 给你留了句话"],
  "hi.lead":           ["Welcome", "欢迎你"],
  "hi.leadName":       ["Welcome, {who}", "欢迎你，{who}"],
  /* THE INSTRUCTION LIVES HERE, not in the heading, because the heading is
     taken by the name whenever there is one — and the tap is the whole point
     of the screen. Half a minute, and which languages, on the same line. */
  "hi.under": [
    "Tap the circle to hear your message, and ask me anything · English or 中文",
    "点一下那个圈，听听留给你的话，有问题也可以问我 · 中英文都行",
  ],
  "hi.or":             ["or", "或者"],
  "hi.accept":         ["Accept the invitation", "接受邀请"],
  "hi.note": [
    "Invite only. No account, no password, no phone number — the code is the whole of it.",
    "邀请制。没有账号，没有密码，也不要手机号——只有那串口令。",
  ],
  /* THE MESSAGE ITSELF, in four pieces so a missing name drops its own
     sentence rather than leaving a hole in the middle of a spoken line. */
  "hi.spoke":          ["Welcome.", "欢迎。"],
  "hi.spokeName":      ["Welcome, {who}.", "欢迎你，{who}。"],
  "hi.spokeFrom":      ["{who} asked me to let you in.", "{who} 让我把你放进来。"],
  "hi.spokeWhat": [
    "This is a private board for people doing business in China. Film, money, factories.",
    "这是一个给在中国做事的人用的私密板子。影视、资金、工厂。",
  ],
  "hi.spokeHow": [
    "Nothing on it is public, and nobody sees you until you have both chosen each other. Your code is the six characters they sent.",
    "上面的东西都不公开，而且要你们互相都选了对方，别人才看得到你。你的口令就是他发给你的那六位。",
  ],

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
  /* THE SHEET THE ＋ OPENS. Its own title, because inv.head sits above a code
     inside a box and this stands at the top of a screen. */
  /* THE ＋ MENU. Three things you can START, which is what a plus means.
     Setting up a profile is deliberately not one of them: the Profile tab
     does that, and after the first time it is a line that means nothing. */
  /* TWO LINES WITH THE SAME VERB, and the difference between them is the
     whole point of the second one: one is a member you matched with, the
     other is somebody you know who is not here. */
  "plus.write":        ["Message a member", "给成员发消息"],
  "plus.reach":        ["Write to somebody new", "写给还没进来的人"],

  /* ---- AND THE MEMBER'S HALF: writing one. -------------------------------
     The output is a whole block to paste, not six characters. This is the one
     place the invite's rule is deliberately broken — there the link and the
     code travel separately, so a forwarded link is not a way in. Here the
     person on the other end has no app to type a code into, and the link
     opens one note written to one person and nothing else, so it can carry
     itself. */
  "wn.mkTitle":        ["Write to somebody", "写给一个人"],
  // One line, where the first bubble will be.
  "wn.mkHint": [
    "They read it, answer it, and their answer puts them on the list.",
    "他看到、回你一句，这句回复就是他排进名单的凭据。",
  ],
  "wn.mkName":         ["Their name", "他叫什么"],
  /* NO NAME IN THE EXAMPLE. The block puts their name on the first line
     already, and an example that starts with one teaches people to write it
     twice — which is exactly what the first test of this produced: "Ray —
     Ray — this is the board I mentioned." */
  "wn.mkLine": [
    "This is the board I mentioned. Mostly film and money, crossing into China. Worth you being on it.",
    "就是我跟你说的那个板。主要是影视和资金，跟中国有来往的。你该在上面。",
  ],
  "wn.mkWhy": [
    "No WeChat id or phone number in it — the link is how they answer. It works for a day, for one person, once.",
    "里面别写微信号或电话——他就是用这个链接回你的。有效期一天，只给一个人，只能用一次。",
  ],
  /* wn.mkGo ("Make the note") is retired with the sheet it was on: making and
     sending are one press now, and the press is the send arrow in the
     messenger. */
  "wn.mkTo":           ["To", "写给"],
  /* THE PHONE'S OWN SHEET, which is how this actually reaches WeChat. The
     first version offered Copy and nothing else, and left somebody holding a
     block of text with no idea what to do with it. */
  "wn.mkShare":        ["Send it", "发出去"],
  "wn.mkDone":         ["Done", "完成"],
  "wn.mkTill":         ["Good for a day. One person, once.", "一天内有效，只给一个人，只能用一次。"],
  "wn.mkStanding": [
    "You cannot bring people to the door yet — same as an invite. Your profile page says what is left.",
    "你还不能带人到门口——和邀请码一样的条件。你的资料页上写着还差什么。",
  ],
  "wn.mkNoContact": [
    "Take out {what}. The link is how they answer you — a contact detail in the line takes it off the board before it has started.",
    "请去掉 {what}。他就是用这个链接回你的——把联系方式写进去，等于还没开始就把话题挪走了。",
  ],
  /* THE BLOCK ITSELF, ready to paste. Two rules, both from the invite script,
     which is settled: the person's name first so it is addressed, and the
     link on its own line so a phone makes it tappable. */
  "wn.mkBlock": [
    "{who} —\n\n{line}\n\nIt is invite only. Answer here and I will vouch for you:\n{url}",
    "{who}——\n\n{line}\n\n那边是邀请制。在这里回我一句，我帮你担保：\n{url}",
  ],


  /* ---------------------------------------------------------------------
     A NOTE WRITTEN TO SOMEBODY WHO IS NOT HERE YET.
     Replaces the link a member could post anywhere, which arrived with
     nothing on it. Named wn.* and not wr.*, which is already the waiting
     room three hundred lines down.
     The voice is the invite's: a person wrote to a person. "You have been
     invited" is a system talking; "Tom wrote to you" is not.
     --------------------------------------------------------------------- */
  "wn.title":          ["A note for you", "有人写给你"],
  "wn.wrote":          ["{who} wrote to you", "{who} 写给你"],
  "wn.onThe":          ["on The Exchange", "在 The Exchange 上"],
  "wn.answerHead":     ["Write back", "回他一句"],
  "wn.answerLede": [
    "Your answer goes to {who} and puts you on the list. Say who you are and what you are after — that is what somebody reads when they decide.",
    "你的回复会发给 {who}，同时把你放进等候名单。说说你是谁、在找什么——别人就是看这个来决定的。",
  ],
  "wn.yourName":       ["Your name", "你的名字"],
  "wn.yourReply":      ["Your answer", "你的回复"],
  "wn.replyPh": [
    "Performer, Sydney, free from March. Two features and a series.",
    "演员，悉尼，三月后有档期。两部电影、一部剧集。",
  ],
  "wn.send":           ["Send it", "发送"],
  "wn.sending":        ["Sending…", "发送中…"],
  /* THIS IS A QUEUE AND NOT A DOOR, said before they write rather than after.
     Somebody who answers expecting to be let straight in and finds a waiting
     list has been misled by leaving it out. */
  /* NO MARKUP IN IT. It went out with a literal <b> in the text, because the
     page sets this with textContent — which is the right way to put words on
     a screen and the wrong place to put tags. */
  "wn.next": [
    "Invite only. Answering puts you on the list — you are in when a member vouches for you, and {who} is the one who wrote, so that is usually them.",
    "这里是邀请制。回复只是把你放进名单——要有成员为你担保才算进来；写给你的是 {who}，通常也就是他。",
  ],
  "wn.doneHead":       ["Sent", "已发送"],
  "wn.doneBody": [
    "{who} has your answer. You are on the list until somebody vouches for you.",
    "{who} 收到了你的回复。在有人为你担保之前，你先在名单上等着。",
  ],
  "wn.doneGo":         ["See where you are", "看看排到哪了"],
  "wn.spentHead":      ["Already answered", "已经回过了"],
  "wn.spentBody": [
    "This note was written for one person and has been answered. Ask whoever sent it for another.",
    "这张便条只给一个人，而且已经回过了。找发给你的人再要一张。",
  ],
  "wn.oldHead":        ["This has run out", "这个已经过期了"],
  "wn.oldBody": [
    "A note is good for a day. Ask whoever sent it for another.",
    "便条只在一天内有效。找发给你的人再要一张。",
  ],
  "wn.badCode":        ["That link does not work", "这个链接用不了"],
  "wn.badBody": [
    "Check it came through whole — the address may have been cut in half on its way to you.",
    "看看链接是不是完整——转发的时候有时候会被截断。",
  ],

  /* NOT me.runGo, which is "Add someone" — right under a box headed "Someone
     else · put up a profile for somebody you represent", and vague standing
     on its own between two other lines that each name who they are about. */
  "plus.run":          ["Put somebody up", "帮别人建主页"],
  /* ---- ANNOUNCEMENTS ------------------------------------------------------
     A poster written to leave this board. Everything else in this file is
     said to somebody who is already here or standing at the door; half of
     these are read in a WeChat group by people who have never heard of any of
     it, which is why the Chinese is short and says what the thing is rather
     than what it is called. */
  "plus.ann":          ["Announce somebody", "发一条消息"],
  "ann.head":          ["Announce somebody", "发一条消息"],
  /* WHAT IT IS FOR, said before the first field, because the thing that makes
     this different from every other box on the board is where it ends up. */
  "ann.why": [
    "A page to paste into a WeChat group. A picture, a line, and the waiting list at the bottom.",
    "做一张可以发到微信群里的页面：一张图、一句话，底下是候补名单。",
  ],
  "ann.title":         ["The headline", "标题"],
  "ann.titleHint":     ["Damon Russell just joined", "比如：Damon Russell 加入了"],
  "ann.body":          ["The rest of it", "正文"],
  "ann.bodyHint": [
    "Who they are, and what they are here to do. A few lines.",
    "他是谁，来这儿想做什么。几句话就行。",
  ],
  "ann.photo":         ["Add a picture", "加一张图"],
  "ann.photoAgain":    ["Change the picture", "换一张图"],
  /* SAID, NOT ENFORCED. The server takes one without a picture: whoever runs
     the board is allowed to post news about somebody whose photograph they do
     not have. But a link with no picture arrives in a group chat as a grey
     box, and that is worth knowing before rather than after. */
  "ann.photoWhy": [
    "Without one, the link shows up in WeChat as a grey box.",
    "没有图的话，链接发到微信里就是一个灰框。",
  ],
  /* THE OTHER LANGUAGE. Offered rather than done: the button writes a draft
     into fields that stay editable, and the line under it says to read it.
     "Write it in Chinese" rather than "Translate" — what is being made is a
     second poster, which he then owns, not a machine's rendering he is asked
     to trust. */
  /* THE MIC. On the composer's four fields. Not a feature of the board so
     much as a way of filling a box, which is why the labels say what the
     button does to THIS field rather than announcing dictation. */
  /* ---- THE BUTLER ---------------------------------------------------------
     The waiting room asks a stranger for one sentence in a vocabulary of
     thirteen words nobody has been shown, and that sentence is the whole
     board. He is the translator between what somebody says about themselves
     and the word the matcher needs.

     NOT "AI assistant" ANYWHERE. Two reasons, and the first is about who these
     people are: somebody who has been told a machine is handling them
     answers a machine. The second is that the words carry a promise — an
     assistant does things for you, and this one does exactly one thing and
     then hands it back for a person to agree to. "The doorman" is what he
     actually is: he stands at the door, he knows how the place works, and he
     writes nothing down. */
  /* ---- THE WELCOME --------------------------------------------------------
     THE SAME JOB THE INVITE DOES. Ray's invite works because it says his name
     out loud and then one thing. This page opened on "You are on the list." —
     true, and it starts in the middle of a conversation nobody has had. A
     person who has just tapped a link from a chat does not know where they
     are, and the first thing a room does with somebody who has just walked in
     is use their name.

     PLAYED, NOT JUST READ, for the same reason the doorman speaks: half these
     people are reading their second language on a phone. The spoken version
     is WRITTEN SEPARATELY below — the same words read aloud are too clipped
     for the ear, and a sentence written to be heard is a different sentence. */
  "wel.hi":            ["Welcome, {who}", "欢迎你，{who}"],
  "wel.play":          ["Hear this", "听一下"],
  "wel.stop":          ["Stop", "停"],
  /* SPOKEN, AND IT IS THE FIRST THING ANYBODY HEARS FROM THIS PLACE.
   *
   * The first draft was correct and dorky: "fill in your page: a photograph,
   * and one line saying what you are and what you are looking for". That is
   * instructions. Somebody working the door of a place worth getting into
   * does not read you the instructions, he tells you how it goes — dry, sure
   * of himself, and shorter than you expected.
   *
   * "Blank cards stay outside" does the same job as two sentences of
   * explanation and is the line somebody repeats to a friend. Card, not page:
   * the board already calls it a card everywhere else, and a card is a thing
   * rather than a screen. */
  "wel.sayList": [
    "Welcome, {who}. {t} of you at the door tonight, and you're number {n}. Get a face on your card and one line about what you do and who you want. That's what moves people up. Blank cards stay outside.",
    "欢迎你，{who}。今晚门口 {t} 个人，你排第 {n}。放张照片，再用一句话说清楚你做什么、想找谁——就靠这个往前挪。卡片空着的，一直在门外。",
  ],
  "wel.sayUp": [
    "{who}, you're through the first door. Three came off the list this week and you're one of them. Have a look around — nothing works yet, that's the deal. Get a face and a line on your card and somebody inside takes a look. Three days.",
    "{who}，第一道门过了。这周就提上来三个人，你是一个。先随便看看——什么都还点不动，就是这样。照片和那句话填上，里面就有人来看。三天。",
  ],

  /* ---- WHO HE IS ----------------------------------------------------------
   *
   * HE IS BRANDING, not a feature. He is the first thing anybody meets here,
   * he is the only voice in the product that is a person, and he is the same
   * one at every door — so he gets a name, a face and a temperament, and all
   * three stay put.
   *
   * MO, AND 老莫 IN CHINESE. One syllable, holds in both mouths, and 莫 is a
   * real surname — 老莫 is exactly what you call the man who has been on the
   * door of your building for fifteen years. Warm without being cute, and it
   * does not claim to be one of the members: "Wei" or "Anna" would read as a
   * person on the board, and somebody would eventually ask which one.
   *
   * "On the door" rather than a title. He is not Head of Member Onboarding.
   */
  "but.name":          ["Mo", "老莫"],
  "but.sub":           ["on the door", "看门的"],
  /* ---- THE FIRST THING HE SAYS ---------------------------------------------
   *
   * IT IS THE INVITE'S JOB, NOT A CHATBOT'S. The invite works — see the note
   * in CLAUDE.md about why it is settled — because it is NAMED, carries one
   * true number, and asks for one thing. "Ray — this is the board I
   * mentioned", a visible clock, six characters. It never explains itself.
   *
   * What was here first was "What do you do? Tell me the way you would tell
   * somebody at a party", sitting under a card that asked "Not sure what to
   * put?". That is a feature introducing itself to somebody who has not been
   * greeted yet, and the question it opens with is a form field with a friendly
   * voice on it.
   *
   * So he knows who she is and says so, and the fact he leads with is the one
   * that makes the place worth being in: she was picked, and most people were
   * not. Then one short question. Two bubbles, said before anything is sent
   * anywhere — these are strings on this page, so the conversation costs
   * nothing until somebody answers it.
   */
  /* HE IS THE ONE THING ON THIS SCREEN THAT IS A PERSON, AND HE HAS TO SOUND
     LIKE ONE. The board's own voice does not use contractions anywhere —
     "You are on the list", "Nothing works for you yet" — which is right for
     the house and wrong in a chat bubble. Written out in full, the doorman
     read like a form with a friendly font, which is exactly what he is there
     not to be. So: he contracts and the board does not, and that difference
     is the whole of his voice. */
  "but.hookUp": [
    "{who} — you're one of three off the list this week. {n} aren't.",
    "{who}——这周就提上来三个，你是一个。另外 {n} 个还在等。",
  ],
  /* Somebody who has not been moved up yet and opened this anyway. The
     scarcity line above would be a lie to them, and the true thing is better
     anyway: the page is what decides the order. */
  /* NO NUMBER IN THIS ONE. The welcome directly above it already says where
     they stand, and hearing it twice in two inches reads as a page that is
     not listening to itself. What is left is the half the welcome does not
     carry: what moves them. */
  /* "Finished pages get moved up first" is a rule being read out. The people
     who get moved up are people, and saying so is the same fact with
     somebody in it. */
  "but.hookList": [
    "{who} — nobody moves up off a blank card. Yours is blank.",
    "{who}——空卡片是挪不动的。你的还空着。",
  ],
  /* "What do you do?" on its own reads as a job interview. The "actually" is
     what makes it somebody asking rather than a field label, and it was cut
     once for brevity and had to come back. */
  "but.ask": [
    "Two things and you're done. So what do you actually do?",
    "就两样，填完就行。你是做什么的？",
  ],
  /* Closed, and gettable back. Not a pitch for a feature — his name and the
     one thing he is for. */
  "but.shut":          ["Ask Mo", "问问老莫"],
  /* THE KILL SWITCH, AND IT IS A REAL ONE.
   *
   * Plenty of people do not want to be talked to by a machine, and a board
   * whose whole pitch is that a person decides is the worst possible place to
   * insist otherwise. Closing him stays closed — across reloads, across
   * sessions, until they ask for him back.
   *
   * Said plainly on the way out rather than as a silent dismissal, because
   * somebody who shut it by accident needs to know there is a way back, and
   * somebody who shut it on purpose is owed the confirmation. */
  "but.gone": [
    "Mo is off. The fields below work the same.",
    "老莫关掉了。下面的格子照常填。",
  ],
  "but.back":          ["Bring him back", "让他回来"],
  /* SAID LITERALLY, because the people this is for are the people who would
     not believe a euphemism. "Not for me" is a preference; this names the
     thing they object to and offers to remove it. A board whose whole pitch
     is that a person decides cannot also be the board that insists a machine
     talks to you first. */
  "but.no":            ["Don't like AI? Send him away", "不喜欢 AI？让他走"],
  "but.ph":            ["Type, or hold the mic", "打字，或者按住话筒"],
  "but.send":          ["Send", "发送"],
  "but.thinking":      ["…", "…"],
  "but.hear":          ["Hear it", "听一遍"],
  /* WHAT HE IS PROPOSING, and the button says what pressing it does to the
     card rather than "OK" — this is the one moment in the conversation where
     something gets written down. */
  "but.keep":          ["Put this on my card", "就用这个"],
  "but.redo":          ["Not quite", "不太对"],
  "but.slow": [
    "Give him a moment — a lot has been asked at once.",
    "等一下——一下子问得太多了。",
  ],
  "but.off": [
    "He is not answering. The fields below still work.",
    "他没回应。下面的格子照样能填。",
  ],

  "mic.go":            ["Say it instead", "用说的"],
  "mic.stop":          ["Stop", "停"],
  "mic.no": [
    "The microphone is switched off for this page. Your browser's settings can turn it back on.",
    "这个页面的麦克风被关掉了，可以在浏览器设置里重新打开。",
  ],
  /* SAID ONCE AND THEN THE BUTTON GOES. Chrome's recogniser is Google's and
     Google is not reachable from the mainland, so this is not a thing to try
     again — the keyboard's own dictation key still works and is on every
     phone. */
  "mic.off": [
    "Speaking did not work here. Your phone keyboard's own mic still does.",
    "这里用不了语音输入。手机键盘上自带的那个话筒还是能用的。",
  ],
  "ann.tr":            ["Write it in Chinese too", "再写一版中文"],
  "ann.trWhy": [
    "A draft. Read it before you post — this goes out under your name, about somebody with a name.",
    "这是草稿。发出去之前先看一遍——这是用你的名义发的，说的也是一个有名有姓的人。",
  ],
  "ann.post":          ["Post it", "发布"],
  "ann.posting":       ["…", "…"],
  "ann.made":          ["It is up.", "已经发布了。"],
  "ann.madeWhy": [
    "Copy the link and paste it into the group. Anybody can open it.",
    "复制链接发到群里。谁都能打开。",
  ],
  "ann.copy":          ["Copy the link", "复制链接"],
  "ann.copied":        ["Copied", "已复制"],
  "ann.mine":          ["What you have put up", "你发过的"],
  "ann.none":          ["Nothing yet.", "还没有。"],
  /* TWO NUMBERS AND ONLY THE SECOND ONE MEANS ANYTHING. See the note on
     /api/announce in server.js: a poster opened four hundred times that
     brought nobody was the wrong poster, and the first number alone reads as
     a triumph. */
  "ann.seen":          ["{n} opened it", "{n} 人打开过"],
  "ann.joined":        ["{n} put their name down", "{n} 人留了名字"],
  "ann.rm":            ["Take it down", "撤下"],
  "ann.rmSure": [
    "Take it down? The link keeps working and says it is gone.",
    "撤下这条？链接还能打开，但会显示已经撤下了。",
  ],
  "ann.gone":          ["This has been taken down.", "这条已经撤下了。"],
  "ann.goneWhy": [
    "The board is still here. You can still put your name down.",
    "板子还在。你还是可以留个名字。",
  ],
  "ann.bad":           ["That did not go up. Try again.", "没发出去，再试一次。"],
  "ann.need":          ["It needs a headline.", "得有个标题。"],
  /* ON THE POSTER ITSELF, above the form. Not "Join the waiting list" as a
     heading — the button says that. This is the question somebody in a group
     chat is actually answering, which is whether this has anything to do with
     them. */
  "ann.ask":           ["Want in?", "想进来吗？"],
  "ann.sub": [
    "A private board for people doing business across a border. Put your name down — somebody already inside decides.",
    "一个做跨境生意的人的私密板子。留个名字——由里面的人来决定。",
  ],

  "inv.sheetTitle":    ["Bring somebody in", "带一个人进来"],
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
  /* AN ALLOWANCE, which most members do not have — see BOARD_CODES in the
     server. Said as codes in hand rather than as a rank: nobody needs to know
     who is on the list, least of all the people who are not. */
  "inv.also":          ["Also yours today: {codes}", "今天你手上还有：{codes}"],
  "inv.more":          ["Get another code ({n} left today)", "再要一个口令（今天还剩 {n} 个）"],
  "inv.moreNo":        ["That is all for today.", "今天就到这儿了。"],
  /* The share link, which is not the code. Said as the thing it does — it
     puts people in the queue — because a member who thinks this lets somebody
     straight in will send it to the wrong person. */
  "inv.share":         ["Share a link with friends", "把链接分享给朋友"],
  "inv.shareSay": [
    "I am on The Exchange — a private board for people doing business in China. It is invite only, but you can put your name down here and I will vouch for you: {url}",
    "我在 The Exchange——一个给在中国做事的人用的私密板子。目前是邀请制，你可以先在这里留个名，我来给你说话：{url}",
  ],

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
  /* The sentence, which is what the matching reads. It replaced "pick your
     rooms" — rooms are derived from what somebody says now. */
  "todo.say":          ["Say what you are looking for.", "写清楚你在找什么。"],
  "todo.goal":         ["Write a short bio.", "写一段简短介绍。"],
  /* The row that stops somebody losing everything they are about to write.
     Worded as the thing it buys rather than the thing it asks for: "Add an
     email address" is a chore, "so you can get back in" is a reason. */
  "todo.mail":         ["Add a way back in, for a new phone.",
                        "留个回来的方式，换手机能用。"],
  "todo.level":        ["Take the level test.", "做一下水平测试。"],
  "todo.card":         ["Answer today’s card.", "答一下今天的卡片。"],
  "todo.post":         ["Post something.", "发一条内容。"],
  "todo.week":         ["Post 2 things this week.", "这周发 2 条内容。"],

  "inv.needHead":      ["How to invite someone", "怎么邀请别人进来"],
  "inv.needWhy": [
    "Whoever you bring in has your name on them. So first:",
    "你带进来的人，是挂着你的名字进来的。所以先做到：",
  ],
  /* The same block, for a member who has a page and therefore already has the
     link above it. The link and the code are not the same favour: the link
     puts somebody in the queue, the code walks them through the door. This
     line says which of the two is still to be earned. */
  "inv.needWhyLink": [
    "The link above puts people in the queue — send it to anybody. A code lets one person straight in on your word, and that one you earn:",
    "上面这个链接是把人放进排队名单，谁都可以发。而邀请码是凭你一句话直接让人进来，这个要先做到：",
  ],
  "inv.needFace": [
    "Be in Browse — add a photo, turn the switch on.",
    "出现在名单里——加一张照片，把开关打开。",
  ],
  "inv.needDays":      ["Be here a day.", "在这里待满一天。"],
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
    "This is the board I mentioned — The Exchange. It is private: nobody can open it without a password, and mine changes every day. Here is today's, good for one person.\n\n{url}\n\nPassword: {code}\n\nOpen it in Safari, not in here — tap ··· at the top right, then Open in Browser. WeChat's browser forgets you.",
    "就是我说的那个板子，交换。那里是私密的，没有口令谁也打不开，我的口令每天还会换。这是今天的，只能进一个人。\n\n{url}\n\n口令：{code}\n\n别在微信里打开——点右上角的 ···，选「在浏览器打开」。微信的浏览器记不住你。"],
  "inv.shared": [
    "This is the board I mentioned — The Exchange. It is private: nobody can open it without a password, and mine changes every day. Here is today's, good for one person.\n\n{url}\n\nPassword: {code}",
    "就是我说的那个板子，交换。那里是私密的，没有口令谁也打不开，我的口令每天还会换。这是今天的，只能进一个人。\n\n{url}\n\n口令：{code}"],
  /* THE STRIP ACROSS THE TOP, and it had the same daily-password fiction in
     it as the tagline. A code is one person's, once. */
  "inv.locked":        ["Private — nothing here opens without an invitation.",
                        "私密——没有邀请，这里什么都打不开。"],
  /* The two lines the board says about itself change with the door. "Anyone
     can read" is true with the door open and a plain lie with it shut. */
  /* WHAT THE DOOR ACTUALLY DOES NOW. It said one password each, changing
     every day — which described a shared password on a rota. A code lets one
     person in once and is spent; a member gets a fresh one to give away each
     day. Two different facts, and the old line ran them together. */
  "inv.taglineShut":   ["Invite only. A member has to bring you.",
                        "邀请制。得有成员带你进来。"],
  "inv.countShut":     ["{n} posts up. Invite only.", "已发布 {n} 条。邀请制。"],
  /* The line under the name, for somebody already inside. It counted posts —
     see the note where it is set. */
  "board.inRoom":      ["{n} people in the room. Invite only.",
                        "房间里有 {n} 个人。邀请制。"],
  "inv.one":           ["One person each, and a new one tomorrow.",
                        "一个口令进一个人，明天再给你一个新的。"],
  "door.sub":          ["Not open to everybody yet", "还没有对所有人开放"],
  /* THE DOOR, IN THE WORDS OF WHAT IT ACTUALLY DOES. It said "their password
     changes tomorrow", which describes a shared password on a rota. What is
     true: the code is one person's, it is spent the moment it is used, and
     the member who gave it away gets another one to give tomorrow. The third
     sentence is the one that matters — a link on its own opens nothing — so
     it stays. */
  "door.say":          ["This board is private \u2014 nothing on it can be read without a code. Type the one your friend sent: it lets one person in, once, on this browser. The link on its own opens nothing.",
                        "这个板子是私密的——没有口令，里面什么都看不到。输入朋友发给你的那串：只能进一个人，只能用一次，只在这个浏览器上。光有链接是打不开的。"],
  "door.zh":           ["", ""],
  "door.go":           ["Go in", "进去"],
  "door.going":        ["Opening\u2026", "正在开门\u2026"],
  /* The way out of the door for somebody who has no code. Phrased as the thing
     they would say, not as a feature: nobody arrives thinking "I would like to
     join a waiting list". */
  /* /join — the link for a group. One screen, one thing on it. */
  "join.tab":          ["交换 · The Exchange — ask to join", "交换 · 申请加入"],
  "join.lede": [
    "Ask to join The Exchange.",
    "申请加入交换。"],
  "join.sub": [
    "A private board for people connecting in China, and with China. Put your name down and somebody already inside decides. Your WeChat or email is shown to nobody.",
    "一个私密板子，给在中国、和跟中国打交道的人。留个名字，由已经在里面的人来定。你的微信或邮箱谁都看不到。"],
  "join.has":          ["Already have a password?", "已经有口令了？"],

  /* /agents — one page for one WeChat group of film agents. Its own keys
     rather than words baked into the page, because the group is Chinese and
     the 中文 button has to move the whole page, not just the form. The Chinese
     is written rather than translated: 「活儿」is what the work is called in
     that room, and a question about it lands where a description does not. */
  "ag.tab":            ["The Exchange — for agents", "交换 · 给经纪人"],
  "ag.head": [
    "Only limited spots available.",
    "名额有限。"],
  "ag.p1": [
    "You will never know. That is what I built this for.",
    "你永远不会知道。我做这个，就是为了这件事。"],
  "ag.p2": [
    "Agents in front of artists and directors — not just China. I have worked with Oscar-winning directors in Hollywood and with top agents around the world.",
    "让经纪人直接对上艺人和导演——不只是国内。我跟好莱坞拿过奥斯卡的导演合作过，也跟国际上顶尖的经纪人打过交道。"],
  "ag.say1":           ["I am", "我是"],
  "ag.say2":           ["an Agent", "经纪人"],
  "ag.say3":           ["looking for", "我在找"],
  "ag.say4":           ["a Producer", "制片人"],
  "ag.after": [
    "Somebody writes the other half. You are put in front of each other.",
    "有人写了另一半，你们就直接对上了。"],
  "ag.ruleA":          ["Nobody gets your WeChat until you both say yes.",
                        "双方都点了头，微信才互相可见。"],
  "ag.ruleB":          ["Invite only, and every name is read by a person.",
                        "邀请制，每个名字都有人亲自看。"],
  "ag.ask":            ["I am looking for agents to work with.",
                        "我在找可以合作的经纪人。"],
  "ag.shot1":          ["A person on the board, with the line they wrote",
                        "板子上的一个人，和他写的那句话"],
  "ag.shot2":          ["The two pills that set your own line",
                        "设置你自己那句话的两个选项"],
  "join.hasGo":        ["Use it", "去输入"],
  /* THE DECK'S OWN WORD FOR IT. The buddies list keeps "Follow", where it is
     true: that is a list of people you are reading. On a stranger's face the
     same row means something else — two people agreeing to be introduced — and
     "follow" puts whoever presses it one step below the person they pressed
     it on. */
  /* On the card the sentence is prose, so the article goes with the role —
     see the note where this is used. say.iam keeps its "a" for the form. */
  "brw.iam":           ["I am", "我是"],
  /* The sentences that did not fit. A count, not more pills — see the note
     where the card draws it. */
  "brw.sayMore":       ["+{n} more", "还有 {n} 条"],
  /* FOLLOW, NOT CONNECT. This button is one-sided and costs nothing — it says
     you are interested and waits to see whether they say it back. Connect is
     the other press, on the Cards shelf, where contact details actually
     change hands. Two acts cannot share one word, and this is the smaller
     one, so it takes the smaller word. */
  "brw.connect":       ["Follow", "关注"],
  "brw.connected":     ["Following", "已关注"],
  /* THE QUEUE, ON THE DOOR. The one number that argues for this place to
     somebody who has never heard of it, and it was being fetched and thrown
     away. Not "only N spots left" and not a percentage — a count of real
     people who asked, which is what it is and all it needs to be.
     The English needs the plural; the Chinese does not, which is why the two
     are shaped differently rather than one being a translation of the other. */
  "door.queue": [
    "{n} people are waiting to get in.",
    "已经有 {n} 个人在排队等着进来。",
  ],
  "door.noCode":       ["I do not have one — put me on the list",
                        "我没有口令——把我加到名单里"],
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
  /* RUN OUT IS NOT WRONG. Somebody holding an expired code typed the right
     thing, and telling them it did not match sends them hunting for a typo
     that is not there. What they need is to go back and ask. */
  /* The ticking clock on the door — see enter.html. Two words and a number,
     because the number is the whole of it. */
  "door.clockLab":     ["This code stops working in", "这个口令还有"],
  "door.clockGone":    ["run out", "已过期"],
  "door.over": [
    "That code has run out. It was set to work for a while and the while is up — ask whoever sent it for a new one, it takes them a second.",
    "这个口令过期了。当初就设了时限，现在到了——找给你口令的人再要一个，他那边一秒钟的事。"],
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
  /* IT SAID THE KEY WAS THE ONLY WAY BACK, which was true when it was written
     and is not now. Somebody reading this is thirty seconds old here, and the
     first thing this board asks them to do should be the thing most of them
     will actually do. The key is a line down. */
  "door.inNote":       ["Before you close this, leave an address \u2014 the first thing on Browse. There are no accounts here, so without one, a new phone loses everything you write.",
                        "关掉之前先留个邮箱——「看看」里第一条就是。这里没有账号，不留的话，换了手机你写的东西就都没了。"],
  /* THE ONE REFUSAL A WAY-BACK CODE CAN MEET. It is not a wrong code and
     saying "wrong code" would send somebody hunting for a better one. The
     browser already has a person on it — a shared phone, nearly always. */
  "door.backTaken": [
    "This browser already has somebody's page on it. Open the link on your own phone, or in a private window.",
    "这个浏览器上已经有一个人的主页了。请在你自己的手机上打开，或者用无痕窗口。"],
  "door.inKey":        ["Or save your key: Profile \u2192 Show my key.",
                        "或者把钥匙存下来：「我的」→「显示我的钥匙」。"],
  /* THE TRAY. Everything addressed to this person, in one place — follows and
     the card of the day. The report card below it is what they are; this is
     what has arrived. */
  "notif.title":       ["For you", "给你的"],
  /* WHAT ACTUALLY ARRIVES HERE. It promised follows and "your card of the
     day" — the second belongs to the half of this app that is switched off,
     and the first is called something else now. */
  "notif.none":        ["Nothing new. Connections and offers arrive here.",
                        "暂时没有新的。有人跟你建立联系、给你发邀约，都会到这儿来。"],
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
  "me.ig":             ["@yourname", "@你的名字"],
  "me.igWhy":          ["Anybody who opens your page can see it.",
                        "打开你主页的人都能看到。"],
  "me.igName":         ["Instagram", "Instagram"],
  /* LINKEDIN. The reason to have it is the reason this board stopped calling
     itself the students board: the thing a business contact looks up before
     answering is not a grid of photographs. The warning is stronger than
     Instagram's because a LinkedIn is a real name and an employer. */
  /* THE LABEL SAYS WHAT IT IS; the box shows what goes in it. A placeholder
     is a label that disappears the moment somebody starts typing, which is
     when they are most likely to want to check what the box was for. */
  /* ---- ASK THE PROFESSOR --------------------------------------------------
   *
   * Written once, by a person, in both languages — see the note above the
   * panel in index.html for why these are not generated.
   *
   * EVERY ANSWER HERE IS A CLAIM ABOUT WHAT THE CODE DOES, and half of them
   * are claims about who can see what. If one of them stops being true the
   * answer is wrong in the most damaging way this app can be wrong, so each
   * one names the thing it depends on: matching is roomsMatch + follows both
   * ways, contact is grants, hiding is local, the key is the device line.
   * Change any of those and change these with them.
   */
  /* IT IS A HELP LIST, AND IT SAYS SO. "Ask the Professor" is the study half's
     character, and the questions under it are "How do I change my page?" —
     a member of a board of agents and producers reading that heading has to
     work out who the Professor is before they can ask him where their
     LinkedIn goes. */
  "ask.head":          ["Questions", "常见问题"],

  /* The rest of them, folded. The count is in it because "More" alone does
     not say whether that is two more or twenty, and somebody deciding whether
     to tap wants to know which. */
  "ask.more":          ["{n} more questions", "还有 {n} 个问题"],
  "ask.q.linkedin":    ["Where do I put my LinkedIn?", "我的领英填在哪儿？"],
  "ask.a.linkedin": [
    "On your page, under Where else you are. Paste the whole linkedin.com/in/ link or just the last part of it — either works. It shows on your page as a link anybody who opens the page can tap, so put it there only if you are happy for it to be seen.",
    "在你的主页里，「你还在哪儿」那一栏。整条 linkedin.com/in/ 链接粘进去，或者只填最后那一段，都行。它会以链接的形式出现在你的主页上，任何打开你主页的人都能点——所以你得愿意让人看到才填。",
  ],
  "ask.go.linkedin":   ["Open my page", "打开我的主页"],

  "ask.q.edit":        ["How do I change my page?", "怎么改我的主页？"],
  "ask.a.edit": [
    "Profile, then Edit your page. Anything still missing shows on your own page as a row you can tap — a bio, a photo, your LinkedIn — and those rows disappear once you fill them. Nobody else sees them.",
    "点 Profile，再点「编辑主页」。还没填的东西会在你自己的主页上列出来，点一下就能去填——介绍、照片、领英；填完就不见了。别人看不到这几行。",
  ],
  "ask.go.edit":       ["Open my page", "打开我的主页"],

  "ask.q.seen":        ["Who can see my page?", "谁能看到我的主页？"],
  "ask.a.seen": [
    "Anybody who is through the door. That is what the board is — a small room where everybody was brought in by somebody. What they see is exactly what you typed: your name, your photo, your bio, your rooms, and the links you added. There is no phone number, no email and no WeChat on it, ever. Nobody can see who has looked at your page, and that includes you.",
    "所有进了门的人。这个板子就是这么回事——一个小房间，每个人都是别人带进来的。他们看到的就是你填的那些：名字、照片、介绍、房间，还有你自己加的链接。上面永远不会有手机号、邮箱或微信。谁看过你的主页，没人查得到——包括你自己。",
  ],

  "ask.q.match":       ["What is a match?", "什么算配上了？"],
  "ask.a.match": [
    "Three things at once. You each followed the other; you are each in the half of the world the other asked for; and your rooms answer each other — buying answers selling, raising answers investing, looking for work answers hiring. Two people both selling are not a pair. Following somebody on its own does nothing until they follow you back.",
    "三件事同时成立。你们互相都关注了对方；各自都在对方要找的那一半世界里；而且你们的房间是互相对上的——采购对供货，融资对投资，找工作对招人。两个都在供货的人不算一对。你单方面关注没有用，得等对方也关注你。",
  ],

  "ask.q.talk":        ["Why can I not message somebody?", "为什么我没法给人发消息？"],
  "ask.a.talk": [
    "A private thread opens when you match, and not before. Until then you can send one introduction a day, to anybody — that is the limit, and it is the reason nobody here gets a hundred messages in a week. If somebody leaves a thread it stays closed, and following them again does not reopen it.",
    "配上之后才会开一条私聊，在那之前不会。在那之前你每天可以给任何人发一条自我介绍——就这个上限，也正是这里没人一周收到一百条消息的原因。如果对方退出了某条私聊，它就一直关着，你再关注一次也不会重开。",
  ],

  "ask.q.invite":      ["How do I invite somebody?", "我怎么邀请别人？"],
  "ask.a.invite": [
    "Two ways, and they are different. Your code lets one person straight in, so send it to somebody you would vouch for by name. The link under it can go anywhere — whoever follows it joins the waiting list instead, and whoever runs the board decides. Post the link; hand over the code.",
    "两种方式，性质不一样。你的口令直接放一个人进来，所以只发给你愿意点名担保的人。下面那条链接可以随便发——点进来的人是进候补名单，由管板子的人来决定。链接可以公开发；口令要亲手给。",
  ],

  "ask.q.wait":        ["I have no code. Why?", "我没有口令，为什么？"],
  "ask.a.wait": [
    "A code is earned rather than issued, and the box in this tray says which of the tests you have not passed yet. Roughly: finish your page, put something up, and let the people you already brought in settle. It is not a punishment — it is the only thing keeping this room worth being in.",
    "口令是挣来的，不是发的；这个抽屉里的那个框会告诉你还差哪一条。大致上是：把主页填完，发点东西，再让你已经带进来的人先待住。这不是惩罚——正是它让这个房间值得待。",
  ],

  "ask.q.wechat":      ["How do I give somebody my WeChat?", "我怎么把微信给别人？"],
  "ask.a.wechat": [
    "You hand it over, to one person, after you have matched — and you can take it back, at which point they cannot see it again. It is never on your page and it is filtered out of anything you type in public. A list of everybody here with their contact details on it is the one thing this must never become.",
    "配上之后，你把它单独交给某一个人——而且可以收回，收回之后对方就再也看不到了。它永远不会出现在你的主页上，你在公开地方打的字里也会被过滤掉。一份写着所有人联系方式的名单，是这个东西绝对不能变成的样子。",
  ],

  "ask.q.key":         ["How do I get back in on a new phone?", "换手机了怎么回来？"],
  "ask.a.key": [
    "With your key. There are no accounts here — no password, no phone number — so that one line is the whole of you. Profile, then Show my key, and save it somewhere now rather than on the day you need it. Without it a new phone is a new person.",
    "用你的钥匙。这里没有账号——没有密码，也没有手机号——所以那一行就是你本人。点 Profile，再点「显示我的钥匙」，现在就存起来，别等到要用的那天。没有它，换了手机你就是另一个人了。",
  ],

  "ask.q.hide":        ["How do I stop seeing somebody?", "怎么不再看到某个人？"],
  "ask.a.hide": [
    "Hide them, and they are gone from your feed on this phone. It is on your phone only — they are not told, nothing happens to them, and clearing your browsing data forgets it. If somebody should not be here at all, report them instead: a person reads every report.",
    "把他隐藏掉，他就从你这台手机上的动态里消失了。这只在你这台手机上生效——不会通知对方，对方那边什么也不会发生，清了浏览数据就忘了。如果你觉得某个人根本不该在这儿，那就举报：每一条举报都有人看。",
  ],

  "me.linksHead":      ["Where else you are", "你还在哪儿"],
  /* THE HOLES IN YOUR OWN PAGE, named as the thing that fills them. "Edit" is
     what a developer calls the button; two of the first three members read it
     and still asked where their LinkedIn went. */
  "me.editWhat":       ["Edit your page", "编辑主页"],
  "me.addBio":         ["Add a short bio →", "写一段简短介绍 →"],
  "me.addLi":          ["Add your LinkedIn →", "填上你的领英 →"],
  "me.gapPhoto":       ["Add a photo →", "加一张照片 →"],
  "me.liLab":          ["LinkedIn — optional", "领英——选填"],
  "me.igLab":          ["Instagram — optional", "Instagram——选填"],
  "me.goalLab":        ["A short bio", "简短介绍"],
  "me.campusLab":      ["University", "学校"],
  "me.li":             ["linkedin.com/in/your-name", "linkedin.com/in/你的名字"],
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
  /* On the shared card, which is read by people who have never opened the
     app. A heading so they know what they are looking at before they read a
     word of it, and the number of questions because four is the honest claim
     and any card implying more is lying about its own precision. */
  "lvl.cardHead":      ["Test result", "测试结果"],
  "lvl.cardSubZh":     ["Chinese · four questions", "中文 · 四道题"],
  "lvl.cardSubEn":     ["English · four questions", "英文 · 四道题"],
  "lvl.cardLevel":     ["Level", "等级"],
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
  /* The fourth state of that row — see drawMine. Worded as what is lost
     rather than what is asked for: "add an email address" is a chore, and
     "this page is gone" is the reason anybody would. */
  "brw.mineBack":      ["Add a way back in", "留个回来的方式"],
  "brw.mineBackWhy": [
    "Change phone and this page is gone. An address brings it back.",
    "换了手机，这个主页就没了。留个邮箱，随时找得回来。",
  ],
  /* "You are in Browse" was here, on the row above the deck, and is gone: a
     person whose face is up and whose switch is on has nothing to do, and a
     row saying so on every visit is the app talking about itself. The fact is
     in the settings row now — see set.incogIn. */
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
  /* Beside it, and worded for somebody who does not know the word "key": the
     question is whether they have been here, not what they are holding. */
  "tut.back":          ["Been here before?", "以前来过？"],
  "tut.backGo":        ["Sign in", "登录"],
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
  /* IT SAID "I am also at Tsinghua on Tuesdays", which is what this board was
     before it was this one. An example is doing real work in a box like this
     — it shows the length and the shape as well as the subject — so it is
     rewritten rather than removed. */
  "note.placeholder":  ["Hi — performer, Sydney, free from March. Saw you are casting. WeChat: …",
                        "你好——演员，悉尼，三月后有档期。看到你在选角。微信：…"],
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
  /* IT SAID "Carry on where you swapped", which assumed a swap. Two people
     who have used up an introduction have very often swapped nothing — and
     that line was the only thing on the screen, so it was advice to go
     somewhere that does not exist. What actually reopens this is the follow,
     both ways: see matched() in server.js. */
  "note.closed": [
    "One message each — that is the whole introduction. It opens into a real conversation once you have both followed each other.",
    "各发一条——开场白就这么多。等你们互相关注了，这里就会变成可以一直聊的对话。",
  ],
  /* AN OPEN THREAD, which only two people who matched ever have. The words
     are deliberately plainer than the introduction's: an introduction is a
     thing you compose, a conversation is a thing you are in. */
  "note.write":        ["Write", "写点什么"],
  "note.openHow": [
    "You matched, so this one stays open. Either of you can leave it at any time, and neither of you is told when the other does.",
    "你们匹配上了，所以这个对话会一直开着。任何一方随时都可以退出，退出时也不会通知对方。",
  ],
  "note.leave":        ["Leave this chat", "退出这个对话"],
  // On the button a swipe uncovers, where there is room for two words and the
  // name is already on the row it belongs to.
  "note.leaveShort":   ["Leave", "退出"],
  "note.leaveSure": [
    "Leave the chat with {who}? Neither of you can write again. {who} is not told.",
    "退出和 {who} 的对话？之后你们都不能再写了。{who} 不会收到通知。",
  ],
  "note.shut":         ["This conversation is closed.", "这个对话已经结束了。"],
  "note.needProfile":  ["Fill in your own profile first — an introduction from nobody is not one.",
                        "先填好自己的资料——没有名字的自我介绍不算自我介绍。"],
  /* An accepted offer opens a counted thread — see OFFER_LINES in server.js.
     The terms sit above the talk, and the count is said before it is spent. */
  "note.dealJob":      ["The job, agreed", "已确认的工作"],
  "note.dealProject":  ["The project, agreed", "已确认的项目"],
  "note.linesLeft":    ["{n} lines left here.", "这里还剩 {n} 条。"],
  "note.linesSpent": [
    "You have said everything this thread is for. Carry on with them directly — their card is open.",
    "这里能聊的已经聊完了。直接联系对方吧——名片已经给你了。"],
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
  /* IT STILL TALKED ABOUT STUDYING TOGETHER, which is what this board was
     before it was this one. */
  "note.noneBody": [
    "Follow somebody who follows you back and you can write to each other here. Nobody can write to you twice, and nobody can see this but you.",
    "你关注的人也关注了你，你们就能在这里互相写消息。没有人能给你连发两条，也没有人能看到这里。",
  ],
  // The other empty inbox: there IS somebody to write to, right above this.
  "note.noneYet": [
    "Nothing here yet. Pick somebody above and say the first thing.",
    "这里还是空的。在上面挑一个人，先说第一句。",
  ],

  /* ---------------------------------------------------------------------
     WHO YOU CAN WRITE TO. The inbox could only be replied to, so a person
     who opened it with nothing in it got a screen that said "no messages"
     and no way to have any. These are the people the server would already
     say yes to — nothing here is a new permission.
     --------------------------------------------------------------------- */
  /* IT SAID "YOU CAN WRITE TO", which is a permission and not a group of
     people — and permissions change, so the row emptied itself the moment
     somebody used it. These are the people you are connected to; whether you
     can write today is a fact about one of them, said under their face. */
  "note.canHead":      ["Your people", "你的人"],
  /* ---------------------------------------------------------------------
     THE LIST OF PEOPLE, AND THE CONVERSATION.
     This screen was a flat list of individual messages with four buttons
     under each — an email inbox, which is a shape nobody has to learn and
     nobody recognises either. It is a list of people now, and the talk is
     its own screen, which is the shape on every phone this is read on.
     --------------------------------------------------------------------- */
  // In front of your own last line in the list, so a row does not read as
  // something they said when it was you.
  "note.youSaid":      ["You:", "你："],
  // The one-line box in an open conversation. The long example belongs to a
  // conversation that has nothing in it yet — see drawThread.
  "note.boxPh":        ["Write a message", "写点什么"],
  // Under their name at the top of a conversation: which of the three rules
  // this one is under, said once, where somebody about to type can see it.
  "note.openSub":      ["Open — either of you can write", "开放对话——谁都可以写"],
  "note.oneSub":       ["One answer", "只能回一条"],
  // Short labels for the header. The sentence explaining each one is the
  // paragraph at the bottom of the thread — see note.closed and note.waiting.
  "note.waitSub":      ["Waiting for them", "等对方回复"],
  "note.doneSub":      ["Introduction finished", "开场白结束"],
  "note.dealOpen":     ["You agreed a piece of work", "你们谈成了一件事"],
  "note.canSub": [
    "You followed each other. Tap a face to write, or to pick up where you left off.",
    "你们互相关注了。点一下头像就能写，或者接着上次聊。",
  ],
  // An introduction is one message until they answer — see threadState.
  "note.canWait":      ["waiting", "等回复"],
  // The ＋ at the head of the strip, and what the strip says with nobody in it.
  /* ONE WORD. The tile is 4.4rem wide like every other face in the strip, so
     "Someone new" came out as "Someone…" — and a label with an ellipsis in it
     is a label that failed. Under a ＋, one word is the whole sentence. */
  "note.canNew":       ["Someone", "新的人"],
  "note.canNone": [
    "Nobody yet. Write to somebody who is not here — their answer puts them on the list.",
    "还没有人。可以写给还没进来的人——他回你一句，就排进名单了。",
  ],
  /* SOMEBODY ON THE LIST, IN THE MESSENGER. They have the conversation with
     whoever wrote to them and nothing else — so the bar says where they
     stand rather than offering three tabs that bounce off a door. */
  "note.onList":       ["You are on the list — see where you are", "你在名单上——看看排到哪了"],
  "note.canDeal":      ["deal", "已成交"],
  "note.canTo":        ["To {who}", "写给 {who}"],
  "note.canHow": [
    "Say who you are and what you want from them. One line does it — this is an introduction, not a pitch.",
    "说清楚你是谁、想找他做什么。一句话就够——这是打个招呼，不是提案。",
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
