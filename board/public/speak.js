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

/** Does this browser have it at all.
 *
 *  THIS USED TO ASK ABOUT SpeechRecognition AND THE ANSWER WAS A LIE.
 *
 *  On an iPhone added to the home screen — which is how this board is meant
 *  to be used — webkitSpeechRecognition is DEFINED and does nothing. The
 *  check said yes, the button appeared, every press failed, and the person
 *  was told "speaking did not work here" by an app that had just promised it
 *  would. In China the API is there and Google is not, which is the same
 *  story with a different cause.
 *
 *  So the question is now the one that can be answered honestly: can this
 *  phone record? Recording works in a standalone iPhone app and works in
 *  China, and the words are made out of the audio in Tokyo — see record()
 *  below and lib/hear.js.
 */
export const canHear = () => {
  try {
    return Boolean(navigator.mediaDevices
      && navigator.mediaDevices.getUserMedia
      && window.MediaRecorder);
  } catch { return false; }
};

/* WHAT THE PHONE CAN ACTUALLY RECORD. Safari gives mp4, Chrome gives webm,
   and the server refuses anything it does not recognise rather than paying to
   find out. First supported wins. */
const KINDS = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/wav"];

function kind() {
  try {
    for (const k of KINDS) if (window.MediaRecorder.isTypeSupported(k)) return k;
  } catch { /* no isTypeSupported */ }
  return "";
}

/** Record, and hand back what was said.
 *
 *  START IT FROM INSIDE THE GESTURE. getUserMedia in a setTimeout is not in a
 *  user gesture on an iPhone and is refused — which is the other half of why
 *  holding the button for 400ms and then opening the microphone never worked
 *  there. This is called straight out of the tap.
 *
 *  @param on { onState(recording), onText(text), onError(why) }
 *  @returns a handle with .stop() — send it — and .drop() — throw it away.
 */
export function record(lang, on = {}) {
  let rec = null;
  let stream = null;
  let dead = false;
  let sending = false;
  const bits = [];

  const shut = () => {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* gone */ }
    stream = null;
  };

  const fail = (why) => {
    if (dead) return;
    dead = true;
    shut();
    on.onState && on.onState(false);
    on.onError && on.onError(why);
  };

  /* SIXTY SECONDS AND IT STOPS ITSELF. A phone in a pocket with the recorder
     running is a bill and a privacy problem, and nobody says more than a
     minute to a doorman. */
  let cap = 0;

  const send = async () => {
    shut();
    on.onState && on.onState(false);
    if (dead) return;
    const type = (rec && rec.mimeType) || kind() || "audio/webm";
    const blob = new Blob(bits, { type });
    /* Nothing was recorded — a tap on and straight off again. Not a failure
       and not worth a line on the screen. */
    if (blob.size < 1200) { dead = true; on.onText && on.onText(""); return; }
    dead = true;
    try {
      const r = await fetch("/api/butler-hear?lang=" + encodeURIComponent(lang === "zh" ? "zh" : "en"), {
        method: "POST",
        headers: { "Content-Type": type, "x-board-device": (on.device || "") },
        body: blob,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.text) { on.onError && on.onError(d.error || "failed"); return; }
      on.onText && on.onText(d.text);
    } catch {
      on.onError && on.onError("failed");
    }
  };

  navigator.mediaDevices.getUserMedia({ audio: true }).then((got) => {
    if (dead) { got.getTracks().forEach((t) => t.stop()); return; }
    stream = got;
    const type = kind();
    try {
      rec = type ? new window.MediaRecorder(got, { mimeType: type }) : new window.MediaRecorder(got);
    } catch {
      return fail("kind");
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) bits.push(e.data); };
    rec.onstop = () => { if (sending) send(); else { shut(); on.onState && on.onState(false); } };
    rec.onerror = () => fail("failed");
    try { rec.start(); } catch { return fail("failed"); }
    on.onState && on.onState(true);
    cap = setTimeout(() => { if (rec && rec.state === "recording") { sending = true; try { rec.stop(); } catch { /* gone */ } } }, 60_000);
  }).catch((e) => {
    /* The phone said no, or there is no microphone to say yes with. */
    const why = e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "not-allowed" : "failed";
    fail(why);
  });

  return {
    /* Let go and send it. */
    stop() {
      clearTimeout(cap);
      sending = true;
      if (rec && rec.state === "recording") { try { rec.stop(); } catch { send(); } }
      else if (!dead) { dead = true; shut(); on.onState && on.onState(false); on.onText && on.onText(""); }
    },
    /* Throw it away — a cancelled gesture must not send half a sentence. */
    drop() {
      clearTimeout(cap);
      sending = false;
      dead = true;
      if (rec && rec.state === "recording") { try { rec.stop(); } catch { /* gone */ } }
      shut();
      on.onState && on.onState(false);
    },
  };
}

/* THE BROWSER'S OWN RECOGNISER IS GONE FROM HERE, and it is worth saying why
 * rather than leaving a gap.
 *
 * listen() wrapped window.SpeechRecognition: free, instant, no key, interim
 * words appearing as somebody spoke. It is the better mechanism and it does
 * not work for either half of the people this board is for — dead in a
 * standalone iPhone app while reporting itself available, and Google's
 * service, which the mainland cannot reach. Two silent failures, and the
 * capability check could not tell you about either.
 *
 * record() above is slower, costs money and has no interim words. It works on
 * both.
 */
