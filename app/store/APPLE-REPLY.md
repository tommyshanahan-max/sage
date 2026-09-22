# The reply to App Review — submission 9c9fce5f, 22 Sep 2026

Paste each block into the Messages field on the App Review page. Written to be
sent as one message; the questionnaire at the top is answered first because
Apple will not move until it is.

**Attach three screen recordings, made on a real iPhone, in the Notes field of
App Review Information.** They are listed at the bottom. Apple will not accept
this reply without them however true it is.

---

## The five business-model questions

**1. Who are the users that will use the paid content, subscriptions, features
and services in the app?**

There are none. The app has no paid content, no subscription and no paid tier.
Its users are people who want to meet people — a tutor, a migration agent, a
production company, a student — who write one sentence about themselves and
are shown the people that sentence matches.

**2. Where can users purchase the content, subscriptions, features and services
that can be accessed in the app?**

Nowhere. There is nothing to purchase, inside the app or outside it.

**3. What specific types of previously purchased content, subscriptions,
features and services can a user access in the app?**

None. There are no purchases, so there is nothing previously purchased.

**4. What paid content, subscriptions or features are unlocked within the app
that do not use In-App Purchase?**

None. No feature of the app is gated behind a payment.

We think this question came from a screen the app no longer has. Our website at
thexchange.app also carries a separate payments product for businesses, and a
tab in the app linked through to it. That tab and every route to it have been
removed from the app for all users, on every device — it is not hidden, gated
or conditionally shown, and there is no setting that brings it back. The app is
now a single-purpose app: an introductions board and the messages that follow
from it. The payments product remains a website feature for desktop and mobile
web only.

**5. How do users obtain an account? Do users have to pay a fee to create an
account?**

Accounts are free and no payment details are required to make one. A person
either joins a public waiting room by giving a first name, or is given a
six-character invitation code by an existing member. Nothing is charged at any
point, ever.

---

## Guideline 1.2 — User-Generated Content

All four precautions are in the app and were in the build under review. We
believe the reviewer did not reach them because the app terminated at the step
described under 2.1(a) below, before any of these screens could be opened.

**Terms, now presented at the door.** This is the one point where Apple was
right and we have changed the app. The terms were reachable from the footer and
the About page but were not put in front of somebody as they joined. A line now
sits under the primary button on both entry screens — the waiting-room door and
the invitation door — reading "By continuing you agree to the Terms. No abuse,
nothing objectionable, and reports are acted on within a day", with Terms
linked. It is shown before any account exists.

**The terms state the standard plainly.** Under "What you may not do": no
harassment, no writing to somebody who has stopped answering, no passing off
another person's face or words, nothing sexual involving anybody under
eighteen. Under a heading of its own: "Every message and every profile can be
reported, and anybody can be blocked. Reports are read within 24 hours and
acted on. Nothing objectionable is meant to stay up, and anything that does is
a failure rather than a policy."

**Flagging.** Every post and every profile carries Report, with reasons —
asking for money, abuse or harassment, spam, impersonation — and a free-text
box.

**Blocking.** Any member can be blocked from their profile or from any post.
Blocking is immediate and removes that person from the blocker's feed at once.
It is stored against the person, not the browser, so it survives a new device
or a reinstall.

**Acting within 24 hours.** Reports go to the operator directly and are acted
on the same day. The board is small enough that one person reads every one.

---

## Guideline 2.1(a) — the crash

Found and fixed. The cause was ours and it was not in the board.

`Info.plist` carried no `NSCameraUsageDescription`. iOS terminates a process
that touches the camera without one — it is not an error the app can catch and
not a prompt the user sees, which is why the crash log points at the system.
The reviewer's steps — Profile, Edit your page, +, Take Photo — reach the
camera on the first tap, so the app died exactly there and could go no further.

The next build carries all three strings the app needs:

- `NSCameraUsageDescription` — taking a photograph for a profile, a post or a
  product listing
- `NSPhotoLibraryUsageDescription` — choosing an existing photograph for the
  same
- `NSMicrophoneUsageDescription` — recording a spoken message instead of
  typing one

They are written into the project by the build script rather than by hand, so a
clean checkout cannot ship without them.

We believe this single fault caused the other two findings: the reviewer could
not proceed past this screen, and so could not reach the reporting, blocking or
account-deletion flows, all of which were present in the build reviewed.

---

## Guideline 5.1.1(v) — account deletion

Account deletion is in the app and was in the build under review.

**Where it is:** Profile, then "Delete everything and leave".

**What it does:** one press, no email, no telephone call, no support queue and
no deactivate-instead option. A confirmation sheet lists exactly what goes —
the profile and photograph, everything posted, messages, the gallery, everyone
followed and everyone following — and says plainly that it cannot be undone.
Confirming removes every row belonging to that person from the server together
with their image files, signs the device out, and clears local storage on the
device.

**Nothing is retained** beyond what is described on the privacy page.

The screen recording listed below shows the flow end to end.

---

## What changed in the build

1. The three usage strings in `Info.plist`, which is the crash under 2.1(a).
2. The agreement line at both doors, under 1.2.
3. The payments tab removed from the app entirely, for every user — see
   question 4 above.

---

## The three recordings to attach

Record on a physical iPhone, not the simulator. Each one is short.

1. **Terms before sign-in** — open the app cold, reach the door, show the
   agreement line under the button, tap Terms and scroll to the paragraph
   beginning "Every message and every profile can be reported".
2. **Flagging and blocking** — open a post, tap Report, show the reasons; then
   open a profile, tap Block, and show the person gone from the feed.
3. **Account deletion** — sign in with the demo account, go to Profile, tap
   "Delete everything and leave", show the confirmation sheet, confirm, and
   show the app returned to the signed-out state.

Put all three in App Review Information → Notes for this and every future
submission.
