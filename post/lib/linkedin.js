/* LINKEDIN, BY HAND.
 *
 * UNTESTED AGAINST LINKEDIN. Written from their Versioned API reference before
 * an app existed. Every path and header below is from those docs and none has
 * been exercised — the same state board/lib/wallet/providers/airwallex.js was
 * in, and that file's history is the argument for saying so out loud: the flow
 * name in it was wrong for five days and only a real call found it.
 *
 * THREE CALLS, NOT ONE. LinkedIn will not take a video in the post: you ask for
 * an upload slot, PUT the bytes at the URL it gives you, finalize, and only
 * then create the post referring to the video by its URN. A single-call
 * mental model is the thing that wastes the first afternoon here.
 *
 * THE VERSION HEADER IS NOT OPTIONAL. LinkedIn-Version is a YYYYMM string and
 * a missing or stale one is a 426, not a 400 — which reads like a protocol
 * error rather than "you did not name a version". It is an env var rather than
 * a constant because LinkedIn retires versions on a schedule and the fix should
 * be a line in .env, not a deploy.
 *
 * WHO IS POSTING. The author is a URN — urn:li:person:xxxx for Tom's own feed,
 * urn:li:organization:123 for a company page — and the token has to have been
 * granted w_member_social for the first or w_organization_social for the
 * second. Nothing here can work that out; it is POST_LINKEDIN_AUTHOR.
 */
const API = "https://api.linkedin.com/rest";
const PATIENCE = 30_000;

export function configured() {
  return Boolean(process.env.POST_LINKEDIN_TOKEN && process.env.POST_LINKEDIN_AUTHOR);
}

function headers() {
  return {
    Authorization: "Bearer " + process.env.POST_LINKEDIN_TOKEN,
    "LinkedIn-Version": (process.env.POST_LINKEDIN_VERSION || "202601").trim(),
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

async function call(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PATIENCE),
  });
  const text = await res.text();
  let d = null;
  try { d = text ? JSON.parse(text) : null; } catch { /* LinkedIn sent prose */ }
  if (!res.ok) {
    /* 401 is a dead token and 403 is a missing scope, and they are fixed in
       completely different places — one is a refresh, the other is a re-consent
       with different boxes ticked. Worth naming rather than printing a code. */
    if (res.status === 401) throw new Error("linkedin token is dead or expired — see post/README.md");
    if (res.status === 403) throw new Error("linkedin refused: the token lacks w_member_social");
    throw new Error(`linkedin ${path} ${res.status}: ${(d?.message || text).slice(0, 200)}`);
  }
  return { body: d, headers: res.headers };
}

/** A video post. Returns { id, url }. */
export async function upload({ file, say }) {
  const author = process.env.POST_LINKEDIN_AUTHOR.trim();
  const { stat } = await import("node:fs/promises");
  const { readFile } = await import("node:fs/promises");
  const size = (await stat(file)).size;

  /* One: ask for somewhere to put it. fileSizeBytes decides how many parts
     LinkedIn asks for, so it has to be the real size. */
  const init = await call("/videos?action=initializeUpload", {
    initializeUploadRequest: { owner: author, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false },
  });
  const value = init.body?.value;
  const urn = value?.video;
  const parts = value?.uploadInstructions || [];
  if (!urn || !parts.length) throw new Error("linkedin gave no upload instructions");

  /* Two: the bytes, in the parts it asked for. Each part answers with an ETag
     and finalize wants them in order — an out-of-order list is accepted and
     produces a corrupt video, which is the worst kind of success. */
  const bytes = await readFile(file);
  const tags = [];
  for (const part of parts) {
    const slice = bytes.subarray(Number(part.firstByte), Number(part.lastByte) + 1);
    const put = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { Authorization: "Bearer " + process.env.POST_LINKEDIN_TOKEN, "Content-Type": "application/octet-stream" },
      body: slice,
    });
    if (!put.ok) throw new Error(`linkedin upload part ${put.status}`);
    const tag = put.headers.get("etag");
    if (!tag) throw new Error("linkedin upload part returned no ETag");
    tags.push(tag);
  }

  /* Three: tell it the parts are all there. */
  await call("/videos?action=finalizeUpload", {
    finalizeUploadRequest: { video: urn, uploadToken: "", uploadedPartIds: tags },
  });

  /* Four: the post itself. The video is referred to by URN; the caption is
     `commentary`, and LinkedIn renders it above the player. */
  const post = await call("/posts", {
    author,
    commentary: String(say || ""),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: { media: { title: String(say || "").split("\n")[0].slice(0, 200), id: urn } },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  });

  /* The post id comes back in a header rather than the body, which is easy to
     miss and leaves the caller with "posted, somewhere". */
  const id = post.headers.get("x-restli-id") || post.body?.id || "";
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}` : "" };
}
