# The webhook: Study Pal reporting a post back

For the session working on Study Pal. This is what the tomscoding side now
accepts, written down so the two halves can be checked against one description
rather than against each other's memory.

## The route

```
POST https://partner.tomscoding.com/api/studypal-hook
x-studypal-secret: <the shared secret>
Content-Type: application/json
```

The secret is `PUBLIC_WEBHOOK_SECRET` on Study Pal's box and
`TOMSCODING_STUDYPAL_WEBHOOK_SECRET` here. One value, both sides.

This route sits **above** the sign-in gate, because the caller is a server and
has no session cookie. That makes the header the only lock on it, so nothing
else about the request is trusted: the body is capped at 256 KB, the shape is
normalised on arrival rather than stored as sent, and an id that is not an id is
dropped rather than written to a filename. A missing or wrong secret gets `401`
with no detail — a wrong secret and a malformed body should not be
distinguishable from outside. **No secret configured on this box means every
delivery is refused**, rather than accepted unsigned.

## The body

```json
{
  "event": "published" | "held" | "removed",
  "at": "2026-09-05T11:20:00Z",
  "post": {
    "id": "abc123",
    "body": "the caption",
    "photo": "ph_abc",
    "userId": "wen-wen",
    "reason": "why it was held"
  }
}
```

`event` and `post.id` are the two required fields; without either the reply is
`400`. Everything else is optional and absent is rendered as absent, never as
empty.

A few field names are read in more than one spelling, deliberately — `body`,
`text`, `caption` or `content` for the words; `photo`, `image` or `media` for
the picture; `userId`, `user`, `accountId`, `author` or `from` for who. This is
another service's payload, and the alternative to tolerating `text` where we
expected `body` is a panel that renders a row of blanks and reports nothing
wrong. Send whichever is natural on your side.

`post.id` must match `[A-Za-z0-9][A-Za-z0-9._:-]{0,63}` — wide enough for a
uuid, narrow enough to be safe in a URL and a filename. `photo` is kept as an
opaque string and fetched from
`https://liuxuesheng.help/api/public-media?id=…`, encoded into the query
rather than pasted into a path.

## The replies

| Code | Meaning |
| --- | --- |
| `200 {"ok":true,"id":…,"event":…}` | Recorded. |
| `400` | No usable `event` or `post.id`. Do not retry — it will fail the same way. |
| `401` | Wrong or missing secret. |
| `503` | No secret set on this box, or no shared store configured. Retrying is reasonable; a person has to fix it. |
| `500` | The write failed. **Please retry** — this is the one that means the delivery was lost. |

Deliveries are serialised on this side, so two arriving at once cannot
overwrite each other.

## What happens to each event

The same post id reported twice keeps the later report only: held then
published is a post that is now live, and keeping both would show a queue that
never empties. Reports are keyed on `post.id`, so **send a stable id**.

- **published** — recorded, shown green, nothing to do.
- **held** — sorted to the top of the Feed, counted on the tab, counted in the
  header, and it stays there until somebody here marks it looked at. Send
  `reason` if you have one: the whole value of a held row is knowing what to
  look at.
- **removed** — kept in the record rather than deleted, because "was taken
  down" is a different fact from "never existed", and deleting the row would
  say the second.

Marking a held post as read is this box's note that a person looked at it. It
does **not** tell Study Pal anything and does not release the post — that is
your side's decision, made on your side. If you want the release to come from
here instead, say so and we will add the route; it is a different feature and
it needs a lock of its own.

## What is still missing in the other direction

The panel composes a post — words, an image or a clip, and which account it
goes out from — and can only write it down here. Nothing publishes it, because
Study Pal has no endpoint to receive one. That is the last piece: a `POST` that
takes the body, the media and the account id and puts it in the social feed.
Once it exists, what is on the form is what gets sent, and this webhook closes
the loop by reporting what happened to it.

Related: `for-studypal-users.md` — the user list this panel still cannot read.

## The board, which is the better source

Since this was written, `GET /api/public?queue=1&secret=…` landed on the app
side and the panel now reads it. It returns the whole board — `posts` (held),
`live`, `refused` — with the full row on each: `handle`, `note`, `zh`/`py`/`en`,
`lat`/`lon`, `photo`, `clip`, `topic`, `re`, `like`, `state`, and `why` on
anything turned away.

That is strictly more than this webhook carries, and it is the primary source
now. The hook is still worth having and is still read, for the two things a
poll cannot give: it wakes the panel when something changes rather than on the
next refresh, and it is what stamps when this box first heard about a post,
which is the only way a delivery backing up would ever be visible.

Both are merged on the post id. Where they disagree about a post's state, the
board wins — a row that says what it is now beats a notification about what
happened to it once.

Two things worth saying back:

- `why` on a refusal is the most useful field either side added. A refusal used
  to leave no trace at all, so "why could I not post this" was a question with
  no answer anywhere; the panel now shows it on the card and in the detail
  sheet.
- Replies and likes arriving as ordinary rows joined by `re` and `like` works
  well and needs no change. The panel keeps them off the wall and assembles
  each post's thread and like count from the same response.
