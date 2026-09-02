// Documents a partner is allowed to read.
//
// An explicit list, never a directory scan. Scanning would be less to configure
// and wrong: a repository's docs folder holds working notes as readily as it
// holds anything meant for someone else, and the first thing a new file does
// under that design is publish itself. Naming each one costs a line and means a
// document reaches a partner because somebody decided it should.
//
// Configured as AGENT_DOCS: one entry per line, path relative to the snapshot,
// optionally `path=Title` when the filename is not what you would call it.
//
//   docs/product-brief.md=The brief
//   deploy/fern/README.md
//
// Paths are resolved and then checked to still be inside the snapshot, so a
// `../` in the configuration cannot reach past it.

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Parses the configured list into { id, file, title } entries. */
export function parseDocList(raw, root) {
  const out = [];
  for (const line of String(raw || "").split(/[\n,]/)) {
    const entry = line.trim();
    if (!entry) continue;
    const eq = entry.indexOf("=");
    const rel = (eq === -1 ? entry : entry.slice(0, eq)).trim();
    const title = eq === -1 ? "" : entry.slice(eq + 1).trim();
    if (!rel) continue;

    const file = path.resolve(root, rel);
    // Configuration is trusted more than a request, but not blindly: a stray
    // `../` here would quietly widen the seat, which is the one thing this
    // whole design is for.
    if (file !== root && !file.startsWith(root + path.sep)) continue;

    out.push({
      // A short opaque id keeps the path out of the URL, so the shape of the
      // repository is not published to somebody who was given one file from it.
      id: Buffer.from(rel).toString("base64url"),
      rel,
      file,
      title: title || path.basename(rel).replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]/g, " "),
    });
  }
  return out;
}

/** Those that exist, with their sizes and dates. A configured document that is
 *  missing is left out rather than listed as an error: the usual cause is a
 *  snapshot that has moved on, and a dead row helps nobody. */
export async function listDocs(entries) {
  const found = [];
  for (const e of entries) {
    try {
      const info = await stat(e.file);
      if (!info.isFile()) continue;
      found.push({ id: e.id, title: e.title, rel: e.rel, updatedAt: info.mtime.toISOString() });
    } catch {
      /* not in this snapshot */
    }
  }
  return found;
}

export async function readDoc(entries, id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return null;
  try {
    return { ...entry, text: await readFile(entry.file, "utf8") };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Markdown
//
// A small renderer rather than a dependency. It covers what these documents
// actually use — headings, paragraphs, lists, code, emphasis, links, rules —
// and nothing else.
//
// The order matters more than the coverage: everything is escaped first, so no
// text from a document can become markup. Formatting is then applied to the
// escaped string, which means the worst a hostile document can do is look odd.
// ---------------------------------------------------------------------------

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");

// Only http(s) and anchors. `javascript:` in a link is the oldest trick there
// is, and a document is exactly the kind of thing somebody else wrote.
const safeHref = (h) => (/^(https?:\/\/|#|\/)/i.test(h.trim()) ? h.trim() : "#");

const inline = (s) =>
  s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) =>
      `<a href="${escape(safeHref(h))}" rel="noopener noreferrer" target="_blank">${t}</a>`);

export function renderMarkdown(src) {
  const lines = escape(String(src)).split("\n");
  const out = [];
  let inCode = false;
  let listType = null;
  let para = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };

  for (const line of lines) {
    if (/^```/.test(line)) {
      flushPara(); closeList();
      out.push(inCode ? "</code></pre>" : "<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(line); continue; }

    if (!line.trim()) { flushPara(); closeList(); continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara(); closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushPara(); closeList();
      out.push("<hr>");
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const want = bullet ? "ul" : "ol";
      if (listType !== want) { closeList(); out.push(`<${want}>`); listType = want; }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }

    if (/^&gt;\s?/.test(line)) {
      flushPara(); closeList();
      out.push(`<blockquote>${inline(line.replace(/^&gt;\s?/, ""))}</blockquote>`);
      continue;
    }

    closeList();
    para.push(line.trim());
  }
  flushPara(); closeList();
  // A document ending inside a fence would otherwise leave the tag open.
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}
