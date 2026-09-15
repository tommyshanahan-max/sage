// Face ID, or the phone's own passcode, on every payment.
//
// A PASSKEY AND NOT A PIN WE STORE. The board identifies people by a random id
// in their browser, which is fine for a noticeboard and not enough for money:
// anybody who opens an unlocked phone, or copies that id, is that person. A
// passkey is a key pair made by the phone itself; the private half never leaves
// the device and only unlocks with the owner's face, finger or passcode. The
// server keeps the public half and checks a signature. Nothing here can be
// phished, reused on another site, or read out of wallet.json.
//
// BOUND TO THE ONE PAYMENT. A challenge is issued for a specific action on a
// specific thing — send this quote, withdraw this amount — and is spent on
// use. A signature collected for a HK$50 coffee cannot be replayed to approve
// a HK$5,000 withdrawal, and an old one cannot be replayed at all.

import { randomBytes } from "node:crypto";
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const CHALLENGE_MS = 5 * 60 * 1000;
const b64u = {
  from: (u8) => Buffer.from(u8).toString("base64url"),
  to: (s) => new Uint8Array(Buffer.from(s, "base64url")),
};

export function createPasskeys({ ledger, rpName = "The Exchange", now = () => Date.now() }) {
  const challenges = new Map(); // id -> { by, kind, action, ref, challenge, rpID, origin, exp }

  const sweep = () => { const t = now(); for (const [k, v] of challenges) if (v.exp < t) challenges.delete(k); };
  const creds = (data, by) => data.credentials[by] || [];

  async function registrationOptions(me, { rpID, origin }) {
    sweep();
    const existing = await ledger.read((d) => creds(d, me.by));
    const options = await generateRegistrationOptions({
      rpName, rpID, userName: me.handle || "member", userDisplayName: me.handle || "member",
      userID: new TextEncoder().encode(me.by.slice(0, 64)),
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    });
    const id = randomBytes(12).toString("hex");
    challenges.set(id, { by: me.by, kind: "register", challenge: options.challenge, rpID, origin, exp: now() + CHALLENGE_MS });
    return { challengeId: id, options };
  }

  async function register(me, { challengeId, response }) {
    const c = challenges.get(challengeId);
    challenges.delete(challengeId);
    if (!c || c.by !== me.by || c.kind !== "register" || c.exp < now()) return { ok: false, why: "expired" };
    let v;
    try {
      v = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: c.origin, expectedRPID: c.rpID, requireUserVerification: true });
    } catch (err) { return { ok: false, why: err.message }; }
    if (!v.verified) return { ok: false, why: "not verified" };
    const { credential } = v.registrationInfo;
    await ledger.change((data, log) => {
      const list = data.credentials[me.by] = creds(data, me.by);
      if (!list.some((x) => x.id === credential.id)) {
        list.push({ id: credential.id, publicKey: b64u.from(credential.publicKey), counter: credential.counter, transports: credential.transports || [], createdAt: new Date(now()).toISOString() });
      }
      log("passkey.added", { by: me.by });
    });
    return { ok: true };
  }

  /** A challenge for one action on one thing. */
  async function confirmOptions(me, { action, ref, rpID, origin }) {
    sweep();
    const list = await ledger.read((d) => creds(d, me.by));
    if (!list.length) return { needsPasskey: true };
    const options = await generateAuthenticationOptions({
      rpID, userVerification: "required", allowCredentials: list.map((c) => ({ id: c.id, transports: c.transports })),
    });
    const id = randomBytes(12).toString("hex");
    challenges.set(id, { by: me.by, kind: "confirm", action, ref: String(ref || ""), challenge: options.challenge, rpID, origin, exp: now() + CHALLENGE_MS });
    return { challengeId: id, options };
  }

  /** True only for a fresh signature, from this member's own passkey, over a
   *  challenge issued for exactly this action and thing. */
  async function check(me, { action, ref, confirmation }) {
    const { challengeId, response } = confirmation || {};
    const c = challenges.get(challengeId);
    challenges.delete(challengeId);
    if (!c || c.by !== me.by || c.kind !== "confirm" || c.exp < now()) return false;
    if (c.action !== action || c.ref !== String(ref || "")) return false;
    const list = await ledger.read((d) => creds(d, me.by));
    const cred = list.find((x) => x.id === response?.id);
    if (!cred) return false;
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response, expectedChallenge: c.challenge, expectedOrigin: c.origin, expectedRPID: c.rpID, requireUserVerification: true,
        credential: { id: cred.id, publicKey: b64u.to(cred.publicKey), counter: cred.counter, transports: cred.transports },
      });
    } catch { return false; }
    if (!v.verified) return false;
    await ledger.change((data) => {
      const x = creds(data, me.by).find((y) => y.id === cred.id);
      if (x) { x.counter = v.authenticationInfo.newCounter; x.lastUsedAt = new Date(now()).toISOString(); }
    });
    return true;
  }

  return { registrationOptions, register, confirmOptions, check };
}
