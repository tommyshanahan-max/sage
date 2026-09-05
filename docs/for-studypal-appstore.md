# What the App Store needs before Study Pal can be submitted

For the session working on Study Pal. Global storefront only — the mainland
China store needs an ICP filing and a Chinese entity, which is a different and
much larger piece of work.

The app itself is approvable. It has real device features doing real work —
speech, camera, translation — which is what most rejected apps lack. What will
get it turned away is the social feed, and specifically four things Apple
requires of any app where people can post.

Check the current text of Guidelines 1.2, 4.2, 5.1.1 and 5.1.2 before building
against this: they move, and this was written from what they said at the time.

## 1. Report a post — Guideline 1.2

The one reviewers actually test. They open the feed, try to report something,
and reject the app if they cannot.

Needs: a control on every post that a signed-in reader can press, a place to
say what is wrong in their own words, and a confirmation that it was received.

**This half is built.** Send it to the admin as a webhook event:

```json
{
  "event": "reported",
  "at": "2026-09-06T00:10:00Z",
  "post": { "id": "abc123", "report": "why they objected", "by": "<reporter id>" }
}
```

`report` carries the reporter's own words — not a category. "That is a photo of
my restaurant and I did not agree to it" is the whole story and a dropdown
would lose it. The reported post then leads the admin's queue, ahead of held
ones: a held post is not live and nobody is waiting, a reported one is live and
somebody has objected.

The guideline expects action within 24 hours. The admin is where that happens,
which is why the report has to arrive there rather than in a mailbox.

## 2. Block a user — Guideline 1.2

A reader must be able to stop seeing another account's posts, from the post or
from the account. Purely your side; the admin has no part in it and should not.

## 3. Delete an account — Guideline 5.1.1(v)

If people have accounts, they must be able to delete one **from inside the
app** — not by emailing, not by a web form, not by asking support. It has to
remove the account and its data, and it has to be reachable in a few taps from
the app's own settings.

Worth telling the admin when it happens, so the roster does not keep offering
an account that no longer exists. A `removed` event on that account's id would
do; say if you would rather shape it differently.

## 4. Privacy — Guideline 5.1.1 and the App Store listing

- A privacy policy at a live URL, linked in the app and in App Store Connect.
- Purpose strings for microphone and camera that say what actually happens,
  including that audio leaves the device: "Study Pal records what you say and
  sends it to be translated" rather than "for a better experience". Vague ones
  get rejected on sight.
- The privacy nutrition label filled in honestly, matching what the app really
  collects.

## Also worth doing now rather than later

**Sign in with Apple — 4.8.** Not required today. It becomes required the
moment you add any third-party login (WeChat, Google, Apple ID from another
service). Cheaper to design the account model for it now than to retrofit.

**Not a wrapper — 4.2.** A WKWebView pointed at liuxuesheng.help is the
textbook rejection. Capacitor or React Native with native microphone and camera
is fine, and the app genuinely uses both, which is the argument that wins.

**TestFlight before submitting.** Up to 10,000 testers, and a rejection there
costs nothing.

## Order

1 and 3 are the two that block submission and are both small. 2 is small and
also blocking. 4 is paperwork but takes a day to get right. The wrapper
question is the only one that is real work.

Related: `for-studypal-publish.md`, `for-studypal-hook.md`.
