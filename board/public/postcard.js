/* The card they can post.
 *
 * NOBODY SHARES A WAITING LIST. People share three things: proof they are in,
 * news about somebody impressive, and access they can give away. This board
 * had machinery for the third — the invite — and nothing at all for the
 * first. Somebody on the list had nothing to show for it, and "I am 55th" is
 * not a thing anybody posts.
 *
 * So this makes one image: their name, their line, and the chop. It is the
 * only thing a person standing outside can do that helps them and helps the
 * board at the same time.
 *
 * DRAWN ON THEIR OWN DEVICE, which is not a detail. Everything on the card is
 * already on their screen; making it in a canvas here means no upload, no
 * render service, no file on this box, and nothing about them travelling
 * anywhere to produce a picture of themselves. What they do with it after is
 * theirs, and the board never learns whether they posted it.
 *
 * 1080 × 1350. Four by five is what Moments and Instagram both give a
 * portrait image without cropping it, and a cropped card is a card with
 * somebody's name cut in half.
 */

const W = 1080, H = 1350;

/* The seal's palette, the same values as the arrival in room.html. A card
   that does not match the screen it came from is a card from another
   product. */
const INK = "#12100E";
const PAPER = "#EFE6DC";
const RED = "#B22A1F";
const TAN = "#B08A6A";
const DIM = "#6A5A4B";

const SERIF = 'Georgia,"Songti SC","Noto Serif CJK SC","Times New Roman",serif';
const SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",'
  + '"Hiragino Sans GB","Microsoft YaHei",sans-serif';

/** Wrap by measuring, because the two languages break differently: English
 *  breaks on spaces and Chinese breaks anywhere, and a wrapper that only
 *  knows about spaces puts a whole Chinese sentence on one line and off the
 *  side of the card. */
function lines(ctx, text, max) {
  const out = [];
  const words = /[㐀-鿿]/.test(text)
    ? [...text]                       // any character is a break
    : String(text).split(/\s+/).map((w, i) => (i ? " " + w : w));
  let line = "";
  for (const w of words) {
    const next = line + w;
    if (line && ctx.measureText(next).width > max) { out.push(line); line = w.trim(); }
    else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Their photograph, if they have one. Same origin, so the canvas stays
 *  clean and toBlob still works — a tainted canvas throws on export and the
 *  button would fail with nothing on screen to explain it. */
function loadFace(src) {
  return new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/**
 * @param {object} who  { name, why, photo, member }
 * @param {function} T  the string table
 * @returns {Promise<string>} a data URL
 */
export async function drawCard(who, T) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");

  // ---- the paper ----------------------------------------------------------
  x.fillStyle = INK;
  x.fillRect(0, 0, W, H);
  const wash = x.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H * 0.42, W * 0.9);
  wash.addColorStop(0, "#241E19");
  wash.addColorStop(1, INK);
  x.fillStyle = wash;
  x.fillRect(0, 0, W, H);

  // A hairline inside the edge, the way a printed card has one.
  x.strokeStyle = "rgba(239,230,220,.16)";
  x.lineWidth = 2;
  x.strokeRect(46, 46, W - 92, H - 92);

  // ---- their face, if there is one ---------------------------------------
  /* WORKED OUT FIRST, NOT WALKED DOWN THE CARD. The first version moved a
     cursor and added a gap at each step, and the chop came out drawn through
     the middle of somebody's name — twelve pixels of overlap, which on a
     picture of a person with their name on it is the one mistake that makes
     it unpostable. Three numbers, decided before anything is drawn. */
  const face = await loadFace(who.photo);
  const R = 150;
  const faceY = 330;                    // centre of the circle
  const chopY = face ? faceY + R + 96 : 300;
  const nameY = chopY + 52 + 104;       // half the chop, then a clear line

  if (face) {
    /* Drawn to cover the circle rather than squashed into it — a face
       stretched to fit is the one thing on here nobody would post. */
    const cx = W / 2;
    x.save();
    x.beginPath();
    x.arc(cx, faceY, R, 0, Math.PI * 2);
    x.clip();
    const scale = Math.max((R * 2) / face.width, (R * 2) / face.height);
    const fw = face.width * scale, fh = face.height * scale;
    x.drawImage(face, cx - fw / 2, faceY - fh / 2, fw, fh);
    x.restore();
    x.beginPath();
    x.arc(cx, faceY, R, 0, Math.PI * 2);
    x.strokeStyle = "rgba(239,230,220,.22)";
    x.lineWidth = 3;
    x.stroke();
  }
  let y = nameY;

  // ---- the chop -----------------------------------------------------------
  /* Off true by four degrees, like the one on the arrival. A chop pressed by
     a person is never square to the page, and that is most of what stops it
     reading as an app icon. */
  const s = 104;
  x.save();
  x.translate(W / 2, chopY);
  x.rotate(-4 * Math.PI / 180);
  x.fillStyle = RED;
  const r2 = 14, hx = s / 2;
  x.beginPath();
  x.moveTo(-hx + r2, -hx);
  x.arcTo(hx, -hx, hx, hx, r2);
  x.arcTo(hx, hx, -hx, hx, r2);
  x.arcTo(-hx, hx, -hx, -hx, r2);
  x.arcTo(-hx, -hx, hx, -hx, r2);
  x.fill();
  x.strokeStyle = "rgba(247,237,230,.34)";
  x.lineWidth = 6;
  x.strokeRect(-hx + 9, -hx + 9, s - 18, s - 18);
  x.fillStyle = "#F7EDE6";
  x.font = `400 56px ${SERIF}`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("交", 0, 4);
  x.restore();

  // ---- their name ---------------------------------------------------------
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  x.fillStyle = PAPER;
  x.font = `400 84px ${SERIF}`;
  for (const line of lines(x, who.name || "", W - 220).slice(0, 2)) {
    x.fillText(line, W / 2, y);
    y += 96;
  }

  // ---- their line ---------------------------------------------------------
  if (who.why) {
    y += 12;
    x.fillStyle = TAN;
    x.font = `400 38px ${SERIF}`;
    for (const line of lines(x, who.why, W - 260).slice(0, 3)) {
      x.fillText(line, W / 2, y);
      y += 54;
    }
  }

  // ---- standing, at the foot ---------------------------------------------
  /* NOT THEIR QUEUE NUMBER. "55th of 55" is the one fact on this card nobody
     would post, and a card people do not post is a card that does nothing.
     Where they stand, not how far back. */
  x.fillStyle = DIM;
  x.font = `600 26px ${SANS}`;
  const on = T(who.member ? "post.in" : "post.on");
  x.fillText(spaced(on), W / 2, H - 232);

  x.fillStyle = PAPER;
  x.font = `400 46px ${SERIF}`;
  x.fillText("交换  The Exchange", W / 2, H - 164);

  x.fillStyle = DIM;
  x.font = `400 30px ${SANS}`;
  x.fillText("thexchange.app", W / 2, H - 110);

  return c.toDataURL("image/png");
}

/** Letter-spacing, which canvas has no property for. */
const spaced = (t) => [...String(t)].join("  ");
