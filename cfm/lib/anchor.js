// Putting a seal somewhere it cannot be quietly redone.
//
// ---------------------------------------------------------------------------
// What this fixes, and what it does not
//
// A sealed month is chained to the one before it, so hiding an edit means
// redoing every seal since. That is real work, and entirely possible for
// whoever runs the box — the seals live in the same file as the rows. Until
// something leaves this server, a reader has to take the operator's word.
//
// Writing the hash to a public chain removes exactly that: the operator can
// still edit the file, but the edited month no longer hashes to what is on
// the chain, and a stranger can check it without asking anybody. The honest
// sentence afterwards is "nobody can change it without it showing" — not
// "nobody can change it".
//
// It also proves nothing about whether what was written was TRUE. A hash is
// integrity, not honesty. If somebody records a share they never agreed, the
// chain will preserve that faithfully forever.
//
// Nothing here runs unless CFM_STELLAR_SECRET is set. Unset, anchoring simply
// does not happen and every page says so — the seal's `ref` stays empty and
// the record claims only what it can show.
// ---------------------------------------------------------------------------

import {
  Keypair, TransactionBuilder, Networks, Operation, BASE_FEE, Horizon,
} from "@stellar/stellar-sdk";

/* "This account does not exist" reaches us as a 404 from Horizon, and the SDK
   wraps it in a NotFoundError. Matched three ways rather than one: this
   environment cannot reach Stellar to confirm which shape arrives, and being
   wrong here turns the most likely first-run problem back into the unhelpful
   message this exists to replace. Over-matching costs nothing — a real
   failure that says "not found" is the same advice either way. */
const missing = (e) => Boolean(e) && (
  (e.response && e.response.status === 404) ||
  e.name === "NotFoundError" ||
  /not\s*found/i.test(String(e.message || ""))
);

/* Testnet by default, and deliberately. Anchoring to the public network costs
   real lumens and cannot be undone; a box that quietly did that because a
   variable was missing would be the wrong kind of surprise. Say "public" and
   mean it. */
const NET = (process.env.CFM_STELLAR_NET || "test").toLowerCase() === "public"
  ? {
      name: "public",
      passphrase: Networks.PUBLIC,
      horizon: "https://horizon.stellar.org",
    }
  : {
      name: "test",
      passphrase: Networks.TESTNET,
      horizon: "https://horizon-testnet.stellar.org",
    };

/* Trimmed, and then checked for shape rather than trusted.
 *
 * A Stellar secret is base32: 56 characters, S, and nothing outside A-Z and
 * 2-7. Pasting one into a `read -s` prompt is where this goes wrong — many
 * terminals wrap a paste in bracketed-paste escape sequences, and read
 * captures them, so the variable holds the key with invisible characters
 * around it. Everything downstream then fails at submit time with the SDK
 * saying "invalid encoded string", which tells nobody anything.
 *
 * So the shape is checked here, once, where the message can name the actual
 * problem instead of passing a library's wording through to somebody who has
 * no way to act on it. */
const RAW = (process.env.CFM_STELLAR_SECRET || "").trim();
const SECRET = /^S[A-Z2-7]{55}$/.test(RAW) ? RAW : "";

/** Set but wrong — worth telling apart from not set at all, because the two
 *  need opposite things done about them. */
export const bad = () => Boolean(RAW) && !SECRET;
export const why = () => {
  if (!RAW) return "";
  const clean = RAW.replace(/[^A-Z2-7]/g, "");
  return "CFM_STELLAR_SECRET is " + RAW.length + " characters and a Stellar " +
    "secret is 56 starting with S. " +
    (clean.length === 56 && clean.startsWith("S")
      ? "There is a valid-looking key inside it with " + (RAW.length - 56) +
        " extra character(s) around it — a pasted key usually picks those up " +
        "from the terminal."
      : "Check it was pasted whole.");
};

export const on = () => Boolean(SECRET);
export const net = () => NET.name;

/** The account doing the writing, so it can be checked and funded without the
 *  secret ever being read back out of anything. */
export function who() {
  if (!SECRET) return "";
  try { return Keypair.fromSecret(SECRET).publicKey(); } catch { return ""; }
}

/** One seal, onto the chain.
 *
 * A `manage_data` entry rather than a memo or a payment: it is the operation
 * meant for putting a named value on an account, it costs one base fee, and
 * the value it takes is 64 bytes — exactly the length of a sha256 written in
 * hex, which is also the form somebody reading a block explorer can compare
 * against the page by eye.
 *
 * Named by month, so re-anchoring a month overwrites its own entry rather
 * than appending a second one nobody can tell apart. The chain still keeps
 * every version in its own history, which is the point.
 */
export async function put(month, hash) {
  if (!SECRET) throw new Error("no key");
  if (!/^[a-f0-9]{64}$/.test(String(hash))) throw new Error("bad hash");
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new Error("bad month");

  const kp = Keypair.fromSecret(SECRET);
  const server = new Horizon.Server(NET.horizon);
  /* Loaded rather than cached: the sequence number moves every time this
     account is used, and a stale one is a transaction the network rejects. */
  let account;
  try {
    account = await server.loadAccount(kp.publicKey());
  } catch (e) {
    /* Horizon answers 404 for an account that has never been funded, and the
       SDK passes that up as "Not Found" — true, unhelpful, and the single
       most likely thing to go wrong the first time anybody turns this on. An
       account on Stellar does not exist until something pays its reserve. */
    if (missing(e)) {
      throw new Error(
        "the account " + kp.publicKey() + " does not exist on the " + NET.name +
        " network yet — nothing has funded it." +
        (NET.name === "test"
          ? " Free: https://friendbot.stellar.org/?addr=" + kp.publicKey()
          : " Send it a couple of lumens and try again."));
    }
    throw e;
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NET.passphrase,
  })
    .addOperation(Operation.manageData({ name: "seal-" + month, value: hash }))
    .setTimeout(120)
    .build();

  tx.sign(kp);
  const done = await server.submitTransaction(tx);
  return { ref: done.hash, net: NET.name, by: kp.publicKey() };
}

/** Read it back, the way a stranger would — through the network rather than
 *  through anything this server says. Used to check an anchor, so the check
 *  does not quietly trust the thing being checked. */
export async function get(month) {
  const key = who();
  if (!key) return "";
  const server = new Horizon.Server(NET.horizon);
  let account;
  try {
    account = await server.loadAccount(key);
  } catch (e) {
    /* Same 404, and here it means the same thing: nothing was ever written,
       so there is nothing on the chain to agree or disagree with. */
    if (missing(e)) return "";
    throw e;
  }
  const raw = account.data_attr["seal-" + month];
  return raw ? Buffer.from(raw, "base64").toString("utf8") : "";
}
