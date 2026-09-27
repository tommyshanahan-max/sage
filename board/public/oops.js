/* WHAT THE SCREEN DID, WHEN NOBODY WHO CAN READ A CONSOLE IS HOLDING IT.
 *
 * "Crashed." One word, from somebody's phone, about a screen nobody here can
 * see — and there is no way from this side to find out what it was. Every
 * other failure on this board says something: a route that throws is in the
 * log, a refused fetch has a status. A page that dies in the browser said
 * nothing at all, to anybody.
 *
 * So: the two events that mean the page broke, one line each into the board's
 * log, where `make board-log` already looks.
 *
 * A CLASSIC SCRIPT AND NOT A MODULE, deliberately. The interesting crash is a
 * module that fails to parse — a blank screen with a working bar under it,
 * which is exactly what "crashed" looks like from a chair — and a module
 * cannot report its own parse error. This runs first and is not one.
 *
 * NOTHING ABOUT THE PERSON. The message, the file and the line, and the path
 * they were on. No device, no handle, no text they had typed. A crash report
 * that carries a conversation is a conversation in a log file.
 *
 * THREE AND THEN IT STOPS. One bad frame can throw sixty times a second, and
 * a phone spending its evening posting that is a worse bug than the one it is
 * reporting. */
(function () {
  var sent = 0;
  function tell(what, where) {
    if (sent >= 3 || !what) return;
    sent += 1;
    var body = JSON.stringify({
      what: String(what).slice(0, 300),
      at: String(location.pathname || "").slice(0, 80),
      where: String(where || "").slice(0, 120),
    });
    try {
      /* sendBeacon so a page that is dying still gets the line out — a fetch
         from a frame the browser is tearing down is a fetch that never
         leaves. Falls back for anything that has not got it. */
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/oops", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/oops", { method: "POST", body: body, keepalive: true,
          headers: { "Content-Type": "application/json" } }).catch(function () {});
      }
    } catch (e) { /* a report that cannot be sent is not worth a second error */ }
  }
  window.addEventListener("error", function (e) {
    if (!e) return;
    /* An <img> or a <script> that 404s fires this too, with no message on it.
       Those are worth knowing about and are not crashes, so they are named
       rather than reported as one. */
    if (e.target && e.target !== window && e.target.tagName) {
      return tell("failed to load " + e.target.tagName.toLowerCase(),
        String(e.target.src || e.target.href || "").slice(0, 120));
    }
    tell(e.message || e.type, e.filename ? e.filename + ":" + e.lineno : "");
  }, true);
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    tell((r && (r.message || r.toString && r.toString())) || "rejected", "promise");
  });
})();
