/* ONE MOMENT OF THE STORY, ADDED.
 *
 *   node scripts/shop-chapter.mjs <base> <admin-key> --who Tom \
 *     --when "2019" --text "在微信上卖第一罐奶粉" [--photo <url>]
 *   node scripts/shop-chapter.mjs <base> <admin-key> --who Tom --clear
 *
 * Appends. Run it three times and the page has three moments, in the order
 * they were added — which is how somebody writes this, one remembered thing
 * at a time, rather than filling in a form with five empty rows.
 *
 * `--when` is free text: 2019, 2019年, or the year somebody's daughter was
 * born. A date field would refuse the true answer.
 */
const [base, key, ...rest] = process.argv.slice(2);
if (!base || !key) {
  console.error('shop-chapter.mjs <base> <admin-key> --who Tom --when 2019 --text "…"');
  process.exit(1);
}
const arg = (n) => { const i = rest.indexOf("--" + n); return i >= 0 ? String(rest[i + 1] ?? "") : ""; };
const who = arg("who");
if (!who) { console.error("\n  --who is the handle. `make who` knows it.\n"); process.exit(1); }

const clear = rest.includes("--clear");
const body = { who, clear };
if (!clear) {
  body.when = arg("when");
  body.text = arg("text");
  if (arg("photo")) body.photo = arg("photo");
  if (!body.when && !body.text) {
    console.error('\n  A moment is a year and a line: --when "2019" --text "…"\n');
    process.exit(1);
  }
}

const r = await fetch(base.replace(/\/$/, "") + "/api/admin/shop-chapter", {
  method: "POST",
  headers: { "content-type": "application/json", "x-admin-secret": key },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => null);
if (!r.ok || !j?.ok) {
  /* The board's own words where it has any. "photo" means the picture could
     not be fetched, which is a different problem from a handle that is not
     on this board, and saying so saves somebody checking the wrong one. */
  const said = j?.error === "photo"
    ? "that picture would not download"
    : (j?.error === "empty"
      ? "nothing to write — give --when or --text"
      : (typeof j?.error === "string" ? j.error : "the board said " + r.status));
  console.error("\n  " + said + "\n");
  process.exit(1);
}
console.log(clear
  ? `\n  ${who}: the story is empty again.\n`
  : `\n  ${who}: ${j.n} ${j.n === 1 ? "moment" : "moments"} in the story now.\n`);
