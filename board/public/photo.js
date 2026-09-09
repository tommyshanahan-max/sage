/* A PHOTOGRAPH, MADE FIT TO SEND.
 *
 * Lifted out of index.html unchanged the day the waiting room needed to take
 * one too. It was a hundred and forty lines in a file behind the door, and the
 * room is in front of it — copying it would have meant two versions of the one
 * piece of code on this board that has been debugged against a real phone on a
 * real Chinese mobile connection, and the copy would have been the one that
 * stopped getting the fixes.
 *
 * Nothing here knows what the picture is for. It takes a file off an <input>
 * and gives back base64 the server will accept, or an error to show.
 */

import { T } from "/i18n.js";

/* A photograph, made fit to send.
 *
 * Three problems, one answer. An iPhone camera writes HEIC by default, which
 * the server does not accept and which no browser but Safari can display. A
 * photo off a modern phone is four or five megabytes, and base64 makes it a
 * third bigger again — which on a Chinese mobile connection is the difference
 * between a tap and a wait long enough to assume it failed. And a portrait
 * held sideways carries its rotation in EXIF, which some renderers honour and
 * some ignore.
 *
 * Drawing it to a canvas and re-encoding answers all three: whatever went in
 * comes out as JPEG, at a sensible size, already the right way up —
 * createImageBitmap applies the EXIF orientation rather than leaving it as
 * metadata for somebody else to interpret.
 *
 * A profile picture does not need four thousand pixels across. */
/* Getting JPEG bytes out of a canvas, in whichever way this browser can.
 *
 * canvas.toBlob is the good one, and WeChat's Android webview — an old Blink
 * fork — does not always have it. toDataURL is in every browser that has a
 * canvas at all, and since the bytes are going up as base64 anyway, it is
 * arguably the more direct route: it hands back base64 already, so the
 * blob-to-base64 step disappears with it.
 *
 * Returns { data, bytes } where data is base64 with no data: prefix, matching
 * what the server expects. */
async function encodeJpeg(canvas, quality) {
  if (canvas.toBlob) {
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", quality));
    if (blob) return { data: await asBase64(blob), bytes: blob.size };
  }
  let url;
  try {
    url = canvas.toDataURL("image/jpeg", quality);
  } catch { return null; }
  const comma = url.indexOf(",");
  if (comma < 0 || url.slice(0, 11) !== "data:image/") return null;
  const data = url.slice(comma + 1);
  // Base64 is four characters per three bytes, less the padding.
  return { data, bytes: Math.round(data.length * 3 / 4) };
}

export async function shrink(file, max) {
  /* Getting the pixels, three ways.
   *
   * createImageBitmap is the good one — it decodes off the main thread and
   * applies the EXIF rotation. But Safari has been fussy about the options
   * argument, and an option it does not know can throw rather than be ignored.
   * So: with options, then without, then an <img> element, which every browser
   * that can show a photograph can do.
   *
   * The first version of this caught the throw and sent the file raw, which
   * put it straight back into the bug it was written to fix — a silent
   * fallback to the broken path is worse than no fallback at all. */
  const draw = async () => {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch { /* Safari, probably the option */ }
    try {
      return await createImageBitmap(file);
    } catch { /* no bitmap decoding at all */ }
    // An <img> and an object URL. Slower, and it does not apply EXIF rotation
    // on older browsers, but it produces pixels where the other two did not.
    return await new Promise((ok, no) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error("decode")); };
      img.src = url;
    });
  };

  let src;
  try {
    src = await draw();
  } catch {
    // Nothing could read it — a HEIC in a browser that cannot decode HEIC is
    // the real case. Say so rather than pushing 5 MB up a mobile connection
    // and letting it time out.
    return { error: T("post.badPhoto") };
  }

  const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
  if (!iw || !ih) return { error: T("post.badPhoto") };

  const scale = Math.min(1, max / Math.max(iw, ih));
  const w = Math.round(iw * scale), h = Math.round(ih * scale);
  let shot = null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(src, 0, 0, w, h);
    shot = await encodeJpeg(canvas, 0.85);
  } catch { /* a canvas too large for this device, or a tainted one */ }

  if (!shot) {
    // The canvas gave us no JPEG at all. Sending the original is only worth
    // trying if it is small enough to arrive.
    if (file.size > 4 * 1024 * 1024) return { error: T("post.badPhoto") };
    return { data: await asBase64(file), type: file.type };
  }

  /* A hard ceiling, whatever the picture is.
   *
   * The route from a phone in China to a box in Tokyo drops packets, and a
   * large POST over a lossy link does not fail cleanly — it stalls until the
   * browser gives up and says "Load failed", which is indistinguishable from
   * every other network fault. So rather than trusting one resize to be
   * enough, this keeps going until the thing is small enough to arrive.
   *
   * A photograph nobody can upload is worth less than a slightly softer one
   * that arrives. */
  const CEILING = 900 * 1024;
  let side = Math.max(w, h), quality = 0.85;
  for (let pass = 0; shot.bytes > CEILING && pass < 4; pass++) {
    side = Math.round(side * 0.75);
    quality = Math.max(0.5, quality - 0.08);
    try {
      const cv = document.createElement("canvas");
      const r2 = side / Math.max(w, h);
      cv.width = Math.max(1, Math.round(w * r2));
      cv.height = Math.max(1, Math.round(h * r2));
      // Always redrawn from the original source, never from the last pass:
      // re-encoding a JPEG of a JPEG compounds the artefacts, and the source
      // is still in hand.
      cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
      const next = await encodeJpeg(cv, quality);
      if (!next) break;
      shot = next;
    } catch { break; }
  }
  if (src.close) src.close();
  return { data: shot.data, type: "image/jpeg" };
}

export function asBase64(file) {
  return file.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(bin);
  });
}
