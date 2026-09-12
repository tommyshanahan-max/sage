/* The keypair the board needs to buzz a phone.
 *
 * VAPID is one P-256 key. The public half goes to the browser as
 * applicationServerKey and travels in every push; the private half signs the
 * token that proves the push came from this board and stays on the box.
 *
 * WRITTEN IN THE FORM EVERY OTHER TOOL EXPECTS — raw base64url, 65 bytes for
 * the public point and 32 for the private scalar — rather than the PEM node
 * would hand over on its own. That is what a browser wants, what `web-push`
 * wants if this is ever swapped for a library, and what ferry/lib/push.mjs
 * already uses next door. board/lib/push.js rebuilds a key object from them.
 *
 * MINTED ONCE AND KEPT. Changing the pair does not rotate a secret, it
 * ORPHANS every subscription: a browser subscribed under the old public key
 * cannot be reached by a token signed with the new one, and the row stays in
 * the file looking alive. Everybody who turned notifications on would silently
 * stop being told, and the only fix is asking each of them again.
 *
 *   node board-keys.mjs
 */
import { generateKeyPairSync } from "node:crypto";

const b64 = (b) => Buffer.from(b).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const un = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });

/* The uncompressed point: 0x04, then x, then y, 32 bytes each. A browser
   refuses anything else as an applicationServerKey. */
const point = Buffer.concat([Buffer.from([4]), un(pub.x), un(pub.y)]);

console.log("");
console.log("  Two lines for .env on the box. The private one is a secret and");
console.log("  belongs nowhere else — not in a commit, not in a chat.");
console.log("");
console.log("BOARD_VAPID_PUBLIC=" + b64(point));
console.log("BOARD_VAPID_PRIVATE=" + priv.d);
console.log("");
console.log("  And a contact address for the push services, so they have");
console.log("  somebody to write to. Yours, never a member's:");
console.log("");
console.log("BOARD_VAPID_SUBJECT=mailto:you@example.com");
console.log("");
console.log("  Mint these ONCE. A new pair orphans every subscription there is.");
console.log("");
