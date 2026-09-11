/* Build a pitch deck into something that survives being sent to China.
 *
 *   node deck-build.mjs <name>        cfm/deck/<name>.html → cfm/public/d-*.html
 *
 * WHY THIS IS A BUILD AND NOT JUST A FILE. The page that gets sent has three
 * things the source does not, and every one of them was learned the hard way:
 *
 *   THE FONT COMES WITH IT. fonts.googleapis.com does not resolve in mainland
 *   China, so a linked display face arrives as Georgia on the one page where
 *   the typography is carrying the argument. Inlined as a data URI.
 *
 *   THE CARD. A link pasted into WeChat is scraped, not opened — with no
 *   og: tags it came out as a title and a grey box, which is the first
 *   impression of a company asking somebody for two years of their life.
 *   Absolute URLs, because a scraper has no page to resolve a relative one
 *   against.
 *
 *   AN UNGUESSABLE NAME. These carry a percentage, what the milestones are
 *   worth, and who owns the company today. Not a secret worth a login — it is
 *   a pitch and it will be forwarded — but not a thing to leave at /aiden.
 *   The name is kept between builds, so editing the deck does not break the
 *   link somebody was already sent.
 */
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const name = process.argv[2] || "aiden";
const SRC = path.join("cfm", "deck", name + ".html");
/* WHERE THE PAGE IS SERVED FROM, AND IT IS A DECISION PER DECK.
 *
 * Three addresses on this box and the domain is read before the deck is:
 *
 *   (default)   crowdfundme.app   the ledger the share offers live on. Right
 *               for Curt and Ian, who know what the address is. Wrong for a
 *               stranger, who reads "this man wants my money" before reading
 *               a word — see the note on which deck went where.
 *
 *   --board     liuxuesheng.io    the app itself. Where a member lands.
 *
 *   --site      thexchange.app    the product's public face, served by Caddy
 *               off disk with no container and no invitation gate behind it.
 *               The one to hand to somebody who has never heard of this.
 *
 * All three write a d-*.html with an unguessable name and all three keep it in
 * urls.json, so a link already sent keeps working whichever side it was built
 * for — and moving a deck between them means deleting the old file by hand.
 */
const ONBOARD = process.argv.includes("--board");
const ONSITE = process.argv.includes("--site");
const OUT = ONSITE ? "site"
  : ONBOARD ? path.join("board", "public") : path.join("cfm", "public");
const BASE = process.env.DECK_BASE
  || (ONSITE ? "https://thexchange.app"
    : ONBOARD ? "https://liuxuesheng.io" : "https://crowdfundme.app");

/* THE CARD SAYS THE COMPANY, NOT THE PERSON. <title> is "The Exchange for
   Aiden", which is right in a browser tab; the card is the half that gets
   forwarded and should not introduce him to people he has not told yet. */
const CARD = {
  title: "交换 · The Exchange",
  desc: "The people you need in China already know each other. This is the room.",
  image: "share-exchange.png",
};

const src = await readFile(SRC, "utf8");
const font = await readFile(path.join("cfm", "deck", "instrument.woff2"));

/* THE NAME A DECK ALREADY HAS, AND ONLY ITS OWN.
 *
 * A new name every build would break the link in somebody's chat window every
 * time a word changed, so the name is kept. The first version of this kept
 * "the existing d- file" — any of them — which was fine while there was one
 * deck and silently overwrote Aiden's page the moment there were two.
 *
 * So the mapping is written down, in the repo, beside the decks: which deck
 * owns which address. It is not a cache and it is not derivable — lose it and
 * every link already sent points at a page that no longer gets rebuilt. */
const MAP = path.join("cfm", "deck", "urls.json");
let urls = {};
try { urls = JSON.parse(await readFile(MAP, "utf8")); } catch { /* first run */ }
if (!urls[name]) {
  const taken = new Set(Object.values(urls));
  let pick;
  do { pick = "d-" + randomBytes(8).toString("hex").slice(0, 12) + ".html"; }
  while (taken.has(pick));
  urls[name] = pick;
  await writeFile(MAP, JSON.stringify(urls, null, 2) + "\n", "utf8");
}
const file = urls[name];

const title = (src.match(/<title>[\s\S]*?<\/title>/) || ["<title>Untitled</title>"])[0];
const body = src.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>/g, "")
  .replace(/<title>[\s\S]*?<\/title>/, "").trim();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#080C0A">
${title}
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Exchange">
<meta property="og:title" content="${CARD.title}">
<meta property="og:description" content="${CARD.desc}">
<meta property="og:image" content="${BASE}/${CARD.image}">
<meta property="og:image:width" content="640">
<meta property="og:image:height" content="640">
<meta property="og:url" content="${BASE}/${file}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${CARD.title}">
<meta name="twitter:description" content="${CARD.desc}">
<meta name="twitter:image" content="${BASE}/${CARD.image}">
<link rel="icon" href="${BASE}/${CARD.image}">
<style>
@font-face{font-family:'Instrument Serif';font-style:normal;font-weight:400;
  font-display:swap;
  src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2')}
</style>
</head>
<body style="margin:0">
${body}
</body>
</html>
`;

await writeFile(path.join(OUT, file), html, "utf8");
console.log("\n  " + BASE + "/" + file);
console.log("  " + (html.length / 1024).toFixed(1) + " kB, nothing loaded from off the box\n");
