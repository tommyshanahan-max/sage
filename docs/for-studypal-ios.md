# Study Pal on iOS: what v1 is, and what it deliberately is not

For the session working on Study Pal. This replaces the scope in
`for-studypal-appstore.md`, which was written before the goal was clear and is
over-scoped for it.

## The goal, stated plainly

**The web app does not change.** Not one screen, not one route. It works inside
the mainland, it needs no account and no VPN, and that is most of the reason it
exists — the README says so in its second line and that has not changed. Every
"cut" and "excluded" below means *from the iOS build*, and never from the site.

The iOS build is a shop window. It exists so that Study Pal can be found in the
App Store, which is what makes it real to an investor. Nobody will open it in a
pitch. Feature parity with the web app is not the point and pursuing it would
cost weeks for nothing.

## What ships

Talk, Translate, Ask, Camera, and everything that lives on the device —
history, phrases, flashcards, the profile. Those work offline, which is a real
argument against the "this is just a website" rejection and worth keeping
whole.

Nothing where one person's content reaches another person's screen.

## What does not, and why

**The social feed — from the iOS build only.**

Read that twice before touching anything. The feed stays on the web, live,
exactly as it is. Nothing about liuxuesheng.help changes. This is a build
configuration for one distribution channel, not a decision to remove a working
feature that people are using today. If a change to this would delete feed code,
delete a route, or take a screen off the website, it is the wrong change.

Excluded from the native build, then. Not because the feed is unfinished —
because an app with a public feed must carry, and be seen to carry, four
things: a content filter, a
way to report a post, a way to block a user, and published contact details.
Reviewers test the report button. The clock on acting on a report is a day.

None of that is hard, and it is all worth building — but it is a fortnight of
work in exchange for a screen nobody is going to look at in a pitch. It goes in
1.1, once report and block exist. `for-studypal-appstore.md` has the detail for
when that day comes; the admin side of report is already built and waiting.

**And the same goes for faces.** `ShareFace` — the opted-in photos that appear
on other people's screens — is user-generated content in exactly the sense the
guideline means: a picture of a real person, shown to strangers. Cutting the
feed and leaving this in does not solve the problem. A reviewer who finds
photos of people with no way to report one has found the same violation by
another door.

It is a smaller cut than the feed and the same reasoning applies: opt-in, well
built, worth keeping on the web, and out of the native build until report and
block exist.

Anything else where one person's content reaches another person's screen goes
too. The test is not "is it a feed", it is "can a stranger's words or picture
appear in front of me".

**One thing to get right:** the feed and faces must be *absent* from the native
build, not linked out of it. A button that opens the feed in Safari puts you back in
scope, and reviewers notice. One codebase with the routes unreachable in the
native build, not a fork.

## The part that is actually work

A WKWebView pointed at liuxuesheng.help is rejected under Guideline 4.2,
Minimum Functionality. This is the single most likely rejection and being a
good app does not save you from it.

The defence is that the app genuinely uses the device. So the native build must
use native capture, not the browser's:

- **Microphone** — native recording, not `getUserMedia`. Press-to-speak is the
  app's whole gesture and it is the strongest 4.2 argument available.
- **Camera** — native camera, not an `<input type=file>`.
- **Permissions** — asked at the moment of use, with purpose strings that say
  what actually happens, including that audio leaves the device. "Study Pal
  records what you say and sends it to be translated" — not "for a better
  experience". Vague purpose strings are rejected on sight.

With Capacitor this is a plugin swap rather than a rewrite, but it is the
difference between approved and a fortnight of resubmissions.

## Privacy, which is nearly free here

`PRIVACY.md` says no accounts and no server-side user data — everything in
`localStorage`, with two deliberate exceptions. That is an unusually strong
position and it makes the App Store privacy label almost trivial, which is
normally the fiddliest part of a submission.

Two conditions on that:

- The label must match reality. If the feed's handles mean something now
  identifies a poster, `PRIVACY.md` is behind the code and needs reconciling
  before anyone fills the label in. A wrong label is a rejection.
- With no accounts, Guideline 5.1.1(v) — delete your account in the app — does
  not apply. Confirm that is still true of the native build before relying on
  it.

A privacy policy still needs to be at a live URL and linked from the listing.

## The listing, which matters more than the build

For this goal the App Store page *is* the deliverable. Name, subtitle,
screenshots, description. Translate and camera photograph far better than a
feed does — another reason the cut costs nothing.

## Order, and what blocks what

1. **Xcode.** Nothing can be built or uploaded without it and it is a very
   large download. Start it before anything else; it blocks the end of the
   process and nothing else depends on it.
2. **The Capacitor build**, with native mic and camera and the feed excluded.
   Does not wait on the developer account — start immediately.
3. **App Store Connect**: bundle id, app record, screenshots, description,
   privacy label. Waits on enrolment approving.
4. **TestFlight.** Available the moment a build uploads, with no review wait.
   Good enough for early investor conversations while the real submission sits
   in the queue.
5. **Submit.** Review is usually a day or two.

A week is realistic if nothing bounces. The rejection risk is concentrated
entirely in step 2, which is why it is worth doing properly the first time.

Related: `for-studypal-appstore.md` (the full requirements, for 1.1),
`for-studypal-publish.md`, `for-studypal-hook.md`.
