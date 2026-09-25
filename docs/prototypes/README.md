# Prototypes — 26 Sep 2026

Standalone pages. Open them in a browser; nothing here is wired to the board,
and the numbers in all three are invented.

| | |
|---|---|
| `pyramid.html` | the affiliate tree as a rotatable 3D pyramid |
| `portal.html` | the wallet and the pyramid as one app, four phone screens |
| `pyramid-conserved.html` | the same tree as a true image pyramid — kept for the comparison, not for shipping |

**The idea worth keeping is in `pyramid.html`: the viewer is the vertex.** The
same page rooted at whoever opens it — we see everything, an affiliate sees
only what is beneath them, and tapping a tile re-roots it on that person. That
scoping has to be enforced in the query, never by leaving rows out of the page.

**Why these are here and not in `board/`.** They were drawn for a partner
deal that `NOW.md` says should not be built — see *WHAT ALGOTECH ACTUALLY
SELLS*. The visualisation outlives that: the shop already pays storefront
commissions one level deep (`make owed`, `scripts/owed.mjs`), and this is the
same thing with a tree behind it. Wiring it to `lib/books.js` and the real
ledger is the next step if anybody wants it.

**No dependencies, on purpose.** The 3D is about eighty lines of hand-written
projection rather than three.js: every script a page loads is one that can
404, and the agent container has no route to a CDN, so a library version could
never have been looked at before being handed over.

Two things that were got wrong and fixed, so nobody re-introduces them:

- **One cell size for the whole pyramid, not one per plane.** The plane used
  to be a fixed width its cells divided up, so a square was wider on one level
  than another and two people earning the same drew different volumes. In 3D
  the eye reads volume. Now the square is the constant and the plane is
  whatever its people need.
- **Height is the only encoding.** Not curvature, not footprint. Tiles share a
  baseline so they can be compared by eye.
