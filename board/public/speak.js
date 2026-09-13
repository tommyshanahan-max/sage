/* Saying it instead of typing it.
 *
 * The board has spoken out loud for months — speechSynthesis in level.html
 * and enter.html — and has never listened. This is the other direction, and
 * it is the same argument as everything else here about phones: typing a
 * paragraph on a phone keyboard is the slowest thing anybody does on this
 * board, and the people with the most to say are doing it one thumb at a time
 * in a taxi.
 *
 * NO DEPENDENCY, NO SERVER, NO AUDIO ANYWHERE. The browser's own
 * SpeechRecognition does the whole job on the device or through the vendor's
 * own service, and what this file receives is a string. Nothing is uploaded
 * by this board, nothing is stored, and there is no audio file at any point —
 * which also means no decision to make about keeping one.
 *
 * WHERE IT DOES NOT WORK, said plainly because the alternative is a button
 * that sits there doing nothing:
 *
 *   Firefox has no SpeechRecognition at all. The button is not drawn.
 *
 *   Chrome sends the audio to Google to be recognised, and Google is not
 *   reachable from mainland China. So the button is drawn — the API is there
 *   and says yes — and then fails on a real network. It reports the failure
 *   and hides itself rather than pretending.
 *
 *   WeChat's built-in browser mostly refuses the microphone outright. That
 *   arrives as a permission error, which is the same path.
 *
 * So: this is a shortcut for whoever has it, never a thing anything depends
 * on. The field is always typeable and the keyboard's own dictation key is
 * still there on every phone.
 */

/** Does this browser have it at all. */
export const canHear = () => {
  try {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  } catch { return false; }
};

/* ONE RECOGNISER AT A TIME, AND THIS IS THE "SOMETIMES IT DOESN'T RECORD".
 *
 * The microphone is a single resource and the browser gives it to one
 * recogniser. Start a second while the first still holds it and start()
 * throws InvalidStateError — which this file caught, reported as "failed",
 * and the caller turned into stopping quietly. So the FIRST hold worked, and
 * a hold a second later did nothing at all, and it looked like the button
 * being flaky rather than like a resource not yet handed back.
 *
 * It is not instant, either: stop() lets the last phrase finish being
 * recognised, so the session is still alive for a moment after the finger
 * comes up. Anybody who lets go and immediately holds again lands in exactly
 * that window.
 *
 * A screen with ONE mic button that toggles never hits this — there is only
 * ever one session and it is never started twice in a row. A button held and
 * released and held again hits it constantly.
 *
 * So: whoever holds it is remembered, a new one takes it off the old one
 * first, and a start that still throws is retried once after a beat rather
 * than being reported as a failure the person can do nothing about.
 */
let ALIVE = null;

/** Start listening into a field.
 *
 *  Returns a handle with .stop(). Calling it twice is harmless.
 *
 *  @param field    the <input> or <textarea> the words land in
 *  @param lang     a BCP-47 tag — "en-US" or "zh-CN"
 *  @param on       { onState(listening), onError(message) }
 */
export function listen(field, lang, on = {}) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) { on.onError && on.onError("none"); return { stop() {} }; }

  const rec = new Rec();
  rec.lang = lang || "en-US";
  /* CONTINUOUS, because the thing being dictated is a paragraph. Left off, it
     stops at the first pause and the second sentence is lost while somebody is
     still talking — which reads as the button being broken rather than as a
     setting. */
  rec.continuous = true;
  /* AND INTERIM RESULTS, for one reason only: a microphone that shows nothing
     for four seconds is a microphone somebody presses again, which stops it.
     The interim text is shown and then REPLACED by the final — it is never
     left in the field, because interim text is the recogniser thinking out
     loud and is frequently wrong. */
  rec.interimResults = true;

  /* WHAT WAS IN THE FIELD BEFORE, kept so dictation APPENDS.
     Somebody types a line, dictates the next, and types a correction. Each of
     those has to survive the others, which means the only thing this may ever
     touch is the tail it added itself. */
  const was = field.value ? field.value.replace(/\s+$/, "") + " " : "";
  let settled = "";     // everything the recogniser has called final
  let live = false;

  const paint = (interim) => {
    field.value = was + settled + interim;
    /* The caret goes to the end, or a long dictation scrolls the box back to
       the top and the speaker cannot see what they are saying. */
    try { field.selectionStart = field.selectionEnd = field.value.length; } catch { /* input types without one */ }
    try { field.scrollTop = field.scrollHeight; } catch { /* not scrollable */ }
  };

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) settled += t;
      else interim += t;
    }
    paint(interim);
  };

  rec.onerror = (e) => {
    /* "no-speech" is somebody pausing to think and is not a failure — Chrome
       fires it after a few seconds of quiet and then carries on. Reporting it
       would put an error on the screen of somebody who is mid-sentence. */
    if (e && e.error === "no-speech") return;
    live = false;
    if (ALIVE === rec) ALIVE = null;
    on.onError && on.onError(String((e && e.error) || "failed"));
    on.onState && on.onState(false);
  };

  /* CHROME ENDS THE SESSION ON ITS OWN after a stretch of silence, whatever
     `continuous` says. Restarting keeps a long dictation going; the flag is
     what tells this apart from the stop button, which must actually stop. */
  rec.onend = () => {
    if (ALIVE === rec) ALIVE = null;
    if (!live) { on.onState && on.onState(false); return; }
    try { rec.start(); ALIVE = rec; } catch { live = false; on.onState && on.onState(false); }
  };

  /* Somebody who let go before it ever started. Without this the microphone
     opens a moment later with nobody holding the button. */
  let dropped = false;
  let retried = false;

  const begin = () => {
    if (dropped) return;
    try {
      rec.start();
      ALIVE = rec;
      live = true;
      on.onState && on.onState(true);
    } catch {
      /* Almost always the previous session not having let go yet — see the
         note above ALIVE. One retry, then say so. */
      if (!retried) { retried = true; setTimeout(begin, 250); return; }
      on.onError && on.onError("busy");
    }
  };

  if (ALIVE && ALIVE !== rec) {
    const old = ALIVE;
    ALIVE = null;
    /* abort(), not stop(), on the one being replaced: its words are not
       wanted and stop() would spend another moment delivering them. */
    try { old.abort(); } catch { /* already gone */ }
    setTimeout(begin, 60);
  } else {
    begin();
  }

  return {
    stop() {
      live = false;
      dropped = true;
      if (ALIVE === rec) ALIVE = null;
      /* stop(), not abort(): stop lets the last phrase finish being recognised
         and delivered, abort throws it away. The word somebody was saying as
         they reached for the button is usually the one they meant. */
      try { rec.stop(); } catch { /* already stopped */ }
      paint("");
      on.onState && on.onState(false);
    },
  };
}
