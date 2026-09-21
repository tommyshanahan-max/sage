/* THE DECK AS A FILE, BECAUSE A LINK IS NOT ALWAYS THE RIGHT THING.
 *
 *   node scripts/deck-pdf.mjs potential [--board]
 *
 * A deck is a web page here and that is usually better: it opens on a phone,
 * the demo button works, and editing it does not break a link already sent.
 * But a page cannot be forwarded into a chat as an object, cannot be read on
 * a plane, and unfurls with whatever share card the host carries — which on
 * thexchange.app is the board's, so a Dealio deck previews as a networking
 * room. A PDF has none of those problems and none of the page's advantages.
 * Both, and let whoever is sending it choose.
 *
 * It lands beside the HTML on the same stem — d-<id>.html and d-<id>.pdf —
 * so the two addresses are as unguessable as each other and move together.
 *
 * ONE SLIDE PER PAGE, which does not happen by itself: the deck sizes its
 * sections with 100svh, and svh has no meaning on paper, so every section
 * collapses to its content and four slides land on one sheet. The print
 * stylesheet below pins the height and breaks after each one.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
/* A dynamic import, because an import specifier has to be a literal and this
   box keeps playwright-core outside the repo. PLAYWRIGHT names the module
   when it is not installed here; unset, the ordinary name is used. */
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright-core");

const name = process.argv[2] || "potential";
const ONBOARD = process.argv.includes("--board");
const SRC = path.resolve("cfm", "deck", name + ".html");
const OUT = ONBOARD ? path.join("board", "public") : path.join("cfm", "public");

/* The same name the HTML got, from the same map, so a deck's two files are
   one deck. Built by deck-build.mjs; run that first. */
const urls = JSON.parse(await readFile(path.join("cfm", "deck", "urls.json"), "utf8"));
const file = urls[name];
if (!file) {
  console.error("\n  No address for \"" + name + "\" yet. Run deck-build.mjs first.\n");
  process.exit(1);
}
const pdf = file.replace(/\.html$/, ".pdf");

/* Portrait, and close to the deck's own measure — .deck is 32rem wide, so a
   wider page is margin rather than deck. */
const W = 620, H = 1050;

const browser = await chromium.launch({
  executablePath: process.env.CHROME
    || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await (await browser.newContext({
  viewport: { width: W, height: H }, serviceWorkers: "block",
})).newPage();
await page.goto("file://" + SRC, { waitUntil: "load" });
await page.addStyleTag({ content: `
  @page { size: ${W}px ${H}px; margin: 0 }
  html, body { scroll-snap-type: none !important }
  html { scroll-behavior: auto }
  section { min-height: ${H}px !important; height: ${H}px !important;
    overflow: hidden; break-after: page; page-break-after: always }
  section:last-child { break-after: auto; page-break-after: auto }
` });
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(600);
const slides = await page.evaluate(() => document.querySelectorAll("section").length);
const bytes = await page.pdf({ width: W + "px", height: H + "px", printBackground: true });
await browser.close();

await writeFile(path.join(OUT, pdf), bytes);
const base = ONBOARD ? "https://thexchange.app" : "https://crowdfundme.app";
console.log("");
console.log("  " + base + "/" + pdf);
console.log("  " + slides + " slides, " + (bytes.length / 1024).toFixed(0) + " kB");
console.log("");
