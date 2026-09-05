# What Study Pal needs to serve: `/api/users`

For whoever is working in the Study Pal repository. The admin panel on
tomscoding is built and waiting for this; nothing else is blocked on it.

## Why

tomscoding now carries an admin and content-management panel for Study Pal.
It can already read the catalogue — series and episodes, searchable — because
`/api/series` exists. It cannot show a single thing about a user, because
nothing exposes one.

That is not an oversight in the app, and it is worth being clear about before
adding it: the counter was built to keep **no per-person records**. Hashed
device ids, day granularity, running sums, no event log. `/api/usage` returns
`people.total` and retention buckets — how many, never who. That design is
why "how many people came back" is answerable and "which people" is not.

So this is a decision rather than a gap. Serving users means keeping records
that can be looked up, where today there are none.

## What the panel expects

```
GET /api/users?q=<optional search>      x-admin-secret required
```

```json
{
  "users": [
    {
      "id": "u_3f9a",
      "name": "Mia Chen",
      "handle": "@miachen",
      "joined": "2026-09-02",
      "lastSeen": "2026-09-05",
      "sessions": 14,
      "note": "anything the app wants to show"
    }
  ],
  "total": 6
}
```

Every field except `id` is optional — the panel renders whatever arrives and
leaves out what does not. `q` filters; absent, return the lot up to a sensible
cap.

## What it must not include

No email addresses, phone numbers, IP addresses or precise locations. The panel
is an admin surface for deciding what to publish and to whom — it needs to tell
one user from another and see how active they are. It does not need, and should
not receive, anything that would make this a database of identifiable people
sitting on a second box.

If the six mockup users already exist in the repository, serving them through
this shape is the whole task.

## What is already built on this side

- `GET /sp/users` proxies to it, owner-gated, admin key never leaving the box.
- The Users tab renders the list, searches it, and currently reports that the
  endpoint does not exist rather than showing an empty list — an app with no
  users and an app that does not report them are different facts.
