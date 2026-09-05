# What Study Pal needs to add: `via`

For whoever is working in the Study Pal repository. Nothing in here touches
tomscoding — this is a change on the app's side, and it is small.

## The one-line version

Keep the `?via=` code a visitor arrives with, and report it in `/api/usage`
under `vias`, in the same `{name: count}` shape as `totals`.

## Why it is worth doing before anything bigger

The analytics dashboard already has a panel for this. It has had one for a
while, and it currently reads *"Not reported by the app yet."* The reading
half is built and waiting; nothing produces the data.

It matters more here than it would elsewhere because of one constraint:
**WeChat strips referrers.** A link forwarded into a group arrives with no
`Referer` header and no way to tell where it came from. Every share the product
gets travels through exactly the channel that destroys the evidence, so a code
carried in the URL is not one signal among several — it is the only one that
survives.

Right now the honest answer to "which share brought these 58 people" is that
nobody knows.

## What to record

On a device's **first** arrival, if the URL carries `?via=`, keep the value
against that device. First arrival only, and never overwritten:

- A person who arrives through Mia's link and comes back later by typing the
  address is still Mia's arrival. Overwriting on the later visit credits
  nobody and quietly shrinks the only figure anyone is trying to read.
- Somebody who arrives through Mia and later opens a poster link is a person
  who was already here. Counting them twice makes the codes add up to more
  than the audience.

Sanitise it like any other user input — it is a query parameter, so it is
attacker-controlled: lowercase, cap the length (32 is plenty), allow
`[a-z0-9-]` and drop anything else. An unrecognised code is fine to keep; a
code list maintained in two places is a code list that disagrees with itself.

## What to report

In the existing `/api/usage?app=studypal` payload, beside `totals` and
`devices`:

```json
"vias": { "mia": 41, "wechat-uni-group": 58, "poster-a": 5 }
```

Counted in **people, not calls** — the count endpoint's `unit` field says
`"calls, not devices"` about `totals`, and this one is the other kind. If it is
easier to send both, name them separately and say which is which; the dashboard
already renders a people figure beside a call figure elsewhere and knows not to
divide one into the other.

`byDay` for vias would be welcome and is not needed for anything yet.

## What is already built on this side

- `analytics/server.js` reads `vias` from the app payload through `counts()`
  and passes it through untouched. No change needed there.
- `analytics/public/index.html` has the "Who sent them" panel, which will fill
  in the moment the field is non-null.
- `docs/mockups/social.html` is the panel that would generate these codes and
  show what each person's sharing actually produced. It is a mockup, and every
  arrival figure in it is invented until this lands.

## What this does not need

No new endpoint, no schema migration, no change to how devices are counted.
The dashboard reads whatever shape arrives and reports "not measured" when a
field is absent — so shipping this cannot break the page, and not shipping it
leaves the page exactly as it is today.
