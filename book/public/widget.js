/* The booking widget. Drop into any page:
 *
 *   <div data-book="studypal"></div>
 *   <script src="https://<board domain>/book/widget.js" async></script>
 *
 * Optional on the div: data-accent="#c8261e" (the button colour), and
 * data-lang="en" or "zh" (otherwise the reader's phone decides).
 *
 * IT DRAWS INSIDE A SHADOW ROOT, so the host page's CSS cannot reach in and
 * this cannot leak out — the widget has to look the same in Study Pal, the
 * board and whatever comes next, and none of those should break because of it.
 *
 * ITS SERVER IS WHEREVER THIS FILE CAME FROM. The address is read off this
 * script's own src, so the widget moves with the service and no app ever has
 * a URL to update.
 *
 * Three screens and a receipt, the shape of the mockup Tom approved: the
 * teachers, one teacher's week, who you are, booked.
 */
(() => {
  const me = document.currentScript
    || [...document.querySelectorAll("script[src]")].find((s) => /\/widget\.js(\?|$)/.test(s.src));
  const BASE = me ? me.src.replace(/\/widget\.js(\?.*)?$/, "") : "";

  const WORDS = {
    en: {
      head: "One-to-one Chinese", sub: "一对一中文课 · online", all: "All",
      per: "/ {n} min", today: "Today", tomorrow: "Tomorrow", none: "No free times this week",
      hear: "Hear them", bj: "Beijing time", yours: "your time {t}",
      book: "Book {when} · {price}", pick: "Pick a time",
      you: "Who's coming?", name: "Your name", contact: "WeChat ID", note: "Anything they should know (optional)",
      confirm: "Book it", back: "Back",
      done: "Booked", doneSub: "{name} will add you on WeChat before the class.",
      pay: "Pay now", again: "Book another",
      taken: "Somebody just took that time. Pick another.", slow: "Too many tries — wait a few minutes.",
      fail: "That did not go through. Try again.", needName: "Your name, so they know who you are.",
      needContact: "Your WeChat ID, so they can reach you.", empty: "No teachers here yet.",
    },
    zh: {
      head: "一对一中文课", sub: "One-to-one Chinese · 在线", all: "全部",
      per: "/ {n} 分钟", today: "今天", tomorrow: "明天", none: "这周没有空档",
      hear: "听一听", bj: "北京时间", yours: "你那边 {t}",
      book: "预约 {when} · {price}", pick: "选个时间",
      you: "谁来上课？", name: "你的名字", contact: "微信号", note: "想让老师知道的（可不填）",
      confirm: "确认预约", back: "返回",
      done: "约好了", doneSub: "{name}老师会在上课前加你微信。",
      pay: "去付款", again: "再约一节",
      taken: "这个时间刚被别人约走了，换一个吧。", slow: "试得太多了，过几分钟再来。",
      fail: "没成功，再试一次。", needName: "写个名字，老师好认你。",
      needContact: "留个微信号，老师好联系你。", empty: "这里还没有老师。",
    },
  };
  const fill = (s, v = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ""));

  const CSS = `
    :host{all:initial;display:block}
    *{box-sizing:border-box}
    .w{--ink:#1c1917;--ink2:#57504a;--mute:#8a817a;--line:#e8e2d8;--paper:#faf7f1;
      font:16px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",Helvetica,Arial,sans-serif;
      color:var(--ink);background:var(--paper);border-radius:20px;padding:18px 14px 16px;min-height:200px}
    h2{margin:2px 6px 0;font:700 26px/1.15 Georgia,"Songti SC",serif}
    .sub{margin:2px 6px 0;color:var(--mute);font-size:14px}
    .chips{display:flex;gap:8px;overflow-x:auto;padding:12px 4px 4px;scrollbar-width:none}
    .chips::-webkit-scrollbar{display:none}
    .chip{flex:none;border:1px solid var(--line);background:#fff;border-radius:99px;padding:7px 13px;
      font-weight:600;font-size:14px;font-family:inherit;color:var(--ink);cursor:pointer}
    .chip.on{background:var(--acc);border-color:var(--acc);color:#fff}
    .t{display:flex;gap:12px;width:100%;margin-top:10px;background:#fff;border:0;border-radius:16px;
      padding:12px;text-align:left;font:inherit;color:inherit;cursor:pointer;
      box-shadow:0 1px 3px rgba(0,0,0,.05),0 6px 16px rgba(0,0,0,.05)}
    .ph{flex:none;width:68px;height:82px;border-radius:12px;object-fit:cover;display:grid;place-items:center;
      color:#fff;font:700 26px Georgia,serif}
    .m{flex:1;min-width:0}
    .m b{font-size:17px}.m b small{font-weight:500;color:var(--mute);font-size:14px;margin-left:6px}
    .m p{margin:3px 0 0;font-size:14px;color:var(--ink2)}
    .row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}
    .price{font-weight:700}.price small{font-weight:500;color:var(--mute);font-size:13px}
    .next{font-size:13px;font-weight:600;color:#2a8a55;background:#e4f4ea;border-radius:8px;padding:3px 8px;white-space:nowrap}
    .next.no{color:var(--mute);background:#f1ede6}
    .hero{position:relative;height:240px;border-radius:18px;overflow:hidden}
    .hero .ph{width:100%;height:100%;border-radius:0;font-size:64px}
    .bk{position:absolute;top:10px;left:10px;width:36px;height:36px;border-radius:50%;border:0;
      background:rgba(255,255,255,.88);font-size:22px;cursor:pointer;color:var(--ink)}
    .hear{position:absolute;bottom:10px;left:10px;border:0;border-radius:99px;padding:8px 13px;
      background:rgba(28,25,23,.78);color:#fff;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer}
    .nm{margin:12px 4px 0;font:700 24px Georgia,"Songti SC",serif}.nm small{font-weight:500;font-size:15px;font-family:inherit;color:var(--mute);margin-left:8px}
    .ln{margin:3px 4px 0;color:var(--ink2);font-size:14px}
    .days{display:flex;gap:7px;overflow-x:auto;padding:14px 2px 8px;scrollbar-width:none}
    .days::-webkit-scrollbar{display:none}
    .day{flex:none;min-width:72px;text-align:center;padding:8px 6px;border-radius:12px;background:#fff;
      border:1px solid var(--line);font-weight:600;font-size:14px;font-family:inherit;color:var(--ink);cursor:pointer}
    .day small{display:block;font-weight:500;opacity:.7;font-size:12px}
    .day.on{background:var(--ink);color:#fff;border-color:var(--ink)}
    .day:disabled{opacity:.35;cursor:default}
    .slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:4px 2px}
    .slot{padding:11px 0;border-radius:12px;background:#fff;border:1px solid var(--line);font-weight:600;font-size:16px;
      font-family:inherit;color:var(--ink);font-variant-numeric:tabular-nums;cursor:pointer}
    .slot.on{border:2px solid var(--acc);color:var(--acc)}
    .slot:disabled{opacity:.35;text-decoration:line-through;cursor:default}
    .tz{margin:8px 4px 0;font-size:12px;color:var(--mute)}
    .go{display:block;width:100%;margin-top:14px;border:0;border-radius:14px;padding:15px;background:var(--acc);
      color:#fff;font-weight:700;font-size:17px;font-family:inherit;cursor:pointer;text-align:center;text-decoration:none}
    .go small{display:block;font-weight:500;font-size:12px;opacity:.85}
    .go:disabled{opacity:.45;cursor:default}
    .ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
    label{display:block;margin:12px 4px 0;font-size:13px;color:var(--ink2)}
    input{display:block;width:100%;margin-top:5px;padding:12px;border-radius:12px;border:1px solid var(--line);
      background:#fff;font-size:16px;font-family:inherit;color:var(--ink)}
    .err{margin:10px 4px 0;color:#b3261e;font-size:14px;min-height:1em}
    .none{margin:24px 6px;color:var(--mute);text-align:center}
    .ok{text-align:center;padding:26px 6px 6px}
    .ok .tick{width:56px;height:56px;margin:0 auto;border-radius:50%;background:#e4f4ea;color:#2a8a55;
      display:grid;place-items:center;font-size:28px}
    .ok h3{margin:12px 0 4px;font:700 24px Georgia,"Songti SC",serif}
    .ok p{margin:0;color:var(--ink2)}
  `;

  const TINTS = [["#e9b8a0", "#b86a4f"], ["#a9c4dd", "#5b7ea3"], ["#c9d8b0", "#7e9a5a"], ["#dcc3e4", "#9a74a8"]];
  const h = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "on") for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else if (k === "class") n.className = v;
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  };
  const face = (t, i) => {
    if (t.photo) return h("img", { class: "ph", src: t.photo, alt: "" });
    const [a, b] = TINTS[i % TINTS.length];
    const d = h("div", { class: "ph" }, (t.name || "?")[0]);
    d.style.background = `linear-gradient(160deg,${a},${b})`;
    return d;
  };

  function mount(host) {
    const shelf = String(host.getAttribute("data-book") || "").toLowerCase();
    const lang = (host.getAttribute("data-lang") || (navigator.language || "").slice(0, 2)) === "zh" ? "zh" : "en";
    const W = WORDS[lang];
    const root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    root.append(h("style", {}, CSS));
    const box = h("div", { class: "w" });
    box.style.setProperty("--acc", host.getAttribute("data-accent") || "#c8261e");
    root.append(box);

    const api = (p, opt) => fetch(BASE + p, opt).then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }));
    const bjDay = (iso) => iso.slice(0, 10);
    const todayBJ = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    const tomorrowBJ = new Date(Date.now() + 32 * 3600e3).toISOString().slice(0, 10);
    const dayWord = (date) => {
      if (date === todayBJ) return W.today;
      if (date === tomorrowBJ) return W.tomorrow;
      return new Date(date + "T12:00:00+08:00").toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB", { weekday: "short", timeZone: "Asia/Shanghai" });
    };
    const whenWord = (iso) => (bjDay(iso) === todayBJ || bjDay(iso) === tomorrowBJ
      ? dayWord(bjDay(iso)) : dayWord(bjDay(iso)) + " " + Number(iso.slice(8, 10))) + " " + iso.slice(11, 16);
    // The reader's own clock, only when it is not Beijing's.
    const localNote = (iso) => {
      const off = -new Date().getTimezoneOffset();
      if (off === 480) return "";
      return fill(W.yours, { t: new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    };
    const clear = () => { box.textContent = ""; };

    let TEACHERS = [];
    let FILTER = "";

    async function list() {
      clear();
      box.append(h("h2", {}, W.head), h("p", { class: "sub" }, W.sub));
      if (!TEACHERS.length) {
        const r = await api("/api/shelf/" + encodeURIComponent(shelf)).catch(() => null);
        TEACHERS = (r && r.j.teachers) || [];
      }
      if (!TEACHERS.length) { box.append(h("p", { class: "none" }, W.empty)); return; }
      const tags = [...new Set(TEACHERS.flatMap((t) => t.tags || []))];
      if (tags.length) {
        box.append(h("div", { class: "chips" },
          ["", ...tags].map((tg) => h("button", {
            class: "chip" + (FILTER === tg ? " on" : ""), type: "button",
            on: { click: () => { FILTER = tg; list(); } },
          }, tg || W.all))));
      }
      TEACHERS.filter((t) => !FILTER || (t.tags || []).includes(FILTER)).forEach((t, i) => {
        box.append(h("button", { class: "t", type: "button", on: { click: () => teacher(t, i) } },
          face(t, i),
          h("div", { class: "m" },
            h("b", {}, t.name, t.zh ? h("small", {}, t.zh) : null),
            t.line ? h("p", {}, t.line) : null,
            h("div", { class: "row" },
              h("span", { class: "price" }, t.price || "", h("small", {}, " " + fill(W.per, { n: t.minutes }))),
              h("span", { class: "next" + (t.next ? "" : " no") }, t.next ? whenWord(t.next) : W.none)))));
      });
    }

    async function teacher(t, i, keep) {
      clear();
      const r = await api("/api/teacher/" + t.id).catch(() => null);
      const days = (r && r.j.days) || [];
      const hero = h("div", { class: "hero" }, face(t, i),
        h("button", { class: "bk", type: "button", "aria-label": W.back, on: { click: list } }, "‹"));
      if (t.voice) {
        const au = new Audio(t.voice);
        hero.append(h("button", { class: "hear", type: "button", on: { click: () => au.play().catch(() => {}) } }, "▶ " + W.hear));
      }
      box.append(hero, h("p", { class: "nm" }, t.name, t.zh ? h("small", {}, t.zh) : null),
        h("p", { class: "ln" }, [t.line, fill(W.per, { n: t.minutes }).replace("/ ", "")].filter(Boolean).join(" · ")));

      let dayI = Math.max(0, days.findIndex((d) => d.slots.some((x) => x.free)));
      let pick = keep || "";
      const dayRow = h("div", { class: "days" });
      const slotBox = h("div", { class: "slots" });
      const tz = h("p", { class: "tz" }, W.bj);
      const go = h("button", { class: "go", type: "button", disabled: true, on: { click: () => who(t, i, pick) } }, W.pick);
      const draw = () => {
        dayRow.textContent = ""; slotBox.textContent = "";
        days.forEach((d, k) => dayRow.append(h("button", {
          class: "day" + (k === dayI ? " on" : ""), type: "button", disabled: !d.slots.some((x) => x.free),
          on: { click: () => { dayI = k; draw(); } },
        }, dayWord(d.date), h("small", {}, String(Number(d.date.slice(8)))))));
        for (const x of (days[dayI] || { slots: [] }).slots) {
          slotBox.append(h("button", {
            class: "slot" + (x.start === pick ? " on" : ""), type: "button", disabled: !x.free,
            on: { click: () => { pick = x.start; draw(); } },
          }, x.start.slice(11, 16)));
        }
        go.disabled = !pick;
        go.textContent = "";
        if (pick) {
          go.append(fill(W.book, { when: whenWord(pick), price: t.price || "" }).replace(/ · $/, ""));
          const ln = localNote(pick);
          if (ln) go.append(h("small", {}, ln));
        } else go.append(W.pick);
      };
      draw();
      if (!days.some((d) => d.slots.some((x) => x.free))) box.append(h("p", { class: "none" }, W.none));
      else box.append(dayRow, slotBox, tz, go);
    }

    function who(t, i, start) {
      clear();
      const name = h("input", { autocomplete: "name", maxlength: "60" });
      const contact = h("input", { autocomplete: "off", maxlength: "80" });
      const note = h("input", { maxlength: "200" });
      const err = h("p", { class: "err" });
      const go = h("button", { class: "go", type: "button" }, W.confirm);
      go.addEventListener("click", async () => {
        if (!name.value.trim()) { err.textContent = W.needName; name.focus(); return; }
        if (!contact.value.trim()) { err.textContent = W.needContact; contact.focus(); return; }
        go.disabled = true; err.textContent = "";
        const r = await api("/api/book", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher: t.id, start, name: name.value, contact: contact.value, note: note.value }),
        }).catch(() => null);
        if (r && r.ok) { TEACHERS = []; return done(t, start, r.j.pay); }
        go.disabled = false;
        if (r && r.status === 409) { err.textContent = W.taken; setTimeout(() => teacher(t, i), 1600); return; }
        err.textContent = r && r.status === 429 ? W.slow : W.fail;
      });
      box.append(
        h("button", { class: "bk", type: "button", style: "position:static", "aria-label": W.back, on: { click: () => teacher(t, i, start) } }, "‹"),
        h("p", { class: "nm" }, W.you),
        h("p", { class: "ln" }, `${t.name} · ${whenWord(start)} · ${W.bj}`),
        h("label", {}, W.name, name), h("label", {}, W.contact, contact), h("label", {}, W.note, note),
        err, go);
      name.focus();
    }

    function done(t, start, pay) {
      clear();
      box.append(h("div", { class: "ok" },
        h("div", { class: "tick" }, "✓"),
        h("h3", {}, W.done),
        h("p", {}, `${t.name} · ${whenWord(start)}`),
        h("p", {}, fill(W.doneSub, { name: t.name }))));
      if (pay) box.append(h("a", { class: "go", href: pay, target: "_blank", rel: "noopener" }, W.pay));
      box.append(h("button", { class: "go ghost", type: "button", on: { click: list } }, W.again));
    }

    list();
  }

  const start = () => document.querySelectorAll("[data-book]:not([data-book-on])").forEach((el) => {
    el.setAttribute("data-book-on", "");
    mount(el);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
