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
//
// THREE WAYS A CODE GETS READ, AND ALL THREE ARE INSIDE WECHAT.
//
// Written down because a session claimed a QR on a phone was a dead end —
// "you cannot scan the screen you are holding" — and started designing
// around a problem WeChat solved years ago. Tom corrected it. The payer
// leaves the app for none of these:
//
//   长按识别      Hold a finger on the code and WeChat offers to open it.
//                 Works on an image in a chat, in Moments, and on an <img>
//                 in WeChat's own browser — which is the whole reason this
//                 file sends a PNG and not the grid of divs above.
//
//   扫一扫        The scanner, in the + menu. Camera pointed at another
//                 screen or at something printed: across a table, off a
//                 carton, off a shelf card. This is the one that lets a
//                 code live where a link cannot go at all.
//
//   从相册选取    Inside 扫一扫, "choose from album". Screenshot the code,
//                 open the scanner, pick the picture. The same-device
//                 route, using the scanner rather than the long press.
//
// SO THE CODE IS NOT A FALLBACK FOR A LINK, IT IS THE BETTER OBJECT.
// WeChat interstitials and blocks external URLs, hardest in group chats and
// hardest of all on anything payment-shaped; an image is not treated that
// way. One picture serves everyone in the group. And a code can be printed,
// which is how a carton of formula carries its own reorder button.
//
// None of that is true of the QR an offshore checkout draws AFTER Pay is
// pressed — that one is a foreign flow showing through, and the fix there
// is the app handoff, not a better code. Two different objects doing two
// different jobs; do not let a note about one become a rule about the other.

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
