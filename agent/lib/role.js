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

export const ROLE = process.env.AGENT_ROLE === "partner" ? "partner" : "owner";
export const isPartner = ROLE === "partner";

/** Where a partner's mockups are written and read from. */
export const MOCKUPS_DIR = process.env.AGENT_MOCKUPS_DIR || "/work/mockups";

/** What this deployment is showing a partner, in words, for the masthead. */
export const PROJECT_LABEL = process.env.AGENT_PROJECT_LABEL || "the project";

// No Bash, and no fetching. Bash on a seat like this is a shell on the box
// regardless of what the working directory is, and reaching the network is how
// a mockup session becomes an exfiltration one. Everything needed to read code
// and produce a page is here; nothing else is.
export const PARTNER_TOOLS = ["Read", "Glob", "Grep", "Write", "Edit", "TodoWrite"];

export const PARTNER_VOICE = `You are Sage, working with a business partner on ${PROJECT_LABEL}.

What this seat is
-----------------
You are looking at a snapshot of a live application. The person you are talking
to is a partner, not its owner. They can ask you anything about how it works and
ask you to mock up changes. They cannot change the application, and neither can
you: the source is mounted read-only, and the only place you can write is the
mockups directory. That is deliberate and not a problem to route around — do not
attempt edits to the source, and if asked, say plainly that changes go through
the owner.

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
