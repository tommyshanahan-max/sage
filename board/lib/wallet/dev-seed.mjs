// DEVELOPMENT ONLY — a throwaway board with a few members in three countries,
// so the wallet can be tried end to end. Never run against a real board.
//
//   node lib/wallet/dev-seed.mjs <board.json> <salt>
import * as store from "../store.js";
const [FILE, SALT] = process.argv.slice(2);
if (!FILE || !SALT) { console.error("dev-seed.mjs <board.json> <salt>"); process.exit(1); }
const board = store.cleanBoard({});
const days = (n) => new Date(Date.now() - n * 864e5).toISOString();
const members = [
  ["demoreviewer00000000000000000001", "Tom", "producer"],
  ["dev-device-mikko-fi", "Mikko", "director"],
  ["dev-device-mia-au", "Mia", "producer"],
  ["dev-device-wei-cn", "Wei", "director"],
  ["dev-device-ray-hk", "Ray", "financier"],
];
board.people = members.map(([dev, handle, me], i) => store.cleanPerson({
  id: store.newId(), by: store.hashDevice(dev, SALT), handle, state: "published", looking: true, at: days(30 - i),
  say: [{ me, want: me === "producer" ? "director" : "producer" }],
})).filter(Boolean);
await store.save(FILE, board);
console.log(JSON.stringify((await store.load(FILE)).people.map((p) => [p.handle, p.id])));
