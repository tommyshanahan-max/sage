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
// Server-side only. The browser gets bits and draws divs — the same way the
// deck and the walkthrough already draw their fake ones — so nothing is
// fetched and nothing new runs on a phone in the mainland.
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
