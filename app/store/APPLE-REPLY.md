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

Nobody buys anything from us inside the app, and the app has no paid tier. The
users are small businesses and sole traders — a tutor, a migration agent, a
production company — who use the app to ask a client to pay them for work done
in the real world. The person paying is that client, usually in mainland China.

**2. Where can users purchase the content, subscriptions, features and services
that can be accessed in the app?**

Nowhere. There is nothing to purchase. Every feature in the app is available to
every member at no charge.

**3. What specific types of previously purchased content, subscriptions,
features and services can a user access in the app?**

None. There are no purchases, so there is nothing previously purchased.

**4. What paid content, subscriptions or features are unlocked within the app
that do not use In-App Purchase?**

None are unlocked. No feature of the app is gated behind a payment.

The app does carry payment requests between two businesses — one member asks
another person to pay them for professional services or physical goods
delivered outside the app. Under guideline 3.1.3(e) and 3.1.5(a), payment for
physical goods and for services consumed outside the app does not use In-App
Purchase, and we do not take a commission inside the app. The money goes
directly to the member's own payment account; we are not a party to it.

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
