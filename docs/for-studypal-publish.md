# The missing half: receiving a post

For the session working on Study Pal. This is the last piece, and it is the
only one that makes the admin panel a publishing tool rather than a record of
things nobody sent.

## Where it stands

`POST /api/feed` is live and working — a post composed in the panel reached the
feed and came back with an id, and the webhook reported it published under the
same id. Both directions are wired to each other, not just each working alone.

What follows is the rest: creating an account, taking a post down, and reading
the user list. Each is built on this side and each returns a 501 until the
matching route exists over there.

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

## Taking a post down

```
DELETE https://liuxuesheng.help/api/feed?id=<post id>
x-admin-secret: <STUDYPAL_ADMIN_KEY>
```

The id is the one you returned from `POST /api/feed`, which is also the one
you send on the webhook. Any 2xx means it is off the feed. `404` on an id you
have never seen is fine and is treated as success — the post is not there,
which is what was asked for.

Until this exists the answer here is a `501` and **nothing on this side
changes**: the panel does not mark a post as pulled when it is still live. A
button that hides a row locally while the post stays in front of readers is
worse than no button, because somebody would believe it was gone.

When it lands, deleting on this side does two things. A post this panel sent
loses its app id and goes back to being a draft that can be shared again —
usually what somebody who just deleted it wants next. A post that only exists
here as a webhook report is marked removed rather than dropped, for the same
reason your own `removed` events are kept: "was taken down" is a different
fact from "never existed".

## Creating an account

```
POST https://liuxuesheng.help/api/users
x-admin-secret: <STUDYPAL_ADMIN_KEY>
Content-Type: application/json

{ "name": "Wen Wen", "handle": "wenwen" }
```

Reply:

```json
{ "id": "usr_7c1a", "name": "Wen Wen", "handle": "wenwen" }
```

`name` is required, `handle` optional. **The id in the reply is what this side
stores** — the roster row is keyed by your id from the moment it is created, so
the `account` field on `/api/feed` is always an id you minted.

This is what makes the account question go away. It was going to need a mapping
table, or a slug convention neither side could change; instead the admin panel
asks you to create the account and takes your answer.

Refuse it properly when you should — a duplicate, a name you will not accept —
with a non-2xx and an `error` string. Nothing is created on this side when you
refuse, deliberately: two lists that disagree from the first row are worse than
a failed button. `404` or `405` is read as "not built yet" rather than a
refusal, and the account is created here alone and marked as not being in the
app.

## The account id on existing rows

Four accounts already exist on this side — Tom, Brendan, Samantha and Wen Wen,
with the slugged ids `tom`, `brendan`, `samantha`, `wen-wen`. They were created
before there was anywhere to create them, so they are the one batch that will
not have your ids.

Easiest fix once `POST /api/users` is live: they get removed here and made
again through it. Nothing is lost — no post has been delivered yet. Say the
word and this side will do that rather than asking you to accept four slugs.

If `account` on `/api/feed` names something you do not recognise, reply `400`
with the id in the message. Better than publishing under the wrong name.

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

`POST /api/users` first. It is the smaller of the two and it removes the
account question from `/api/feed` entirely — with it in place, every id this
side ever sends you is one you minted.

`POST /api/feed` second. That is the one that makes the panel publish.

`DELETE /api/feed` third. Small, and the admin cannot take anything down
without it — the button is built and returns 501 today.

`GET /api/users` last, from `for-studypal-users.md`. It turns the roster into a
view of your list rather than a record of what was created through it, and it
is the only one nothing is blocked on.

Related: `for-studypal-hook.md` (the inbound half, working),
`for-studypal-users.md` (the user list).
