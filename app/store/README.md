# App Store Connect, field by field

`listing.json` next door holds this same copy as data, and
`fill-listing.mjs` puts it up through the API. Edit the JSON, not this file,
when the words change — this one is the reasoning.

Everything here is ready to paste. Where a field is a judgement rather than a
fact, the reasoning is under it — App Review reads the metadata as carefully as
the app, and a line written to sound good is a line that gets asked about.

`shots/` holds the screenshots, at the two sizes Apple requires.

---

## Name and subtitle

**App Name** (30 max)

```
The Exchange 交换
```

Both scripts, because the audience reads both and the Chinese is the name most
of them will use. 16 characters.

**Subtitle** (30 max)

```
One sentence finds your match
```

Not "networking" and not "professional community" — both describe a category
rather than this. The sentence *is* the product.

**Chinese (Simplified) subtitle**

```
一句话，找到要找的人
```

---

## Promotional text (170 max — editable without a new build)

```
Invite only. You write one sentence — I am a ___ looking for a ___ — and it decides who you are shown. Nobody is ranked, nobody is browsed. Messages when somebody writes.
```

---

## Description

```
The Exchange is a private board for people doing business in and around China.

You write one sentence about yourself:

    I am a ___ looking for a ___

That sentence is the whole of your profile, and it decides who you see. A
producer looking for a writer is shown writers looking for a producer. Nobody
else. There is no feed, no ranking, and no list of everybody.

Both sides say yes, or nothing happens. When both of you do, a conversation
opens and either one can write first.

— Invite only. Somebody already inside vouched for you, and their name stays
  on yours.
— One sentence, not a CV. Change it and the room around you changes.
— Rooms at the door for film and television, investment, fundraising and
  trade, where people are waiting to be let in.
— Report and block work, a person reads every report, and anything here can be
  taken down.
— English and Chinese throughout, written rather than translated.

Notifications tell you somebody wrote. They never say who, or what they said.

The Exchange is not encrypted, and does not claim to be. It is a private room
with a door on it, over HTTPS. What is kept about you is listed in full on the
privacy page, and deleting your account takes the photographs and every row
with it.
```

The last paragraph is there on purpose. It is the house rule — the product does
not claim to be encrypted, because saying so would be a lie told to people who
are trusting it with who they know — and a description that volunteers a limit
is read differently from one that does not.

---

## Keywords (100 max, comma-separated, no spaces after commas)

```
china,business,match,introduction,expat,shanghai,beijing,network,invite,producer,supplier,founder
```

97 characters. It was 105 and over the limit until it was counted rather than
estimated — `chinese` came out, because `china` is already there and the App
Store does not reward the pair. The promotional text above was 181 against a
limit of 170 for the same reason; "and that sentence decides" is now "and it
decides". Count both again if either is edited: neither field is rejected
loudly, the form simply refuses to save.

Not "chat" or "messenger" — the App Store is full of them and
this ranks nowhere against WeChat. The words worth owning are the specific
ones: a city, a role, the thing somebody is actually looking for.

---

## URLs

| Field | Value |
|---|---|
| Support URL | `https://thexchange.app/rules` |
| Marketing URL | `https://thexchange.app/` |
| Privacy Policy URL | `https://thexchange.app/privacy` |

All three must answer **without a login** — a reviewer fetches them signed out,
and a privacy policy behind a password is a rejection on its own.

`/rules`, `/privacy` and `/terms` are in `OPEN_PATHS`. `/` is opened by its own
line in the gate, above the `OPEN_PATHS` test, and only while `BOARD_AT_ROOT`
is unset — set it to 1 and the root becomes the board, behind the door, and
the Marketing URL stops answering.

Not checkable from the workspace, so check it on the box before submitting:

```
for u in / /rules /privacy /terms; do
  printf '%-10s ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://thexchange.app$u"
done
```

Four 200s. Anything else is a field that must not go in the form yet.

---

## App Review Information

**Sign-in required: yes.**

| Field | Value |
|---|---|
| User name | the demo code |
| Password | the demo code again |

There is no second field — the door takes six characters and nothing else.

**Notes:**

```
The Exchange is invite only. The credentials above are a permanent code that
opens a demonstration board of sample accounts — not the live membership. It
does not expire and it admits nobody to the real board.

Type it at the door on the first screen.

The app is a messenger. The people, conversations and cards you will see are
invented for review.

On notifications: the app registers for Apple push and the board sends one
when another member writes to you. The notification carries no name, no room
and no message text — a lock screen is the least private surface a phone has,
so what is sent is that something happened and nothing more.

Report and block are on every profile and every message. A person reads every
report. Account deletion is on the Profile tab and removes the photographs and
every row.
```

Set `TOMSCODING_BOARD_DEMO_CODE` and `_URL` first, run `make demo-board`, and
**leave the demo host up for as long as the app is listed** — every update is
re-reviewed against it.

---

## Age rating

Answer the questionnaire like this:

| Question | Answer |
|---|---|
| Violence, sexual content, profanity, drugs, gambling, horror | None |
| **Unrestricted Web Access** | **No** |
| **User Generated Content** | **Yes** |

Expect **17+**, and do not try to talk it down. The app carries other people's
words and photographs, and a rating that pretends otherwise is the thing that
gets found later.

"Unrestricted Web Access" is No: the webview is limited to this board's own
hostnames by `allowNavigation` in `capacitor.config.json`. Links anywhere else
open in Safari, outside the app.

---

## Privacy — the nutrition labels

Declare these and nothing else. Every row below was read off `cleanPerson` and the other `clean*` functions in
`board/lib/store.js`, not recalled. Do that again if the profile gains a field —
a nutrition label that is out of date is the kind of thing that is found later.

| Data | Collected | Linked | Tracking | Purpose / what it actually is |
|---|---|---|---|---|
| Name | Yes | Yes | No | App Functionality — a handle, usually a first name |
| Email Address | Yes | Yes | No | App Functionality — sign-in codes only |
| **Other User Contact Info** | **Yes** | Yes | No | App Functionality — **Instagram and LinkedIn handles** (`ig`, `li`), if they put them up |
| Photos | Yes | Yes | No | App Functionality — the profile photograph |
| Other User Content | Yes | Yes | No | App Functionality — the sentence, the card, messages |
| Device ID | Yes | Yes | No | App Functionality — the salted hash that *is* the account |
| Coarse Location | Yes | Yes | No | App Functionality — a **city**, typed, never a coordinate |
| **Other Data** | **Yes** | Yes | No | App Functionality — **age**, languages spoken, which days they are free |

The two in bold are easy to miss and both are on the row: `cleanPerson` keeps
`ig`, `li` and `age`. Declaring a profile as "name and photo" when it carries a
LinkedIn handle and an age is the sort of gap that surfaces long after review.

**Tracking: No, on every row.** No advertising identifier, no third-party
analytics SDK, no data broker. Checked: no page on this board loads a script
from another origin, and the visit counter is first-party on the board's own
hostname.

Do **not** declare Precise Location. A city is typed into a box. Checked: there
is no `navigator.geolocation` call anywhere in `board/public`, no coordinate is
stored, and the app never asks for location permission.

---

## Export compliance

`ITSAppUsesNonExemptEncryption` = `NO` in Info.plist. Everything is HTTPS, which
is exempt. Set it in the plist rather than answering the question on every
upload.

---

## Screenshots

In `shots/`, at `1290x2796` (6.7") and `1242x2688` (6.5").

| File | What it shows |
|---|---|
| `browse` | The card and the sentence — **use this first.** It is the product in one frame. |
| `notes` | Messages, with people and conversations |
| `thread` | A conversation |
| `cards` | Connections who have handed a card over |
| `room` | A room at the door |

**Shot as the app, not as the website**, which matters more than it sounds. Run
in plain Safari, the frame contains the "Add to Home Screen" strip — an
instruction to install a web app, in a picture of the app somebody just
downloaded — and the rewards door, which the app does not have. Both are gone
when the browser announces itself as the app. If these are ever retaken, retake
them the same way; `/tmp` is not where the script should live, so it is written
down here instead:

```
node scripts/demo-board.mjs <base> <key> --device demoreviewer00000000000000000001
```

then drive a browser with `TheExchangeApp/1` appended to the user agent **and**
`window.Capacitor.isNativePlatform()` returning true. The server reads the
first; `install.js` and `notes.html` read the second.

**Two things to fix by hand before uploading**, because neither is worth faking
in the seed data:

- The `thread` shot has a lot of empty above the messages. It is honest — a
  young conversation sits at the bottom of the screen — but it is a weak
  picture. Either shoot a fuller conversation or drop this one.
- Apple allows up to 10; five is enough, and five good ones beat ten.

---

## What is NOT in this build, and why it is worth writing down

**The rewards ledger.** Points, share percentages and a projected sale figure —
live on the web, absent from the app. Both reasons are in the long note over
`inApp` in `board/server.js`. The short version: Guideline 3.2.1(viii), and
separately, an offer of shares to people who are not accredited investors is
regulated conduct in four jurisdictions. Apple is the cheap failure.

If a reviewer asks why the website has a screen the app does not: it is a web
feature, the app has never had it, and nothing in the app links to it.

---

## The rejection to expect

**Guideline 4.2, Minimum Functionality.** This is a website in a webview and
that is the commonest rejection there is. Put the answer in the review notes
rather than waiting for the question — it is true, which is the only reason to
make it:

```
The app delivers push notifications that the web version cannot deliver to
this audience. Safari supports web push only for a page added to the home
screen, and most of these members arrive through WeChat's in-app browser,
which cannot add anything to a home screen. For them the notification has
never been available at all, and being told somebody wrote to you is the
return loop of a messenger. This is not a convenience wrapper.
```

And the one that is not about the app: **the mainland App Store needs an ICP
filing**, which needs a mainland-hosted server and a Chinese company. The box is
in Tokyo. Members inside China need a non-China Apple ID to install this. The
listing is a shop window for somebody deciding whether to put money in. It is
not a way to reach this audience, and `docs/for-exchange-appstore.md` says so at
more length.
