/* YOUTUBE, BY HAND.
 *
 * Two calls and a file: refresh the access token, then a resumable upload. The
 * googleapis package is 50MB of generated client for that, on a box that has
 * deliberately kept its dependency tree at nothing. Same decision, and the
 * same reasoning, as board/lib/stripe.js.
 *
 * WHY A REFRESH TOKEN AND NOT A SERVICE ACCOUNT. A service account cannot own
 * a YouTube channel; Google will not let one upload to a human's channel at
 * all. So the one-time consent is Tom's, in a browser, and what this box keeps
 * afterwards is the refresh token — which is why POST_YOUTUBE_REFRESH is a
 * secret that lives in .env on the box and nowhere else.
 *
 * WHY RESUMABLE FOR EVERY UPLOAD, including small ones. The simple multipart
 * endpoint has no way to say "that failed at 90%" other than failing the whole
 * request, and a phone video over a home connection to Tokyo is exactly the
 * upload that dies at 90%. Resumable costs one extra round trip and turns a
 * dead upload into a resumable one.
 */
const OAUTH = "https://oauth2.googleapis.com/token";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";

/* Long enough for a slow upload to finish, short enough that a hung socket is
   not a command that never returns. The upload itself is not under this — only
   the calls around it. */
const PATIENCE = 30_000;

export function configured() {
  return Boolean(
    process.env.POST_YOUTUBE_CLIENT_ID &&
    process.env.POST_YOUTUBE_SECRET &&
    process.env.POST_YOUTUBE_REFRESH,
  );
}

async function token() {
  const body = new URLSearchParams({
    client_id: process.env.POST_YOUTUBE_CLIENT_ID,
    client_secret: process.env.POST_YOUTUBE_SECRET,
    refresh_token: process.env.POST_YOUTUBE_REFRESH,
    grant_type: "refresh_token",
  });
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(PATIENCE),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    /* invalid_grant means the refresh token is dead — revoked, or unused for
       six months, or the consent screen is still in testing, where Google
       expires them after a week. That is a re-consent, not a retry, and the
       message has to say so or somebody will sit running the command again. */
    const why = d.error === "invalid_grant"
      ? "youtube needs consent again (refresh token rejected): see post/README.md"
      : `youtube token ${res.status}: ${d.error_description || d.error || ""}`;
    throw new Error(why);
  }
  return d.access_token;
}

/** Upload one video. Returns { id, url }.
 *
 *  `title` is the first line of the caption and `description` the whole of it:
 *  YouTube's title is 100 characters and a caption written for Xiaohongshu is
 *  longer than that more often than not, so taking the first line is the rule
 *  that does the least damage when it is wrong. */
export async function upload({ file, say, privacy = "public" }) {
  const access = await token();
  const { stat } = await import("node:fs/promises");
  const { createReadStream } = await import("node:fs");

  const st = await stat(file);
  const first = String(say || "").split("\n")[0].trim();
  const meta = {
    snippet: {
      title: (first || "Video").slice(0, 100),
      description: String(say || "").slice(0, 5000),
      categoryId: "22", /* People & Blogs — the honest default for a person
                           posting their own video, and changing it per upload
                           is a setting nobody will ever set. */
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };

  /* Step one: hand over the metadata, get back somewhere to put the bytes. */
  const start = await fetch(
    `${UPLOAD}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + access,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(st.size),
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify(meta),
      signal: AbortSignal.timeout(PATIENCE),
    },
  );
  if (!start.ok) {
    const text = await start.text();
    throw new Error(`youtube start ${start.status}: ${text.slice(0, 300)}`);
  }
  const put = start.headers.get("location");
  if (!put) throw new Error("youtube gave no upload location");

  /* Step two: the bytes. Streamed rather than read into memory — the box has
     256MB for this container and a video is bigger than that often enough.
     duplex: "half" is required by node's fetch for a stream body. */
  const res = await fetch(put, {
    method: "PUT",
    headers: { "Content-Length": String(st.size), "Content-Type": "video/*" },
    body: createReadStream(file),
    duplex: "half",
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = d?.error?.errors?.[0]?.reason || "";
    /* quotaExceeded is the one worth naming: the default YouTube Data quota is
       10,000 units a day and one upload costs 1,600, so six uploads is the
       ceiling. Tomorrow it works again, and nothing about the job is wrong. */
    if (why === "quotaExceeded") throw new Error("youtube quota for today is used up — try tomorrow");
    throw new Error(`youtube upload ${res.status}: ${d?.error?.message || why || ""}`);
  }
  if (!d.id) throw new Error("youtube accepted the upload but returned no id");
  return { id: d.id, url: "https://youtu.be/" + d.id };
}
