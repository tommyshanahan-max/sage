# The room ledger — a design, not a deploy

Sent over from another of Tom's sessions so this repo has the exact design.
Nothing in this folder is served, built or deployed; this branch exists only to
carry it.

- `exchange-room-demo.html` — the design as Tom shows it to people. The Film &
  TV door room, using notes.html's own styles and markup, with the 50,000 ledger
  pinned across the top. Invented people and numbers, no network calls. Open it
  in a browser.
- `ledger-pin.js` — the widget as built into notes.html locally: five views in
  one pin (overview, rules, join, what happens at 50,000, what's recorded),
  English and Chinese, one button with a full-sentence VoiceOver label, focus
  moved to each view's heading, and no repaint on the 20-second door refresh
  unless a number changed.
- `app-changes.diff` — the notes.html and server.js changes against 35d1c18:
  `GET /api/ledger/pin`, `POST /api/ledger/join`, off unless
  `BOARD_LEDGER_GOAL` is set.
- `fifty-thousand-ledger.html` — the walkthrough with the levers (curve, split,
  place) and the notes on why each screen is built the way it is.

The model: a place number from the day a page goes up; place points
`round(1000 ÷ place^0.35)`, so #1 = 1,000 and #50,000 = 23; plus activity at
the seat ledger's weights, first 10 guests only. 70% of a pool split by place
(divided by all 50,000 places, so it never falls), 30% by activity at a
cut-off. The copy says the company intends a share offer at 50,000 — which
counsel has not seen, and which the layers work already on the live branch
deliberately does not say.
