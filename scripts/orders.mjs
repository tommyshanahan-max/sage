/* WHAT IS WAITING TO BE SENT, AND SENDING IT — the seller's whole screen,
 * and it is this.
 *
 *   node scripts/orders.mjs <base> <admin-key>                  what to send
 *   node scripts/orders.mjs <base> <admin-key> --all            everything
 *   node scripts/orders.mjs <base> <admin-key> --ship 1 --tracking XD912…
 *
 * A ROW NUMBER, NOT AN ID. An order id is twenty characters and copying one
 * out of a terminal is the step that goes wrong — so the list numbers itself
 * and --ship takes the number. The list is re-read inside the same command,
 * so the number always means what it just printed.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) { console.error("orders.mjs <base> <admin-key>"); process.exit(1); }
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const has = (n) => rest.includes("--" + n);
const API = base.replace(/\/$/, "");

const get = async (path) => {
  const r = await fetch(API + path, { headers: { "x-admin-secret": key } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || ("the board said " + r.status));
  return j;
};

const { orders } = await get("/api/admin/orders?state=" + (has("all") ? "all" : "toShip"));

const ship = arg("ship");
if (ship) {
  const i = Number(ship) - 1;
  const o = orders[i];
  if (!o) {
    console.error("\n  There is no " + ship + " in that list. Run it without --ship to see.\n");
    process.exit(1);
  }
  const tracking = arg("tracking");
  if (!tracking) {
    console.error('\n  node scripts/orders.mjs … --ship ' + ship + ' --tracking XD91260039AU\n');
    process.exit(1);
  }
  const r = await fetch(API + "/api/admin/ship", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-secret": key },
    body: JSON.stringify({ id: o.id, tracking, courier: arg("courier") }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) {
    console.error("\n  " + (j?.error === "unpaid" ? "That one has not been paid for." : (j?.error || r.status)) + "\n");
    process.exit(1);
  }
  console.log("\n  Sent. " + (o.ship?.name || "") + " can see " + tracking + " on their order now.\n");
  process.exit(0);
}

if (!orders.length) {
  console.log("\n  Nothing waiting to be sent.\n");
  process.exit(0);
}

const WORD = { due: "待付款", toShip: "待发货", shipped: "待收货", done: "完成" };
console.log("");
orders.forEach((o, i) => {
  console.log("  " + String(i + 1).padStart(2) + ".  " + o.total
    + "   " + (WORD[o.state] || o.state)
    + (o.shop ? "   via " + o.shop + (o.cut ? " (" + o.cut + ")" : "") : ""));
  const s = o.ship || {};
  console.log("      " + [s.name, s.phone].filter(Boolean).join("  "));
  console.log("      " + [s.province, s.city, s.district, s.detail].filter(Boolean).join(" "));
  for (const l of o.lines) {
    /* The English name for the picking list, the Chinese one under it: the
       warehouse reads one and the buyer asked for the other. */
    console.log("      " + l.n + " ×  " + (l.en || l.name));
    if (l.en && l.name !== l.en) console.log("           " + l.name);
  }
  if (o.tracking) console.log("      " + o.tracking);
  console.log("");
});
console.log("  To send the first one:");
console.log('    make ship N=1 TRACKING="XD91260039AU"');
console.log("");
