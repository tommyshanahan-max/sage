/* WHAT IS TURNED OFF, IN ONE PLACE.
 *
 * A board for six people was carrying the surfaces of a board for ten
 * thousand: Browse, Cards, Messages, Profile, rooms, the feed, groups,
 * offers, levels, the waiting room, seats, agents. Every one of them is code
 * that has to stay true, and most of them had nobody to be true for.
 *
 * HIDDEN, NOT DELETED. Each of these works; none of them is finished with.
 * Turning one back on is changing `true` to `false` on its line here, and
 * nothing else — which is the whole reason this file exists rather than the
 * draws being commented out where they happen. Anything that reads a flag
 * says so with a comment pointing back at this file.
 *
 * WHAT STAYS ON, and why, because the temptation is to cut these too:
 *   rooms      — /r/<room> is where a shared profile lands a stranger and
 *                where ?via= credit happens. It is the way in, not a feature.
 *   waiting    — forty-seven real people are standing in it.
 *   agents     — a day old, with a live case on it.
 */
export const OFF = {
  /* THE CROWNS. A game layer on a board whose pitch is serious people doing
     cross-border work; a crown beside a name argues against the thing the
     name is there to do. Four files drew it.

     NOT /level, WHICH I FIRST TOOK THIS FOR. That page is the four-question
     language test, and the waiting room links to it in JS rather than as an
     href — which is why a grep for href="/level" found nothing and I called
     it an orphan. It gives somebody a band, which is one of the few things a
     member vouching has to read, and it is the waiting room's own growth
     mechanic. It stays on. */
  crowns: true,

  /* GROUPS. A page, a route, a table and a link in the nav, for something
     nobody has used. */
  groups: true,

  /* SEATS AND WHAT A SEAT IS WORTH. A promise about being early, made to six
     people. It is honest and it is not wrong — there is simply nothing yet to
     be early to, and a number about value with no value behind it is the one
     kind of claim this board must not make. */
  stake: true,

  /* OFFERS. The deal pinned over a conversation, /o/ codes, the six-line
     thread an accepted offer opens. Real work, and none of it has closed a
     deal yet. The machinery stays; the way in is closed. */
  offers: true,

  /* THE FEED. Already dark — the tab is hidden, /feed redirects a cold
     arrival to Browse, and the ＋ that opened its composer now opens the
     invite. This says so out loud rather than leaving it as three separate
     accidents.
     NOTE BEFORE DELETING ANY OF IT: standing() counts posts made this week as
     part of earning an invite code. Take the posts away and the invite
     economy loses a leg. That test needs replacing first. */
  feed: true,
};
