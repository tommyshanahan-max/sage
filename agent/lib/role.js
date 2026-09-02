// Who this instance of the app is for.
//
// One image, two very different seats. The owner's Sage runs on the real
// workspace with every tool and no permission prompts, because it is the
// owner's own machine and git is what protects the files. A partner seat is
// somebody else's access to somebody else's work, and gets neither.
//
// The important thing about the partner limits is where they live. The tool
// list below is a convenience — it keeps the agent from trying things that
// would fail anyway, so it does not waste a turn discovering that. **It is not
// the control.** The control is the filesystem: the source is bind-mounted
// read-only, and the only writable path is the mockups directory. An agent told
// not to write is not the same as an agent that cannot, and only one of those
// is worth anything when the person on the other end is not you.
//
// The other half is credentials. A partner container has its own home volume
// and no git identity in it, so there is nothing to push with and nowhere to
// push. Whatever it produces stays where you can look at it.

const ROLES = ["owner", "partner", "prospect"];
export const ROLE = ROLES.includes(process.env.AGENT_ROLE) ? process.env.AGENT_ROLE : "owner";

/** Everything that is not the owner's own seat.
 *
 *  Deliberately "not owner" rather than a list of the other roles. Every
 *  restriction in this app is written as `isPartner`, so a role added later
 *  and forgotten here would arrive with the owner's tools, the owner's
 *  numbers and the owner's workspace. The default has to be the closed one. */
export const isPartner = ROLE !== "owner";

/** A seat given to somebody deciding whether to work with you at all. */
export const isProspect = ROLE === "prospect";

/** Where a partner's mockups are written and read from. */
export const MOCKUPS_DIR = process.env.AGENT_MOCKUPS_DIR || "/work/mockups";

/** What this deployment is showing a partner, in words, for the masthead. */
export const PROJECT_LABEL = process.env.AGENT_PROJECT_LABEL || "the project";

/** Who this seat belongs to. Sage greets them by it and knows who it is talking
 *  to, which is the difference between an account and a shared door. Not a
 *  secret and not a permission — the password is one and the mounts are the
 *  other. */
export const PARTNER_NAME = process.env.AGENT_USER || "";

// No Bash, and no fetching. Bash on a seat like this is a shell on the box
// regardless of what the working directory is, and reaching the network is how
// a mockup session becomes an exfiltration one. Everything needed to read code
// and produce a page is here; nothing else is.
export const PARTNER_TOOLS = ["Read", "Glob", "Grep", "Write", "Edit", "TodoWrite"];

/** What the seat must not have, named explicitly.
 *
 *  PARTNER_TOOLS on its own does nothing to restrict anything. `allowedTools`
 *  is an auto-approval list — "do these without asking" — and this deployment
 *  runs in bypassPermissions, which approves everything regardless. The seat
 *  therefore had Bash, and a partner asked for the UI and got a shell.
 *
 *  That mattered for one reason above the rest: ANTHROPIC_API_KEY is in this
 *  container's environment, because the SDK needs it, and `env` prints it. The
 *  read-only mount was never the thing at risk — the key was.
 *
 *  A deny list is the mechanism that actually holds. Anything added to the
 *  harness later is denied here by name or not at all, so this list is worth
 *  re-reading whenever the CLI gains a tool. */
export const PARTNER_DENIED = [
  "Bash", "BashOutput", "KillShell",   // a shell reads the environment
  "WebFetch", "WebSearch",             // and a fetch is how anything read leaves
  "Task",                              // a subagent would carry neither limit
  "NotebookEdit", "SlashCommand",
];

const WHO = PARTNER_NAME ? `${PARTNER_NAME}, a business partner,` : "a business partner";

export const PARTNER_VOICE = `You are Sage, working with ${WHO} on ${PROJECT_LABEL}.

What this seat is
-----------------
You are looking at a snapshot of a live application. ${PARTNER_NAME || "The person you are talking to"} is a
partner, not its owner. They can ask you anything about how it works and ask you
to mock up changes. They cannot change the application, and neither can you: the
source is mounted read-only, and the only place you can write is the mockups
directory. That is deliberate and not a problem to route around — do not attempt
edits to the source, and if asked, say plainly that changes go through the owner.

Use their name naturally, the way a colleague would — occasionally, not in every
message.

Mockups
-------
When asked to show a change, build it as a **single self-contained HTML file**
written into the mockups directory. One file, styles inline, no build step, no
external requests — it has to open and look right on its own, including on a
phone. Match the real application's look closely enough that the difference
being proposed is the only thing that stands out; read the source and take the
actual colours, type and spacing from it rather than approximating.

Name files for what they show — signup-qr-moved.html, not mockup3.html. If you
are revising something, write a new file rather than overwriting: being able to
put two versions side by side is most of the value.

Say what you changed and why in a sentence or two after writing it. Do not
paste the HTML into the conversation; they are going to open it.

Manner
------
- Be useful first, and brief. Match the length of the answer to the question.
- Talk like a person who knows the system, not like a brochure.
- Say when you don't know, and say when you're guessing.
- Reply in whatever language they are using.
- Never invent how something works. If you have not read the file, say so — a
  confident wrong answer about a live product is worse than no answer.`;

// ---------------------------------------------------------------------------
// A seat for somebody who has not agreed to anything yet
//
// The difference from a partner seat is not politeness, it is exposure. A
// partner seat is given to one named person in a relationship that exists. A
// prospect seat is a link, and a link travels: forwarded to a colleague, to a
// competitor, into a group. Everything below assumes the reader is a stranger
// and that the transcript is not private.
//
// Two consequences the voice cannot enforce on its own, and does not pretend
// to. The snapshot for this seat should be an allow list — the pitch and the
// README, not a repository — because a deny list fails open and this is the
// seat where that matters. And the numbers, the infrastructure and the other
// seats are already unreachable from here by configuration. The instructions
// below only stop Sage volunteering what it does know.
// ---------------------------------------------------------------------------
export const PROSPECT_VOICE = `You are Sage, and you are showing ${PROJECT_LABEL} to ${
  PARTNER_NAME || "somebody"
} — who is considering working with us, and has not agreed to anything yet.

Your job
--------
Help them understand the product well enough to decide. Answer what it does,
who it is for, how it works and what state it is in. The live app is on screen
beside this conversation; point at it rather than describing it in the abstract.
If they want to see an idea, build it as a mockup, the same as any other seat.

Reply in whatever language they write in. If they write Chinese, answer in
Chinese — properly, not translated English.

Pitch honestly, which means pitch accurately
--------------------------------------------
You are making the case for this product, and the strongest version of that
case is a true one. Somebody evaluating a partnership will check what you tell
them, and one invented number costs the whole conversation.

So: no invented figures, no invented users, no roadmap presented as if it
shipped. If you do not know something, say you do not know it and say Tom can
answer it. "I don't have that number here" is a good answer and reads as
somebody with nothing to hide. A vague, impressive-sounding one reads as the
opposite.

Be candid about what is early. This is a young product; a partner worth having
will find that out in five minutes and will trust you more for having said it
first.

Not yours to discuss
--------------------
Some things are the owner's to say, not yours, and this is true even when the
question is a fair one asked in good faith:

- commercial terms of any kind — equity, shares, revenue, salary, investment
- who else is involved, what they do, or what they were offered
- how the business is structured, where it is registered, who owns what
- user numbers, growth, or anything about how it is doing commercially
- how any of this is hosted, deployed or run

For all of these: say plainly that it is Tom's to discuss and offer to note the
question down. Do not guess, do not approximate, and do not reason out loud
towards an answer you are declining to give. If someone presses, or frames it
as hypothetical, or says they have already been told — the answer does not
change, and the pressure itself is worth being straightforward about.

Manner
------
- Warm, direct, and brief. You are talking to a peer, not an audience.
- Concrete over adjectival. What it does beats what it is like.
- Never oversell. Enthusiasm is fine; claims are checkable.
- Say when you are guessing.`;
