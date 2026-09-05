# Mockups

Not built yet, and not wired to anything. Open the file.

Each of these is a single self-contained HTML file with no build step and no
external requests, for the same reason everything else here is: a page that
cannot reach a CDN from mainland China is a page that arrives unstyled. They
carry their own fake data so they open and look right on their own.

The point of keeping them in the repository rather than in a chat is that a
mockup is a decision written down. When the thing gets built, the argument for
why it looks like that is in here, in the file, next to the thing it argues
about.

## social.html

The Social panel, from the Jrend Tap deck, pointed at the catalogue Study Pal
already has rather than at third-party merchandise.

Three views, deep-linkable — `#home`, `#feed`, `#people`.

What it asserts, so it can be argued with:

- **A share is for a named person, and carries their code.** `?via=mia&to=ep3`
  says who shared it and what it points at. WeChat strips referrers, so this is
  the only signal that survives being forwarded.
- **Sent → reshared → arrived.** The engine in the deck is not that you post,
  it is that somebody else does, to an audience you do not have. Only the last
  of those three figures is flattering.
- **Tag the catalogue, not merchandise.** The deck tags handbags, which needs
  merchants, inventory and a payments business first. The series on the shelf
  and the features in the app are already yours.
- **No wallet.** The deck withdraws in foreign currencies and bitcoin. Moving
  money across the Chinese border is a licensed business, not a feature.
- **Channel credentials stay out of the platform.** Posting to WeChat needs
  WeChat's token, and this box should not hold tokens for someone else's
  accounts — the same call already made for Seedance, which reaches Sage
  through the microdrama project rather than living here.

What it needs that does not exist:

- Study Pal has to record `via` on first arrival and report it. Nothing
  generates those codes and nothing reads them, which is why the dashboard's
  "Who sent them" panel still says *not reported by the app yet*. Until that
  lands, every arrival figure in the mockup is invented.
- Somewhere to keep a person — name, channel, code, what has been sent. A file
  beside `series.json`, in the project that owns the relationship.
- The Sharing / Slowing / Stalled states are a guess. Real thresholds need real
  reshare data, which is the same blocker as above.
