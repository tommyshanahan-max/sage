# App Store Connect, in the order the site asks

Every box, top to bottom, with what goes in it. The *reasoning* for each answer
is in `README.md` next door — this file is only for the night you are sitting in
front of the form and want to stop thinking.

**Or don't.** One command on the Mac does sections 1 and 4:

```
cd ~/tc && make listing PHONE="+61 4xx xxx xxx"
```

It fetches, then fills in name, subtitle, description, keywords, promotional
text, both URLs, the demo code and the review notes, attaches the build and
answers export compliance.

What it cannot do is sections 2 and 3, the age rating, and the screenshots —
web form only, and the reason this file still exists.

Open **appstoreconnect.apple.com** → **Apps** → **The Exchange 交换**.

Three of these fields are a judgement rather than a fact and are marked
**[pick]**. Everything else is settled.

---

## 1 · App Information

Left sidebar, under **General**.

**Name**

```
The Exchange 交换
```

**Subtitle**

```
One sentence finds your match
```

**Privacy Policy URL**

```
https://thexchange.app/privacy
```

**Category** — **[pick]**. Not written down anywhere until now, because it is a
bet rather than a fact. Primary **Business**, Secondary **Social Networking**.
Business because the people are here for work and the category is thinner;
Social Networking primary puts it behind WeChat and LinkedIn forever.

**Content Rights** — **[pick]**. It does contain third-party content: the
members' own sentences and photographs. Answer yes, and that you have the
rights to use it. The terms page is where that permission comes from.

**Age Rating** → **Edit**, then:

| Question | Answer |
|---|---|
| Violence, sexual content, profanity, drugs, gambling, horror | None |
| Unrestricted Web Access | **No** |
| User Generated Content | **Yes** |

Expect **17+**. Take it.

---

## 2 · Pricing and Availability

Left sidebar.

- Price: **Free**
- Availability: **all countries and regions**

Mainland China will be in that list and the listing will not be reachable there
without an ICP filing. Leave it on anyway — it costs nothing and the filing may
happen later.

---

## 3 · App Privacy

Left sidebar. This is the long one: a wizard, one data type at a time.

Declare exactly these eight and nothing else. For **every** row: Linked to the
user **Yes**, Used for tracking **No**, Purpose **App Functionality**.

| Data type | Where it is on the form |
|---|---|
| Name | Contact Info → Name |
| Email Address | Contact Info → Email Address |
| Other User Contact Info | Contact Info — *the Instagram and LinkedIn handles* |
| Photos | User Content → Photos or Videos |
| Other User Content | User Content — *the sentence, the card, messages* |
| Device ID | Identifiers → Device ID |
| Coarse Location | Location → Coarse Location |
| Other Data | Other Data — *age, languages, free days* |

Two traps:

- **Do not declare Precise Location.** A city is typed into a box. Nothing on
  this board ever calls `navigator.geolocation`.
- **Tracking is No on all eight.** No ad identifier, no third-party analytics,
  nothing sold on.

---

## 4 · The version page (iOS 1.0)

Left sidebar, under the version number.

### Screenshots

In `app/store/shots/`. Upload the 6.7" set; Apple scales it down for the rest.

Order matters — the first is the one people see in search:

1. `6.7-browse.png` — the card and the sentence
2. `6.7-notes.png`
3. `6.7-cards.png`
4. `6.7-room.png`
5. `6.7-thread.png` — **or drop it**, it has a lot of empty above the messages

### Promotional Text

```
Invite only. You write one sentence — I am a ___ looking for a ___ — and it decides who you are shown. Nobody is ranked, nobody is browsed. Messages when somebody writes.
```

### Description

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

### Keywords

```
china,business,match,introduction,expat,shanghai,beijing,network,invite,producer,supplier,founder
```

### Support URL

```
https://thexchange.app/rules
```

### Marketing URL

```
https://thexchange.app/
```

### Build

Pick the one that finished processing. 1.0 (1).

### App Review Information

**Sign-in required: yes.**

| Field | Value |
|---|---|
| User name | `JY2GUA` |
| Password | `JY2GUA` |

The door takes six characters and there is no second field, so the code goes in
both boxes.

**Notes** — paste all of it. The last paragraph is the answer to the rejection
this app is most likely to get, given before it is asked:

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

On Guideline 4.2: the app delivers push notifications that the web version
cannot deliver to this audience. Safari supports web push only for a page
added to the home screen, and most of these members arrive through WeChat's
in-app browser, which cannot add anything to a home screen. For them the
notification has never been available at all, and being told somebody wrote to
you is the return loop of a messenger. This is not a convenience wrapper.
```

### Version Release

**[pick]** — *Manually release this version*. The App Store is a shop window
for people deciding whether to put money in, and you should choose the morning
it opens rather than have Apple choose it at 3am.

---

## 5 · Before you press Submit

The demo board has to be up, and stay up for as long as the app is listed —
every update is re-reviewed against it. And the four reviewer pages have to
answer signed out:

```
for u in / /rules /privacy /terms; do
  printf '%-10s ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://thexchange.app$u"
done
```

Four 200s. Anything else is a field that must not go in the form yet.

Then **Add for Review** → **Submit**.
