/* THE PUBLIC JAVASCRIPT, STRIPPED AND ADDRESSED BY ITS CONTENT.
 *
 * WHAT THIS IS FOR. Every page on this board is a full load, and every one of
 * them imports /i18n.js — 570KB of it, of which 42% is comment. Served with
 * Cache-Control: no-cache, which is what the static handler has always sent,
 * that is a conditional request per file per navigation: on a phone in China
 * with a 300ms round trip, a visible stall before anything is drawn, every
 * time anybody moves between two screens. The note on that handler says
 * "they are a few kilobytes each", which was true when it was written and is
 * now wrong by two orders of magnitude.
 *
 * A file addressed by a hash of its own content can be kept for ever, because
 * a changed file is a different address. So: strip, hash, serve immutable,
 * and rewrite the import specifiers so the pages ask for the hashed name.
 *
 * ONE BUILD ID FOR EVERYTHING, not one hash per file. A page imports i18n.js
 * and i18n.js could import something else; if each file carried its own hash,
 * changing a leaf would change the leaf's address but NOT the address of the
 * file importing it — so a browser holding the old importer would ask for a
 * leaf URL that no longer exists, and the page would die on a 404 import.
 * Hashing everything together means any change moves every address. Deploys
 * are rare and a cold cache after one is the correct outcome.
 *
 * NOTHING IS MINIFIED. Only comments go. Renaming anything in a file this old
 * and this commented is a change nobody can review, and the win is the
 * caching rather than the bytes.
 */

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

/* COMMENTS COME OFF WITH A SCANNER, NOT A REGULAR EXPRESSION.
 *
 * /\/\*[\s\S]*?\*\// is the obvious way and it is wrong on this file: i18n.js
 * is 570KB of prose in string literals, and the first Chinese line containing
 * a slash-star, or an apostrophe inside a double-quoted string, silently eats
 * everything to the next close. A corrupted string table is a board that
 * renders in the wrong language with no error anywhere.
 *
 * So the input is walked once, in one of five states: code, a single-quoted
 * string, a double-quoted string, a template literal, or a comment. Inside a
 * string nothing is a comment; inside a comment nothing is a string. The only
 * genuinely hard case in JavaScript is telling a regex literal from a divide,
 * and it is handled the way every small scanner handles it — by what the last
 * significant character was.
 */
export function strip(src) {
  const n = src.length;
  let out = "";
  let i = 0;
  // The last character that was not whitespace, which is how a leading slash
  // is read as "start of a regex" or "divide".
  let prev = "";
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;                                   // the newline itself stays
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        // Newlines are kept so that every line number in a stack trace still
        // points at the line it points at in the file on disk.
        if (src[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += c; i++;
      while (i < n) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
        if (src[i] === q) { out += q; i++; break; }
        /* ${...} in a template can hold anything, comments and nested
           templates included. Rather than recurse, the scanner simply does
           not treat anything inside a template as code — which is safe,
           because the only thing being removed is comments and a comment
           inside an interpolation is not worth the risk of getting this
           wrong. */
        out += src[i]; i++;
      }
      prev = q;
      continue;
    }
    /* A slash here is the start of a regex literal only if the last
       significant character was one that cannot end an expression. After a
       name, a number or a bracket it is a divide. */
    if (c === "/" && "=([{,;:!&|?+-*%~^<>".includes(prev)) {
      // A regex literal: copy it whole, so a "//" or "/*" inside a character
      // class cannot be read as a comment.
      out += c; i++;
      let inClass = false;
      while (i < n) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] ?? ""); i += 2; continue; }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        else if (src[i] === "/" && !inClass) { out += "/"; i++; break; }
        else if (src[i] === "\n") break;          // not a regex after all
        out += src[i]; i++;
      }
      prev = "/";
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    out += c;
    i++;
  }
  /* Runs of blank lines left behind by a removed block become one. The file
     is still readable in a browser's source view, which matters the day
     somebody has to debug this on a phone. */
  return out.replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, "\n\n");
}

const short = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);

/** Read public/*.js, strip them, and address them all by one build id. */
export async function build(dir = "public") {
  const names = (await readdir(dir)).filter((f) => f.endsWith(".js"));
  const raw = new Map();
  for (const f of names) raw.set(f, strip(await readFile(dir + "/" + f, "utf8")));

  // One id over every file, in a stable order — see the note at the top.
  const id = short([...names].sort().map((f) => f + "\u0000" + raw.get(f)).join("\u0000"));

  /* The rewrite, applied to the stripped JS and later to every page. Longest
     name first so that /off.js cannot match inside /handoff.js. */
  const pairs = [...names].sort((a, b) => b.length - a.length)
    .map((f) => ['"/' + f + '"', '"/' + f.slice(0, -3) + "." + id + '.js"']);
  const rewrite = (s) => {
    for (const [from, to] of pairs) s = s.split(from).join(to);
    return s;
  };

  const files = new Map();      // served path -> body
  for (const f of names) files.set(f.slice(0, -3) + "." + id + ".js", rewrite(raw.get(f)));
  return { id, files, rewrite, names };
}
