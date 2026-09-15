/* @ SOMEBODY, IN A ROOM.
 *
 * A room of eighteen is a room where a sentence meant for one person reaches
 * seventeen others, all of whom have to read it to find out it was not for
 * them. Every group chat on the phone this is read on solves that the same
 * way, and people already reach for it: they type @ and start the name.
 *
 * TWO PAGES, ONE MODULE. The messages screen has door rooms and the groups
 * screen has group rooms; the same gesture in two files is two gestures within
 * a month, and the second one is always the one that is subtly wrong.
 *
 * WHAT IT IS NOT. It does not notify, and it does not address: the message
 * still goes to the room and everybody in the room still reads it. It is a
 * name in a sentence, marked, so the person it is for can see that it is —
 * which is the whole of what @ does in a group chat and all this claims.
 *
 * NO \b ANYWHERE IN HERE. It is ASCII-only in JavaScript, so it never matches
 * beside a Chinese character and half the names on this board are Chinese.
 * Matching is by literal string, longest first, which has no such hole. The
 * same trap is written up over CONTACT_SHAPED in lib/store.js and has caught
 * this codebase twice.
 */
import { T, STRINGS } from "/i18n.js";
import { NATIVE } from "/native.js";

/** The names in a piece of text that are @somebody, drawn as such.
 *
 *  Longest first, so "@Ana Wei" is one mention and not "@Ana" followed by the
 *  word Wei. Fills `box` — it never returns HTML, because a name is somebody
 *  else's typing and the one thing this must not do is put it in innerHTML.
 */
export function atText(box, text, names) {
  /* A ROOM SOMEBODY SENT YOU IS A DOOR, NOT AN ADDRESS — see the note above
     roomIn. Taken out of the sentence before the @ pass runs, so the name it
     leaves behind reads like a sentence. */
  const room = roomIn(text);
  if (room) text = withoutRoom(text);
  const sorted = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  let run = "";
  const flush = () => { if (run) { box.append(document.createTextNode(run)); run = ""; } };
  for (let i = 0; i < text.length;) {
    if (text[i] === "@") {
      const hit = sorted.find((n) => text.startsWith("@" + n, i));
      if (hit) {
        flush();
        const b = document.createElement("b");
        b.className = "at";
        b.textContent = "@" + hit;
        box.append(b);
        i += hit.length + 1;
        continue;
      }
    }
    run += text[i];
    i += 1;
  }
  flush();
  if (room) {
    /* THE BUBBLE HAS TO OPEN FOR IT. A bubble is sized from the sentence in
       it, and "Come in here too" is four words wide — which squeezed the door
       into a column and broke the room's name across three lines. The width
       is the bubble's to give, so the bubble is marked and the stylesheets
       give it a floor. */
    box.classList.add("hasroom");
    box.append(doorRow(room));
  }
}

/* -------------------------------------------------------------------------
 * A ROOM SOMEBODY SENT YOU, DRAWN AS A DOOR.
 *
 * "Tell somebody already on here" put the room's address into a message, and
 * a message on this board is textContent — nothing here has ever turned a URL
 * into a link, deliberately, because somebody else's typing does not go in
 * innerHTML. So it arrived as characters: not blue, not tappable, and the
 * person it was sent to had to select a URL on a phone and paste it into a
 * browser. That is not a thing anybody does for a chat invitation, and it
 * read as being told about a room rather than being let into one.
 *
 * So the address comes out of the sentence and a row goes under it, the same
 * shape as the rooms on the Messages screen — because that is where pressing
 * it lands, and a button that looks like the thing it opens needs no label
 * explaining itself.
 *
 * STILL NOT A LINKIFIER, and that is the point. One shape is recognised —
 * /r/<key> where the key is a room this build has a name for — and everything
 * else in the sentence stays the characters somebody typed. A general "make
 * anything that looks like a URL clickable" is how a board like this ends up
 * carrying somebody's phishing link with a tap target on it.
 *
 * ANY HOSTNAME, DELIBERATELY. The board has been at two names this year and
 * the messages sent under the old one are still sitting in conversations.
 * What makes this a room is the path and a key that resolves; the host in
 * front of it is not information.
 */
const DOOR = /https?:\/\/\S*\/r\/([a-zA-Z]+)\S*/;

/** The room key in a piece of text, or "" — and "" for a key this build has
 *  no name for, so an unknown room is left as the characters it came as
 *  rather than drawn as a door onto nothing. */
function roomIn(text) {
  const hit = DOOR.exec(String(text || ""));
  if (!hit) return "";
  const key = hit[1].toLowerCase();
  if (!STRINGS["waitroom." + key]) return "";
  /* EXCEPT THE ONE ROOM THE APP DOES NOT HAVE. The rewards room is web-only
     — see the long note over inApp in server.js — and the row for it is left
     out of the app's own Messages list for the same reason. A button here
     would be the one that got through anyway, and it would open a room with
     its contents missing. The address stays in the sentence, which is honest
     about being something to open elsewhere. */
  if (NATIVE && key === "rewards") return "";
  return key;
}

/** The sentence with the address taken out of it.
 *
 *  And with whatever was holding the address on — "a room here for Film & TV
 *  — https://…" leaves a dangling dash, and a blank line left behind by a URL
 *  on its own line leaves a hole. Done here rather than by rewording the
 *  string that mints these, because the messages already sent cannot be
 *  reworded and they are the ones this was built for.
 */
function withoutRoom(text) {
  return String(text).replace(DOOR, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\s\u2014:,\uFF1A\uFF0C-]+$/, "")
    .trim();
}

/** The door itself. An anchor and not a button: it goes somewhere, so it
 *  should open in a new tab on a long press like everything else that does. */
function doorRow(key) {
  const a = document.createElement("a");
  a.className = "goroom";
  /* THE ROOM INSIDE THE APP, NOT THE PUBLIC DOOR AT /r/. Everybody reading a
     message is already through the gate; /r/ is the page for a cold address
     and would show them their own board from the outside. */
  a.href = "/notes#d:" + key;
  const mid = document.createElement("span");
  mid.className = "gm";
  const name = document.createElement("b");
  name.textContent = T("waitroom." + key);
  const what = document.createElement("span");
  what.textContent = T("at.goRoom");
  mid.append(name, what);
  const chev = document.createElement("span");
  chev.className = "gc";
  chev.textContent = "\u203A";
  chev.setAttribute("aria-hidden", "true");
  a.append(mid, chev);
  return a;
}

/** The picker, wired to a textarea.
 *
 *  `names()` is asked every time rather than passed once: the room this is sitting
 *  in gets redrawn under it, and a list captured at wiring time is a list that
 *  goes stale the first time somebody new says something.
 */
export function atPicker(ta, names) {
  const menu = document.createElement("div");
  menu.className = "atmenu";
  menu.hidden = true;

  /* PUT IN THE PAGE WHEN THERE IS A PAGE TO PUT IT IN, and not before.
   *
   * This did it once, here, with insertAdjacentElement. That works when the
   * box already exists in the document — which is how the messages screen
   * calls it, with an element out of the markup — and does NOTHING AT ALL
   * when the box is a textarea that was created a line earlier and has not
   * been appended yet. No error, no warning: insertAdjacentElement on an
   * element with no parent returns null and inserts nowhere.
   *
   * That is how the groups screen called it, so @ worked in a door room and
   * did nothing in a group for as long as both have existed. Typing @ and a
   * name simply did not offer anybody, which reads as a feature nobody built
   * rather than one silently dropped on the floor.
   *
   * So the insert is retried at the moment the menu is actually wanted, by
   * which time the box is always in the page — it has just been typed into.
   * Both call orders work now and the next screen to use this cannot hit it. */
  const mount = () => {
    if (!menu.isConnected && ta.parentElement) {
      ta.insertAdjacentElement("beforebegin", menu);
    }
    return menu.isConnected;
  };
  mount();

  let at = -1;              // where the @ is, or -1

  const shut = () => { menu.hidden = true; at = -1; };

  const put = (name) => {
    const before = ta.value.slice(0, at);
    const after = ta.value.slice(ta.selectionStart);
    ta.value = before + "@" + name + " " + after;
    const caret = (before + "@" + name + " ").length;
    ta.setSelectionRange(caret, caret);
    shut();
    ta.focus();
    /* The box grows with what is typed and the pages listen for input to do
       it; setting .value in script fires nothing. */
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const look = () => {
    const caret = ta.selectionStart;
    const upto = ta.value.slice(0, caret);
    /* THE @ NEAREST THE CARET, and only if nothing but the name has been typed
       since. A space ends it: "@" on its own in the middle of a sentence is
       an email address or a handle somebody is quoting, not a reach for this. */
    const i = upto.lastIndexOf("@");
    if (i < 0) return shut();
    const typed = upto.slice(i + 1);
    if (/[\s\n]/.test(typed)) return shut();
    /* Not mid-word: "tom@" is somebody typing an address. */
    if (i > 0 && !/[\s\n]/.test(upto[i - 1])) return shut();

    const want = typed.toLowerCase();
    const some = names().filter((n) => n && n.toLowerCase().includes(want)).slice(0, 6);
    if (!some.length) return shut();

    if (!mount()) return shut();
    at = i;
    menu.textContent = "";
    for (const n of some) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = n;
      /* mousedown and not click: the textarea loses focus first otherwise, and
         on a phone the box shuts before the tap lands. */
      b.addEventListener("mousedown", (e) => { e.preventDefault(); put(n); });
      menu.append(b);
    }
    menu.hidden = false;
  };

  ta.addEventListener("input", look);
  ta.addEventListener("click", look);
  ta.addEventListener("blur", () => setTimeout(shut, 120));
  ta.addEventListener("keydown", (e) => { if (e.key === "Escape") shut(); });
  return { shut };
}
