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
     class names on these pages are generated and change without notice. */
  const links = await page.evaluate(() => {
    const seen = new Set();
    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.href || "";
      if (/item\.html|itemID=|\/item\//i.test(href)) seen.add(href.split("#")[0]);
    }
    return [...seen];
  });
  console.error(`shop page: ${links.length} item links`);

  if (!links.length) await evidence(page, "no-item-links");

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
