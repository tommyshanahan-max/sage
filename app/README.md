# The Exchange, as an app

This folder is a shell. Every screen in the app is a page the board serves —
`capacitor.config.json` points a WKWebView at `https://thexchange.app` and that
is the whole of the app's content. A change to `board/public` reaches the app on
the next `make deploy`, not on the next App Store review.

**There is exactly one thing the shell adds, and it is the reason to build it:
notifications.** A WKWebView has no Push API at all. Safari's web push works
only for a page added to the home screen, and WeChat's in-app browser — which
is where most of this board's audience meets it — cannot add anything to a home
screen. So for most people the notification has never been available, and it is
the return loop of the entire product: somebody wrote to you and nothing told
you. The app asks Apple instead. See `board/lib/apns.js`.

---

## Before anything else: the domain

`server.url` says `https://thexchange.app`, and **today the board is not there.**
`env.tomscoding` has it at `liuxuesheng.io`, with `thexchange.app` serving the
static page for strangers.

The URL is compiled into the binary. Changing it later is a new build, a new
submission and a new review — so it is settled now, not after. Two ways:

**Do the move first** (the one this is written for). `env.tomscoding` documents
it as three lines that change together:

```
TOMSCODING_BOARD_DOMAIN=thexchange.app
TOMSCODING_BOARD_OLD_DOMAIN=liuxuesheng.io
TOMSCODING_SITE_DOMAIN=
```

That last one must be emptied — two Caddy blocks on one address is a startup
failure that takes every other site on the box down with it.

**Or point the app at the board where it is**, by editing one line here:

```
"url": "https://liuxuesheng.io"
```

It works, and it costs: the App Store listing says The Exchange and the address
bar behind it says "overseas student", and the move becomes a resubmission.

---

## What is in capacitor.config.json, and why

JSON cannot hold a comment, so the reasoning is here. Five of these are
decisions rather than defaults.

**`server.url`** — the app has no content of its own. See above.

**`server.allowNavigation`** — the four hostnames the WKWebView may go to
itself. Everything else opens in Safari, which is what should happen when
somebody taps a link a member pasted into a room.

This list exists for **one** navigation, and without it the App Store review
fails: the reviewer types the demo code at the real door, `/api/enter` answers
`{ elsewhere }`, and `enter.html` does `location.assign` to the demo board on
a different hostname. Unlisted, that is a cross-origin navigation and Capacitor
hands it to Safari — the reviewer is thrown out of the app at the login screen
and rejects it.

The wildcards cover both names because the demo host is a subdomain of one of
them and which one depends on the domain question above. If it is ever hosted
somewhere else, this list changes with it.

**`ios.backgroundColor`** — `#141A24`, the same near-black the icon sits on
and what `site.css` paints in dark mode. It is what shows for the moment before
the board's own page paints, and behind a rubber-band scroll. White there is a
flash on every launch.

**No `ios.contentInset` line, and this is the one thing to look at first on a
real phone.** The pages handle `env(safe-area-inset-bottom)` — the home
indicator — everywhere it matters, and carry `viewport-fit=cover`. They do not
handle `safe-area-inset-top` anywhere, because in a browser and in a home-screen
install nothing needed them to. A WKWebView is not either of those. So take
Capacitor's default, run it, and look at the top of the screen:

- header sitting under the clock and the notch -> add
  `"contentInset": "always"` here, which is the one-line fix and costs nothing
  else;
- a band of empty above the header -> `"contentInset": "never"` and give
  `.top` in `site.css` a `padding-top: env(safe-area-inset-top)`, which fixes
  the home-screen install at the same time.

Guessing between them from here would be a line nobody checked.

**`ios.limitsNavigationsToAppBoundDomains: false`** — app-bound domains are for
an app serving its own bundled pages; turned on with a remote `server.url` the
webview refuses to load anything at all. It has to be false here.

**`plugins.PushNotifications.presentationOptions`** — `alert` and `sound`, and
deliberately not `badge`: `apns.js` sends no badge count, so asking for the
permission would be asking for something never used. The alert is what makes a
message arriving while the app is open on another screen visible at all.

---

## On the box, before the first build

Four lines in `.env`, all `TOMSCODING_`-prefixed on the way in. They are already
declared in `docker-compose.yml`, so setting them and deploying is enough.

```
TOMSCODING_BOARD_APNS_KEY=       the .p8 from developer.apple.com, contents and all
TOMSCODING_BOARD_APNS_KEY_ID=    the ten characters Apple names that key by
TOMSCODING_BOARD_APNS_TEAM=      the team it belongs to, also ten characters
TOMSCODING_BOARD_APNS_TOPIC=app.thexchange
TOMSCODING_BOARD_APNS_HOST=sandbox
```

**The key is per team, not per app** — the one already minted for StudyPal is
the one to use here. A `.p8` is a secret: it goes in `.env` on the box and
nowhere else.

**`_HOST=sandbox` while testing on a device, empty afterwards.** The two APNs
hosts are different servers. A build run onto a phone from Xcode registers with
the sandbox; TestFlight and the App Store register with production. Mixed up,
Apple answers `400 BadDeviceToken`, which reads like a broken token rather than
a build talking to the wrong house. It is the failure that costs an evening.

Unset, nothing here breaks — the board simply does not send. `make deploy` after
setting them.

---

## On the Mac

Everything below needs Xcode and cannot be done from the box or from here.

```
cd ~/tc && git pull
cd app
npm install
npx cap add ios
npx capacitor-assets generate --ios
npx cap open ios
```

`cap add ios` writes `app/ios/`, which is git-ignored — it is generated from
`capacitor.config.json` and `package.json`, and a `.pbxproj` is not a file
anybody can read a diff of. The settings below are **not** regenerated, so if
this is ever built on a second machine they are set again by hand from here.

### In Xcode, once

1. **App target -> Signing & Capabilities**
   - Team: the same one the key belongs to.
   - Bundle Identifier: `app.thexchange` — it must equal `BOARD_APNS_TOPIC` on
     the box, character for character, or every push is a `403`.
   - **+ Capability -> Push Notifications.**
   - **+ Capability -> Background Modes -> Remote notifications.**

2. **The two lines on the lock screen.** Drag `app/ios-strings/en.lproj` and
   `app/ios-strings/zh-Hans.lproj` into the App target ("Create folder
   references" off, "Copy items if needed" on, target App ticked). The board
   sends the *keys* `PUSH_TITLE` and `PUSH_BODY` and no words at all, so that
   nothing about who wrote to whom travels to Apple and so that iOS picks the
   language from the phone. Without these files the lock screen prints
   `PUSH_TITLE`.

3. **Info.plist -> `ITSAppUsesNonExemptEncryption` = `NO`.** Everything here is
   HTTPS, which is exempt. Unset, App Store Connect asks on every single upload.

4. **Localizations -> + Chinese (Simplified).** Otherwise the App Store lists the
   app as English-only and iOS will not pick `zh-Hans.lproj`.

### Testing push on a real device

The simulator cannot receive a push — it has no APNs registration. It must be a
phone, plugged in, with `TOMSCODING_BOARD_APNS_HOST=sandbox` set on the box.

1. Run onto the phone. Sign in, reach Messages, tap **Turn on** on the card.
2. iOS asks. Say yes.
3. `make bells` on the box — the app count going from 0 to 1 is the token
   arriving. Still 0 means registration failed rather than the push failing;
   Xcode's console has the reason, and it is nearly always the Push
   Notifications capability missing from the target.
4. Write to that account from another browser. The phone should buzz within a
   second or two.

### Submitting

`Product -> Archive -> Distribute App`. **Empty `TOMSCODING_BOARD_APNS_HOST` and
deploy before the build reaches TestFlight**, or every notification to a
TestFlight tester is a `400`.

---

## The rejection to expect, and the answer to it

**Guideline 4.2, Minimum Functionality.** An app that is a website in a webview
is the single commonest rejection there is, and this is a website in a webview.

The answer is true and should be made in the review notes rather than waited
for: the app delivers push notifications that the web version cannot deliver to
this audience at all, because the audience arrives through WeChat's in-app
browser, which cannot add a page to the home screen — the one route by which
Safari allows web push. It is not a convenience wrapper; it is the only way the
product's core loop reaches most of its users.

Two more the reviewer will look for, both already done:

- **1.2, user-generated content** — `/terms`, report, block, and a contact
  address for when the app itself is the problem (`BOARD_CONTACT`; set it).
- **5.1.1(v), account deletion** — in the app, on the profile page.

And **a way in — Guideline 2.1.** The board is invite-only, and a reviewer who
meets a door with no code rejects it in a day. This is already built and it is
not an invite: `TOMSCODING_BOARD_DEMO_CODE` is typed at the *real* door and
answers with the address of a second board where nobody is real. It never
spends and never expires, which is what makes it useless as an invite and
exactly what App Review needs.

**The app points at the real board from the first build to the last.** Shipping
the demo address for review and switching after is Guideline 2.3.1, and every
update is re-reviewed. Nothing switches here — the reviewer has a key to a
different room.

Three lines in `.env` and `make demo-board` to fill it; what to paste into App
Store Connect is written out in **`docs/for-exchange-appstore.md`**, which is
the document for this and should be read before the listing is written. It also
has the thing worth knowing before any of this is paid for: **the mainland App
Store needs an ICP filing**, which needs a mainland-hosted server and a Chinese
company, and the box is in Tokyo. The App Store is a shop window for somebody
deciding whether to put money in. It is not a way to reach this audience.
