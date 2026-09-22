# Mirroring the Weidian shop onto aozhoubaba

A brief for a session with a browser and network access. Everything here is
doable **without any Weidian API key**, because the half that matters is a
public web page.

Read `CLAUDE.md` first. It is not optional and it decides what counts as
finished.

## What this is for

aozhoubaba.com is the storefront. Weidian is where the money is taken, because
Weidian already has the merchant account, the 收款码 and the buyer's trust.
The buyer browses in English on a real shop, and goes to Weidian to pay. That
is the whole design and it is why no ICP licence and no merchant number are
needed for it to work.

The missing piece is the join: **which aozhoubaba product is which Weidian
item.** One field, kept honest by a command that can be re-run.

## The shop

    https://weidian.com/?userid=1175716454

Public. No login, no keys. A product page is
`weidian.com/item.html?itemID=<id>` and that id is what everything here turns
on.

**Test that page is reachable before anything else.** If the network policy
blocks it, say so and stop — do not build against a guess. The client in
`board/lib/weidian.js` deliberately does not guess response field names, for
the same reason.

## What to build

### 1. A reader

`scripts/weidian-scan.mjs` — fetch the shop, walk the products, write JSON:

    { itemId, name, price, image, url }

Prices in **fen** (integers), matching `fen()` in `board/lib/shop.js`. Never a
float; a price is money and money is not a float.

Playwright is already on the box. See `CLAUDE.md` for where Chromium lives and
the flags it needs. If the page renders its products from JSON in the HTML,
read the JSON — it is more stable than the markup around it.

### 2. One new field

`cleanProduct` in `board/lib/shop.js` currently holds:

    id, name, price, at, unit, en, photo, kind, out, off

Add **`wd`** — the Weidian item id, digits only, 32 characters maximum. Absent
means this product has no Weidian item and must not offer checkout.

Follow the file's house style: the comment says *why*, including what was
tried and what broke.

### 3. The join

`scripts/weidian-sync.mjs`, wrapped in `make weidian-sync`:

- Every scraped item matched to an existing product, by `wd` first, then by an
  exact Chinese name match.
- Unmatched items become new products — `name`, `price`, `photo`, `wd` filled,
  `en` and `kind` left blank.
- Products whose Weidian item has gone get `out: true`. **Never delete one.**
  The comment on `out` says why: a storefront that linked to it has to be able
  to say sold out rather than serve a page that is gone.
- Prices that have moved are reported, not silently written. A price changing
  under somebody mid-order is a different bug.
- Safe to run twice. It works out what is already there.

### 4. Filling the blanks

`en` and `kind` are the two fields a scrape cannot supply, and `kind` is the
one that turns a list of eight things into a shop. The comment on it is
explicit that string matching cannot do this — "爱他美" is milk powder and no
amount of matching knows that.

So: propose them, print them, let Tom approve in one command. Do not write
guesses into the ledger.

### 5. Checkout goes to Weidian

`board/public/shop.html:1043` sends the buyer to `/shop/<handle>/checkout`.
For a product with a `wd`, the buy button goes to
`weidian.com/item.html?itemID=<wd>` instead.

Read `board/DEALIO.md` rule 6 before touching this. And read the QR note in
`board/lib/qr.js` — **the Chinese payer already knows how to pay**. Do not
write a string that explains their own wallet back to them.

## What this does NOT do, and say so plainly

The order is placed on Weidian, so **aozhoubaba never sees it.** No order row,
no shipping address, no order list. Reading orders back needs the Weidian API,
which needs an appkey and a secret, which is the thing that is actually
blocked. `board/lib/weidian.js` is written and waiting for them.

Do not paper over this. A storefront that quietly loses the order is worse
than one that hands the buyer over honestly.

## How it is handed to Tom

One command, not a recipe. He is visually impaired — see the "Fewer steps"
section of `CLAUDE.md`, which is not a preference to accommodate but the thing
that decides whether the work is finished.

    make weidian-sync          read the shop, show what changed
    make weidian-sync GO=1     write it

Print what happened. Do not ask for a screenshot.
