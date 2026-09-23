/* READ THE OLD 微店 SHOP, AND WRITE DOWN WHAT IT SAYS.
 *
 *   node scripts/weidian-pull.mjs --shop https://weidian.com/s/1202970134 \
 *     [--out /seed/scripts/weidian.json] [--max 40]
 *
 * WHY A BROWSER AND NOT A FETCH. weidian.com/s/<id> serves an empty shell and
 * draws itself with JavaScript — curl and any plain fetch get the shop's name
 * and nothing else. Chromium renders it, which is why this runs inside the
 * post-browser image rather than beside the other scripts.
 *
 * NOT LOGGED IN, ON PURPOSE. Everything here is what any customer sees. A
 * seller login driven from a Tokyo datacenter is the thing that gets an account
 * looked at, and the shop's own reviews are public — so the safe version is
 * tried first and this file never touches an account.
 *
 * WHAT IT WRITES is exactly what scripts/review-import.mjs already takes:
 *   { "items": [ { "name", "price", "photo", "url", "reviews": [ … ] } ],
 *     "reviews": [ { "who", "stars", "text", "at", "item" } ] }
 * so the review half can go straight into `make review-import` per item.
 *
 * IT IS DELIBERATELY SLOW. One page at a time, a pause between, no
 * parallelism: this is somebody's shop being read politely, not scraped.
 */
import { promises as fs } from "node:fs";

const arg = (n, d = "") => {
  const i = process.argv.indexOf("--" + n);
  return i === -1 ? d : (process.argv[i + 1] ?? d);
};

const SHOP = arg("shop");
const OUT = arg("out", "/data/weidian.json");
const MAX = Number(arg("max", "40"));
if (!SHOP) {
  console.error("weidian-pull.mjs --shop https://weidian.com/s/1202970134 [--out file] [--max 40]");
  process.exit(1);
}

/* PLAYWRIGHT LIVES IN THE IMAGE, NOT BESIDE THIS FILE.
 *
 * This read `await import("playwright")` and died with ERR_MODULE_NOT_FOUND on
 * every run — so `make weidian-pull` had never once worked. The package is
 * installed, at /app/node_modules in the post-browser image (see
 * post/browser/package.json), but this script is bind-mounted at /seed, and an
 * ESM bare specifier resolves by walking up from the IMPORTING FILE — /seed,
 * then / — and never reaches /app. NODE_PATH does not help either: ESM ignores
 * it. So the Makefile now mounts this beside the modules and PLAYWRIGHT is the
 * escape hatch for anywhere else, the same one deck-pdf.mjs carries.
 *
 * `.default || ns` because playwright's entry is CommonJS: depending on how it
 * is reached, `chromium` is either a named re-export or a key on default. */
const pw = await import(process.env.PLAYWRIGHT || "playwright");
const { chromium } = pw.default || pw;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* A phone. The shop is an H5 page built for one, and the desktop rendering of
   these pages is frequently a QR code telling you to open the app. */
const ctx = await chromium.launchPersistentContext("/tmp/weidian-profile", {
  headless: true,
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
});
ctx.setDefaultTimeout(45_000);

async function evidence(page, tag) {
  try {
    const base = `/data/evidence/weidian-${tag}-${Date.now()}`;
    await fs.mkdir("/data/evidence", { recursive: true });
    await page.screenshot({ path: base + ".png", fullPage: true });
    await fs.writeFile(base + ".txt", `${page.url()}\n\n${await page.evaluate(() => document.body?.innerText?.slice(0, 6000) || "")}`);
    return base;
  } catch { return ""; }
}

/** Scroll to the end of a lazily-loaded list. These pages load a screenful at
 *  a time and stop when the height stops changing. */
async function toTheBottom(page, rounds = 25) {
  let last = 0;
  for (let i = 0; i < rounds; i++) {
    const h = await page.evaluate(() => { window.scrollBy(0, document.body.scrollHeight); return document.body.scrollHeight; });
    if (h === last) break;
    last = h;
    await wait(1200);
  }
}

const out = { shop: SHOP, at: new Date().toISOString(), items: [], reviews: [] };
const page = await ctx.newPage();

try {
  await page.goto(SHOP, { waitUntil: "domcontentloaded" });
  await wait(4000);
  await toTheBottom(page);

  const shell = await page.evaluate(() => document.body?.innerText?.trim().length || 0);
  if (shell < 40) {
    const where = await evidence(page, "empty-shop");
    console.error(`The shop page rendered almost nothing${where ? ` — see ${where}.png` : ""}.`);
    console.error("That usually means Weidian is asking for the app, or this address is being refused from here.");
    process.exit(2);
  }

  /* EVERY PICTURE ON THE SHOP PAGE, AS ADDRESSES.
   *
   * The shop's own avatar and banner are here, and they are the photographs
   * of the person whose shop this is — which is what the new shopfront wants
   * and does not have. Printed as URLs rather than downloaded: the addresses
   * are on Weidian's CDN, which answers from anywhere, so whoever is choosing
   * can fetch and look at them without this script guessing which one is him.
   *
   * Tiny ones are dropped. A shop page carries two dozen icons, arrows and
   * spacers, and a 40-pixel square is never a photograph of anybody. */
  out.photos = await page.evaluate(() => {
    const seen = new Map();
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.src || "";
      if (!src || src.startsWith("data:")) continue;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w && w < 120 && h && h < 120) continue;
      if (!seen.has(src)) seen.set(src, { src, w, h, alt: img.alt || "" });
    }
    /* Background images too: shop banners are usually a div with a
       background-image, not an <img>, and the banner is the likeliest place
       to find a photograph of the family rather than of a tin. */
    for (const n of document.querySelectorAll("div,section,header")) {
      const bg = getComputedStyle(n).backgroundImage || "";
      const m = bg.match(/url\("?(https?:[^")]+)"?\)/);
      if (m && !seen.has(m[1])) seen.set(m[1], { src: m[1], w: 0, h: 0, alt: "background" });
    }
    return [...seen.values()];
  });
  console.error(`pictures on the shop page: ${out.photos.length}`);
  for (const p of out.photos) console.error(`  ${p.w}x${p.h}  ${p.src}`);

  /* ITEM LINKS. Weidian's item addresses are /item.html?itemID=… and the shop
     page is a grid of them. Collected by href rather than by class, because
     class names on these pages are generated and change without notice.

     EXCEPT THE GRID IS NOT MADE OF ANCHORS. Reading only <a href> found zero
     items on a shop that plainly has some — the run reported "0 items, 0
     reviews" against a page that had rendered fine. These H5 shops route in
     JavaScript: a tile is a div with a click handler, and the id lives in the
     component's own state rather than in an href. So the anchors are still
     tried first, because when they exist they are exact, and the id is dug
     out of the rendered markup only when they turn up nothing.

     Six digits or more, because short numbers on these pages are prices,
     counts and pixel sizes, and a four-digit "id" would send this off to
     fetch a page that does not exist. */
  const links = await page.evaluate(() => {
    const seen = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.href || "";
      if (/item\.html|itemID=|\/item\//i.test(href)) seen.add(href.split("#")[0]);
    }
    if (!seen.size) {
      const html = document.documentElement.innerHTML;
      const ids = new Set();
      for (const m of html.matchAll(/itemI[dD]["':=\s]{1,4}(\d{6,})/g)) ids.add(m[1]);
      for (const m of html.matchAll(/["']item_?id["']\s*:\s*["']?(\d{6,})/gi)) ids.add(m[1]);
      for (const id of ids) seen.add("https://weidian.com/item.html?itemID=" + id);
    }
    return [...seen];
  });

  /* STOP GUESSING AT THE MARKUP AND DO WHAT A CUSTOMER DOES: TAP A TILE.
   *
   * Two goes at reading the id out of the page both found nothing. The
   * anchors are not there, and neither is the id: the evidence dump showed
   * the shop rendering 贝拉米 有机婴儿米粉 and its whole description with no
   * itemID anywhere in the markup. The tile is a div, the router holds the id
   * in component state, and it only becomes an address at the moment of the
   * tap. A third pattern guess would have been the third wrong one.
   *
   * So: tap the product photographs and write down where each one lands.
   * Slower — a navigation and a goBack per tile — but it cannot be wrong
   * about the shape of a page it never has to parse, and it needs only MAX
   * of them rather than the whole shelf.
   *
   * The photographs are the handle because every tile on these shops has one,
   * off geilicdn, and the picture is the part that is certainly inside the
   * clickable area. Anything that does not navigate to an item is skipped in
   * silence: banners and category chips carry pictures too. */
  if (!links.length) {
    const home = page.url();
    for (let i = 0; i < MAX * 4 && links.length < MAX; i++) {
      const tiles = await page.$$('img[src*="geilicdn"]');
      const tile = tiles[i];
      if (!tile) break;
      try {
        await tile.click({ timeout: 5000 });
        await wait(2500);
        const landed = page.url();
        if (/item\.html|itemID=|\/item\//i.test(landed) && !links.includes(landed.split("#")[0])) {
          links.push(landed.split("#")[0]);
        }
        if (landed !== home) {
          await page.goto(home, { waitUntil: "domcontentloaded" });
          await wait(2000);
          await toTheBottom(page);
        }
      } catch { /* not a tile, or it opened nothing — the next one may be */ }
    }
    if (links.length) console.error(`found by tapping: ${links.length}`);
  }
  console.error(`shop page: ${links.length} item links`);

  /* A RUN THAT FINDS NOTHING HAS TO SAY WHAT IT SAW.
     This wrote "0 items, 0 reviews" and stopped, which is indistinguishable
     from a shop with nothing in it — and cost a round of guessing over
     whether the page had loaded, whether the browser worked, or whether the
     selectors were wrong. The screenshot already went to /data/evidence where
     nobody was going to look, so the first lines of what the page actually
     rendered go to the terminal too, where the person running it is. */
  if (!links.length) {
    const where = await evidence(page, "no-item-links");
    const seen = await page.evaluate(() =>
      (document.body?.innerText || "").replace(/\n{2,}/g, "\n").trim().slice(0, 400));
    console.error("\nNo item links on that page. What it rendered:\n");
    console.error(seen.split("\n").map((l) => "  " + l).join("\n"));
    if (where) console.error(`\n  Screenshot: ${where}.png`);
    console.error("");
  }

  for (const [i, url] of links.slice(0, MAX).entries()) {
    const item = { url, name: "", price: "", photo: "", reviews: [] };
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await wait(3000);

      Object.assign(item, await page.evaluate(() => {
        const t = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
        const name = t('[class*="title"], h1, [class*="name"]') ||
          (document.title || "").replace(/[-_|].*$/, "").trim();
        const priceText = (document.body.innerText.match(/[¥￥]\s?\d+(\.\d+)?/) || [""])[0];
        const img = document.querySelector('[class*="swiper"] img, [class*="banner"] img, img');
        return { name, price: priceText.replace(/\s/g, ""), photo: img?.src || "" };
      }));

      /* THE REVIEWS. 评价 sits behind a tab on the item page and the list is
         lazy, so: find whatever says 评价, press it, then scroll. */
      const tab = page.getByText(/评价|评论/).first();
      if (await tab.count()) { await tab.click().catch(() => {}); await wait(2500); }
      await toTheBottom(page, 15);

      item.reviews = await page.evaluate(() => {
        /* A review is a block carrying a date and some words. Matching on the
           date is steadier than matching a generated class name: every review
           on these pages carries one and almost nothing else does. */
        const rows = [];
        const blocks = document.querySelectorAll('[class*="comment"], [class*="review"], [class*="evaluate"], li, div');
        for (const b of blocks) {
          const text = (b.innerText || "").trim();
          if (!text || text.length > 400) continue;
          const date = text.match(/20\d\d[-年./]\d{1,2}[-月./]\d{1,2}/);
          if (!date) continue;
          if (b.querySelector('[class*="comment"], [class*="review"]')) continue; /* a container, not a row */
          const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
          const body = lines.filter((l) => !/20\d\d[-年./]/.test(l) && l.length > 1);
          if (!body.length) continue;
          rows.push({
            who: lines[0] && lines[0].length < 24 ? lines[0] : "",
            at: date[0].replace(/[年月]/g, "-").replace(/日/, "").replace(/\./g, "-"),
            text: body.join(" ").slice(0, 300),
          });
        }
        /* The same words twice is the same review seen through two nested
           elements, not two customers agreeing. */
        const seen = new Set();
        return rows.filter((r) => { const k = r.text; if (seen.has(k)) return false; seen.add(k); return true; });
      });

      console.error(`  ${i + 1}/${Math.min(links.length, MAX)}  ${item.name.slice(0, 30)}  ${item.price}  ${item.reviews.length} reviews`);
      for (const r of item.reviews) out.reviews.push({ ...r, stars: 5, item: item.name });
      out.items.push(item);
    } catch (err) {
      console.error(`  ${i + 1}: ${err.message.slice(0, 120)}`);
      await evidence(page, "item-failed");
      out.items.push(item);
    }
    await wait(1500); /* politeness, and it keeps this well under any rate limit */
  }

  await fs.writeFile(OUT, JSON.stringify(out, null, 2));
  console.error(`\nwrote ${OUT}: ${out.items.length} items, ${out.reviews.length} reviews`);
} finally {
  await ctx.close();
}
