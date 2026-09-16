/* SIGNING IN WITH GOOGLE, AND NO LIBRARY.
 *
 * Lifted from `tommyshanahan-max/landed`, which is the same chassis, and
 * changed where this board is not that one — see the note on the routes in
 * server.js. The reasoning below is the original's and still holds.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A person on this board IS a browser: a random id in localStorage, salted and
 * hashed. That is the whole of the identity and it is a real decision — no
 * password, nothing to leak, nothing to reuse. What it does not survive is a
 * phone.
 *
 * On iOS, Safari and the same page added to the home screen DO NOT SHARE
 * STORAGE. So the flow this product asks for — join in WeChat, add to the home
 * screen because notifications need it, open it — hands somebody a blank board
 * and no way back to the profile they just made. The signed cookie does not
 * save it either: a different storage context is a different cookie jar.
 *
 * It is written down as the open problem over dr.sendWordsMany in i18n.js:
 * "a place is kept against the browser, and WeChat's browser is not Safari, so
 * the same person in both is two people". This is the answer to it — something
 * somebody can present that is not this browser.
 *
 * NOT FOR EVERYBODY, AND KNOWINGLY. Google is blocked in mainland China, which
 * is half of who this is for. It is one more door onto the same rebind the
 * six-digit code already uses, offered where it works, and nothing about the
 * board changes for somebody who never touches it.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SUBJECT AND NOT THE EMAIL
 *
 * `sub` is Google's own id for an account: stable for ever, unique, and it is
 * what you match on. An email address is a label that can be changed, and a
 * Google Workspace address can be deleted and reissued to a new employee —
 * matching on email is how somebody inherits a stranger's account.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO JWT VERIFICATION HERE, AND IT IS NOT A SHORTCUT
 *
 * The id_token is not read off a redirect. It is fetched by this server from
 * Google's token endpoint over TLS, in a POST that carries the client secret —
 * which means the channel already proves where it came from. Verifying the
 * signature would be checking Google's word against Google's keys, fetched
 * from Google, over the same TLS. The spec says so plainly: a confidential
 * client using the code flow may skip id_token validation when the token comes
 * straight from the token endpoint.
 *
 * What this DOES check is the audience and the issuer, because those are the
 * two that catch a token minted for a different app.
 *
 * ---------------------------------------------------------------------------
 * OFF UNLESS CONFIGURED. No client id, no button — like push, mail and
 * translation. A box with none of them is a working board with fewer ways in.
 */

const ID = String(process.env.BOARD_GOOGLE_ID || "").trim();
const SECRET = String(process.env.BOARD_GOOGLE_SECRET || "").trim();

export const configured = () => Boolean(ID && SECRET);

/** Where the browser is sent. `state` is ours and comes back untouched — it is
 *  what stops somebody handing a victim a link that signs them into the
 *  attacker's account. */
export function authUrl(redirect, state) {
  const q = new URLSearchParams({
    client_id: ID,
    redirect_uri: redirect,
    response_type: "code",
    /* The two narrowest scopes there are. `openid` gets the subject; `email`
       gets the address. Not profile — a name and a photograph are things this
       board asks somebody for in their own words, and taking Google's instead
       would fill their card in with something they did not choose. */
    scope: "openid email",
    /* So a second sign-in on a new phone does not sit on a consent screen. */
    prompt: "select_account",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q.toString();
}

/** The code, exchanged for who they are. Returns { sub, email } or null.
 *  NEVER THROWS: a sign-in that fails is a sign-in that did not happen, and
 *  the page says so — it must not be able to take the board down. */
export async function whoIs(code, redirect) {
  if (!configured() || !code) return null;
  let data;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: ID,
        client_secret: SECRET,
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    data = await r.json();
  } catch {
    return null;
  }

  const token = String(data?.id_token || "");
  const part = token.split(".")[1];
  if (!part) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")); }
  catch { return null; }

  /* THE TWO CHECKS WORTH MAKING. A token minted for somebody else's client id,
     or by something that is not Google, is the one thing the TLS channel does
     not rule out — a box configured with a client id that is not ours would
     otherwise accept whatever it was handed. */
  if (claims.aud !== ID) return null;
  if (!["accounts.google.com", "https://accounts.google.com"].includes(String(claims.iss))) return null;
  const sub = String(claims.sub || "");
  if (!/^\d{1,64}$/.test(sub)) return null;

  return {
    sub,
    /* Unverified addresses are dropped rather than stored. An unverified email
       is a string somebody typed, and the only thing this field is for is
       identifying a person who has lost everything else. */
    email: claims.email_verified ? String(claims.email || "").toLowerCase().slice(0, 120) : "",
  };
}
