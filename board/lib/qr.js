// A QR as a grid of bits, for a page to draw.
//
// WHY A DEPENDENCY, IN A REPO WITH THREE.
//
// postcard.js has a QR in it as a hardcoded array, generated once offline —
// that is the right answer for an address that never changes, and the note
// there says so. A payment code is the opposite: a different string every
// time, generated while somebody waits.
//
// So an encoder has to run. Writing one is four hundred lines of
// Reed-Solomon and mask selection, and the part that matters is that there is
// no way to check it here: a wrong QR does not throw, it just fails to scan,
// on somebody else's phone, at the moment they were going to pay. Nobody
// would find out from this box. That is the kind of wrong worth paying a
// dependency to avoid.
//
// Server-side only. Nothing is fetched and nothing new runs on a phone in
// the mainland: the page is handed the finished code and draws it.
//
// AND IT HAS TO BE AN IMAGE, WHICH COST A DAY TO FIND OUT.
//
// The browser was given bits and drew a grid of divs — the same way the deck
// and the walkthrough draw their fake ones — and it looked exactly right.
// But WeChat's long-press menu reads a QR out of an <img>, not out of the
// page: hold a finger on a grid of divs and nothing is offered at all. Tom
// found it the way a real payer would have: he screenshotted the screen,
// opened the picture in a chat, and long-pressed that instead, which worked
// and is three steps nobody will take.
//
// So the server sends a PNG as well, and the payer's page draws that. The
// bits stay for the drawn ones, where nothing is ever scanned.
import QRCode from "qrcode";

/** @returns {{size:number, bits:string[]}} rows of "1"/"0", top to bottom. */
export function qrBits(text, { ec = "M" } = {}) {
  const m = QRCode.create(String(text), { errorCorrectionLevel: ec });
  const n = m.modules.size;
  const data = m.modules.data;
  const bits = [];
  for (let r = 0; r < n; r++) {
    let row = "";
    for (let c = 0; c < n; c++) row += data[r * n + c] ? "1" : "0";
    bits.push(row);
  }
  return { size: n, bits };
}

/** The same code as a PNG data URI, which is the one a phone can act on.
 *
 *  Scale 8 gives about 300 pixels across for a payment-sized code — big
 *  enough for a camera across a table, small enough to inline, and the page
 *  sizes it in CSS anyway. Margin 1 rather than the standard 4: the page
 *  puts white around it, and four modules of quiet zone inside a small image
 *  is a smaller code for no reason. */
export async function qrPng(text, { ec = "M" } = {}) {
  return QRCode.toDataURL(String(text), {
    errorCorrectionLevel: ec, margin: 1, scale: 8,
  });
}
