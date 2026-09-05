# The missing half: receiving a post

For the session working on Study Pal. This is the last piece, and it is the
only one that makes the admin panel a publishing tool rather than a record of
things nobody sent.

## Where it stands

The panel on tomscoding composes a post — words, an image or a clip, and which
account it goes out from — and can only write it down. Every row on its wall
carries the line *"recorded here — not yet delivered to the app"*, because
there is nothing on your side to deliver it to.

The webhook in `for-studypal-hook.md` runs the other way: you telling us a post
was published, held or removed. That half works end to end. This is the half
that gives it something to report on.

## The route

```
POST https://liuxuesheng.help/api/feed
x-admin-secret: <STUDYPAL_ADMIN_KEY>
Content-Type: multipart/form-data
```

The same `x-admin-secret` the story desk already uses for `/api/series` and
`/api/cover` — this side holds that key and there is no reason for a second
one. It never reaches a browser: every call to your side is proxied through
the tomscoding server, so the key stays on the box.

Multipart rather than base64 JSON, unlike `/api/cover`. A cover is a small
image; this carries video up to 25 MB, and base64 makes that a 33 MB request
body for no gain.

| Field | Required | What |
| --- | --- | --- |
| `account` | yes | The account the post is shared from — see below. |
| `body` | one of the two | The caption. Up to 2000 characters. |
| `file` | one of the two | The image or clip. |

`file` is one of `image/jpeg`, `image/png`, `image/gif`, `image/webp`,
`video/mp4`, `video/quicktime`, `video/webm` — the same list the panel accepts
on upload, so nothing can be composed here that you would reject. Up to 25 MB.

At least one of `body` and `file` must be present. A post with neither is not
a post.

## The reply

```json
{ "id": "abc123" }
```

**That id is the join.** It is what you send back as `post.id` on the webhook
when the post is published, held or removed, and it is how this side matches
your report to the thing it composed. Without it the two halves are two
unrelated lists.

Any 2xx means you have it. `400` for a bad request, `401` for a bad key,
`413` for a file over the limit. Anything else this side treats as "unknown,
possibly sent" and says so on the row rather than guessing — a post silently
sent twice is worse than one a person has to check.

## The account id

This is the part that needs a decision on your side, and it is worth reading
before implementing.

The panel keeps a roster of the accounts being operated — today Tom, Brendan,
Samantha and Wen Wen, with the ids `tom`, `brendan`, `samantha`, `wen-wen`. It
keeps that roster **because you serve no user list** (see
`for-studypal-users.md`). Those ids were slugged from names on this side, which
means they are almost certainly not your ids.

Two ways out, and either is fine:

1. **Serve `/api/users`.** Then the panel picks from your real accounts, sends
   your real id, and the roster becomes a fallback for accounts you do not know
   about yet. This is the better answer and it is already specified.
2. **Accept these slugs** and map them on your side. Quicker, and it works
   until somebody adds an account whose name does not slug the same way.

If you take the second, say so and this side will stop presenting the ids as
provisional. If `account` names something you do not recognise, reply `400`
with the id in the message — better than publishing it under the wrong name.

## What this side already does

Nothing here needs building on tomscoding beyond the call itself. The panel
already:

- validates the file type and size before upload, so nothing invalid reaches
  you;
- stores the post with the account id **and** the account's name at the time,
  so the record still reads after an account is renamed or removed;
- stamps which seat recorded it, separately from which account it goes out as —
  two different questions that one seat made look like one;
- shows "No account picked" rather than inventing an author for a post nobody
  attributed.

When this route exists, the panel sends on *Record the share* instead of only
filing, keeps your returned id on the row, and the webhook fills in what
happened to it.

## Order of work, if it helps

`POST /api/feed` first — it unblocks the whole loop and the account question
can be answered with option 2 in an afternoon. `GET /api/users` after, which
turns the roster from a claim into a confirmed list and removes the mapping.

Related: `for-studypal-hook.md` (the inbound half, working),
`for-studypal-users.md` (the user list).
