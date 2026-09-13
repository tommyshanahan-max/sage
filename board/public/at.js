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

/** The names in a piece of text that are @somebody, drawn as such.
 *
 *  Longest first, so "@Ana Wei" is one mention and not "@Ana" followed by the
 *  word Wei. Fills `box` — it never returns HTML, because a name is somebody
 *  else's typing and the one thing this must not do is put it in innerHTML.
 */
export function atText(box, text, names) {
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
  ta.insertAdjacentElement("beforebegin", menu);

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
