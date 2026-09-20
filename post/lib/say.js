/* WHAT THE COMMAND SAYS, IN BOTH LANGUAGES.
 *
 * House rule: strings a person reads go in both languages. This is a terminal
 * rather than a screen, so there is no i18n.js to put them in, but the rule is
 * the rule — and the day somebody in China runs this, the output should not be
 * the one part of the product that only speaks English.
 *
 * POST_LANG=zh switches it. English is the default because Tom reads the
 * output, and he reads it with a screen reader, which is also why every line
 * here is short and starts with the thing that matters.
 */
const LINES = {
  "state.done": ["done", "已发布"],
  "state.queued": ["queued", "排队中"],
  "state.skipped": ["not posted", "未发布"],
  "state.failed": ["failed", "失败"],
  "state.already": ["already posted", "之前已发布"],

  "why.noZh": ["no Chinese caption — ZH= was not given", "没有中文文案 — 未提供 ZH="],
  "why.notBuilt": ["not built yet", "尚未接入"],
  "why.noKeys": ["not connected — see post/README.md", "未连接 — 见 post/README.md"],
  "why.onlyFilter": ["left out by ONLY=", "被 ONLY= 排除"],
  "why.relogin": ["needs a re-scan", "需要重新扫码登录"],

  "job.made": ["queued job", "已创建任务"],
  "job.none": ["nothing waiting", "没有待办任务"],
  "job.file": ["file", "文件"],
  "job.missing": ["no such file", "找不到文件"],

  "run.nothingToDo": ["nothing for this machine to do", "本机没有要做的任务"],
};

const ZH = String(process.env.POST_LANG || "").toLowerCase().startsWith("zh");

export function say(key) {
  const pair = LINES[key];
  if (!pair) return key; /* An unknown key prints itself rather than "undefined",
                            because a missing string should look like a missing
                            string and not like a bug in the job. */
  return ZH ? pair[1] : pair[0];
}
