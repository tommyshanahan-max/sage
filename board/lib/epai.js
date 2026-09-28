/* EP AI — the assistant on the partner set-up page.
 *
 * WHY THIS EXISTS AT ALL. The set-up page is read by one person at a partner
 * company, usually not the one who bought anything, and the questions they
 * have are the same eight every time: where does the record go, will you see
 * my other pages, what about Cloudflare, whose Stripe is charged. Every one of
 * those is answered on the page they are already looking at, and they ask
 * anyway, because a page is a wall of text and a question is a question. The
 * alternative to this file is an email to Tom on a Sunday.
 *
 * IT ANSWERS FROM A FIXED BRIEF AND NOTHING ELSE. The same rule butler.js next
 * door runs on, for a sharper reason here: this one talks to somebody deciding
 * whether to point their company's DNS at a stranger's server. A model that
 * improvises a reassurance about what we can see has lied to exactly the
 * person who most needed the truth. Everything it may say is in BRIEF, and it
 * is told to hand over an email address for anything else.
 *
 * THE PAGE HAS TWO WAYS TO ASK AND THIS IS THE SECOND. Inside a Claude viewer
 * the page uses the viewer's own sampling, billed to whoever is reading, and
 * never reaches this route. Served from this box — which is what a partner
 * actually sees — window.claude does not exist and the widget falls back to
 * here. Both paths get the same brief, so the two answers agree.
 *
 * HAIKU, DELIBERATELY. Butler's note next door is the evidence: the heavy
 * model answered correctly and slowly enough that the browser had given up
 * first, and a success nobody is listening to leaves no trace anywhere. This
 * answers three sentences off a page of facts. It is a reading task, not a
 * reasoning one.
 */

const KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
export const configured = () => Boolean(KEY);

/* WHAT THIS COSTS AND WHO CAN SPEND IT. The set-up page is public and
 * unauthenticated — that is the point of it — so the cap is the only thing
 * between this route and somebody's script. Per caller and per day, in memory,
 * reset on restart: the job is stopping a runaway, not billing. */
const PER_CALLER = Number(process.env.BOARD_EPAI_TURNS || 30);
const PER_DAY = Number(process.env.BOARD_EPAI_DAY || 400);
const MAX_TURNS = 10;
const MAX_CHARS = 600;

const spent = new Map();
let day = new Date().toDateString();
let today = 0;

function allow(who) {
  const now = new Date().toDateString();
  if (now !== day) { day = now; today = 0; spent.clear(); }
  if (today >= PER_DAY) return { ok: false, why: "busy" };
  const n = (spent.get(who) || 0) + 1;
  if (n > PER_CALLER) return { ok: false, why: "enough" };
  spent.set(who, n);
  today += 1;
  return { ok: true };
}

/* THE ONLY THINGS IT KNOWS. Kept as prose rather than a data structure
 * because every line of it is a sentence somebody will read back, and the
 * moment it becomes fields somebody will add a field the page does not say. */
const BRIEF = `You are EP AI Assistant, on Europay's partner set-up page. You
answer questions about putting Europay on a partner's own domain, and nothing
else. Anything outside that — pricing, contracts, when something ships, what
another customer does — you say is outside what you can help with, and you give
mo@thexchange.app.

THE FACTS. These are all you know. Never add a number, a date, a limit or a
technical detail that is not here.

- The partner's payment page lives on a subdomain they own, such as
  pay.yourcompany.com. It runs on Europay's servers. They install nothing,
  host nothing and maintain nothing.
- The only change on their side is one DNS record: type CNAME, name "pay",
  value europay.paydealio.com, TTL 300, proxy off.
- They must not add it until Europay confirms the hostname is configured. Add
  it early and visitors get a certificate error instead of a page.
- On Cloudflare the record must be DNS only — the grey cloud, not the orange
  one. Proxied, the certificate cannot be issued.
- Europay issues and renews the certificate automatically, usually within
  about ten minutes of the record appearing. The partner buys nothing and
  configures nothing.
- Europay also needs, before the hostname can be set up: the exact hostname,
  the partner's name as it should be printed, a deep colour as a hex code, a
  paper colour as a hex code if they want one, and one human email address.
- Stripe is connected by a single authorisation on Stripe's own website using
  the partner's own Stripe login. No account is created on their behalf and we
  never see their password. Charges are raised on their account, their name is
  on every statement, money settles to their own bank, and they can revoke the
  connection from their Stripe dashboard at any time.
- Money never passes through Europay. It is software. A licensed payment
  provider holds and moves the funds.
- A CNAME routes one hostname. Europay cannot reach their website, shop,
  email, admin, database or customer data. A different hostname is a different
  browser origin, so their site's cookies are not sent to us. The one
  exception, which you should state plainly if asked: a cookie deliberately
  scoped to the whole domain (Domain=.yourcompany.com) is sent to every
  subdomain, this one included. If that matters to them, a separate domain for
  the payment page avoids it.
- Nothing else on their domain changes. Website, email and existing DNS
  records keep working exactly as they do now.

HOW TO ANSWER. Two or three sentences. Concrete, and in the language you were
asked in. No greeting, no sign-off, no offer to help further. If the answer is
not above, say you do not know and give mo@thexchange.app — that is a good
answer here, not a failure.`;

/**
 * Ask it something. `turns` is the page's short conversation, oldest first,
 * each `{role, content}`; `who` is whatever the route uses to count against a
 * cap. Resolves `{text}` or `{error}` — never throws, because the only caller
 * is a route whose job is to turn this into one line on a page.
 */
export async function ask(turns, who) {
  if (!KEY) return { error: "unconfigured" };
  const gate = allow(who || "anon");
  if (!gate.ok) return { error: gate.why };

  const said = (Array.isArray(turns) ? turns : [])
    .slice(-MAX_TURNS)
    .map((t) => ({
      role: t && t.role === "assistant" ? "assistant" : "user",
      content: String((t && t.content) || "").slice(0, MAX_CHARS),
    }))
    .filter((m) => m.content)
    /* The API takes alternating roles. A page that failed mid-answer leaves
       two questions in a row, which is a real state and not an error: join
       them rather than dropping the earlier one. */
    .reduce((out, m) => {
      const last = out[out.length - 1];
      if (last && last.role === m.role) {
        last.content = (last.content + "\n" + m.content).slice(-MAX_CHARS);
      } else out.push(m);
      return out;
    }, []);
  while (said.length && said[0].role === "assistant") said.shift();
  if (!said.length) return { error: "empty" };

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: KEY });
    const res = await client.messages.create({
      model: process.env.BOARD_EPAI_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 320,
      /* Cached: the brief is identical on every question anybody ever asks
         here, and reading it again per turn is most of the wait. */
      system: [{ type: "text", text: BRIEF, cache_control: { type: "ephemeral" } }],
      messages: said,
    }, {
      /* A hang has to look like a failure. Without this the SDK waits long
         past the point where the reader has closed the panel, and the answer
         arrives for nobody — the one failure that leaves no trace. */
      timeout: 20000,
      maxRetries: 1,
    });
    const text = (res.content || [])
      .filter((b) => b && b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text ? { text } : { error: "empty" };
  } catch (e) {
    /* The reason, never the question and never the key. */
    console.error("epai: " + (e && e.name ? e.name : "error") + " " + (e && e.status ? e.status : ""));
    return { error: "upstream" };
  }
}
