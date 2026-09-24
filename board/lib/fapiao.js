/* 开票信息 — WHAT A CHINESE COMPANY HANDS OVER TO BE INVOICED
 * ===========================================================================
 *
 * The other half of the deal. board/lib/wallet/service.js collects what the
 * supplier needs to invoice us; this collects what we need to invoice the
 * payer. One deal, two invoices, and neither of them crosses a border.
 *
 * IT IS A PASTE BOX AND NOT A FORM, AND THAT IS THE ONLY DESIGN DECISION IN
 * THIS FILE.
 *
 * Every Chinese company keeps its 开票信息 as a block of text. It lives in a
 * WeChat 收藏, in a note on somebody's phone, in the finance group's pinned
 * message. Asking for it is a thing that happens several times a week and the
 * answer is always the same gesture: long-press, copy, paste. Six labelled
 * fields is a form that asks a Chinese finance clerk to retype, on a phone,
 * something they already have on the clipboard — and to retype an eighteen
 * character tax number by hand is to get it wrong.
 *
 * So: one box, they paste, we read it, and we show back what we read. The
 * reading is this file.
 *
 * THE BLOCK HAS NO FIXED SHAPE. Real ones seen in the wild:
 *
 *     抬头：北京某某科技有限公司        公司名称: 上海某某文化传播有限公司
 *     税号：91110108551385082Q         纳税人识别号: 91310000MA1FL1234X
 *     地址电话：北京市…  010-5893…     注册地址：上海市徐汇区…
 *     开户行及账号：招商银行… 1109…    电话：021-12345678
 *                                      开户银行：招商银行上海分行
 *                                      银行账号：1234567890123456
 *
 * Both are correct and both are normal. So the labels are an alias table, the
 * separator is either colon, and the two combined labels — 地址电话 and
 * 开户行及账号 — are split on the run of spaces that always sits between the
 * two halves.
 *
 * ONLY TWO OF THE SIX ARE REQUIRED. A 普通发票 needs the name and the tax
 * number and nothing else; the other four are only wanted for a 专用发票, and
 * a small company that will never ask for one should not be stopped by four
 * empty boxes. So the parse returns what it found and the caller decides.
 *
 * BUILT TO LEAVE, like lib/request.js and lib/memo.js beside it: nothing here
 * imports the board, and nothing here talks to a tax bureau. It reads text.
 */

/* THE UNIFIED SOCIAL CREDIT CODE HAS ITS OWN CHECKSUM, SO CHECK IT HERE.
 *
 * Eighteen characters, GB 32100-2015. The same argument as the ABN and the
 * IBAN: a number that can be checked offline should be checked on the screen
 * it is typed on, while the person who knows it is still looking. An invoice
 * issued against a wrong tax number is not a typo, it is an invoice the payer
 * cannot claim and has to have reissued — weeks later, by somebody who has
 * forgotten the deal.
 *
 * THE ALPHABET IS 31 CHARACTERS AND THE MISSING ONES ARE THE POINT: I, O, S,
 * V and Z are left out because they are the ones people misread as 1, 0, 5,
 * U and 2. So a code containing one of them is wrong before any arithmetic.
 *
 * The weights are 3^i mod 31, and the last character makes the weighted sum
 * come to 0 mod 31. */
const USCC_CHARS = "0123456789ABCDEFGHJKLMNPQRTUWXY";
const USCC_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

export function validUscc(v) {
  const code = String(v ?? "").trim().toUpperCase();
  if (code.length !== 18) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const n = USCC_CHARS.indexOf(code[i]);
    if (n < 0) return false;
    sum += n * USCC_WEIGHTS[i];
  }
  const last = USCC_CHARS.indexOf(code[17]);
  if (last < 0) return false;
  const want = (31 - (sum % 31)) % 31;
  return want === last;
}

/** Whether a tax number is one this can have an opinion about.
 *
 *  Eighteen characters is the modern 统一社会信用代码 and has a checksum. The
 *  fifteen and twenty character ones are the old 纳税人识别号, still on plenty
 *  of live companies, and they have no check digit at all — so they are
 *  accepted on their shape and nothing more. Refusing them would refuse real
 *  companies; pretending to have checked them would be worse. */
export function taxIdState(v) {
  const t = String(v ?? "").trim().toUpperCase();
  if (!t) return "missing";
  if (!/^[0-9A-Z]{15,20}$/.test(t)) return "bad";
  if (t.length === 18) return validUscc(t) ? "ok" : "bad";
  return t.length === 15 || t.length === 20 ? "old" : "bad";
}

/* THE LABELS, AND EVERY SPELLING OF THEM ANYBODY ACTUALLY USES.
 *
 * Longest first inside each field, because 开户行及账号 has to be read before
 * 开户行 and 地址电话 before 地址 — otherwise the combined label matches its
 * own first half and the rest of the line is thrown away. */
const LABELS = [
  ["title", ["公司名称", "单位名称", "发票抬头", "开票抬头", "名称", "抬头", "title", "company"]],
  ["taxId", ["统一社会信用代码", "纳税人识别号", "纳税人识别码", "税号", "识别号", "信用代码", "tax", "taxid", "uscc"]],
  /* THE TWO COMBINED ONES. They are not a sloppy way of writing two lines,
     they are how the tax bureau's own 开票信息 template prints them, so they
     turn up more often than the separate ones do. */
  ["addrTel", ["注册地址及电话", "地址、电话", "地址电话", "地址及电话"]],
  ["bankAcct", ["开户行及账号", "开户银行及账号", "开户行及帐号", "银行及账号", "开户行、账号"]],
  ["addr", ["注册地址", "公司地址", "单位地址", "地址", "address"]],
  ["tel", ["联系电话", "电话号码", "电话", "tel", "phone"]],
  ["bank", ["开户银行", "开户行", "基本户开户行", "银行", "bank"]],
  ["acct", ["银行账号", "银行帐号", "基本户账号", "账号", "帐号", "account", "acct"]],
];

/** A line's `label：value`, or null. Either colon, and an equals sign too —
 *  a block pasted out of a spreadsheet arrives that way. */
function split(line) {
  const m = /^\s*([^：:=]{1,24})\s*[：:=]\s*(.*)$/.exec(line);
  if (!m) return null;
  const label = m[1].replace(/[\s*·・\-—_]/g, "").toLowerCase();
  return { label, value: m[2].trim() };
}

function fieldFor(label) {
  for (const [key, names] of LABELS) {
    for (const name of names) if (label === name || label.endsWith(name)) return key;
  }
  return "";
}

/* WHERE A COMBINED VALUE COMES APART. "上海市徐汇区某某路123号 021-12345678"
   is one field on the template and two on any invoice, and what separates
   them is always a run of whitespace — never a comma, because the address
   has commas in it. So: split on the LAST run of two-or-more spaces, or on
   the one run of whitespace that has a phone-shaped or account-shaped thing
   after it. Falling back to leaving it whole is fine; a combined address is
   still a correct address, and the invoice prints it on one line anyway. */
function splitTail(value, tailRe) {
  const t = String(value || "").trim();
  const m = new RegExp("^(.*?)[\\s　]+(" + tailRe + ")$").exec(t);
  return m ? [m[1].trim(), m[2].trim()] : [t, ""];
}

const clean = (v, n) => String(v ?? "").replace(/[^\P{C}]/gu, "").trim().slice(0, n);

/** Read a pasted 开票信息 block.
 *
 *  Returns every field it could find, plus `taxIdState` so the screen can say
 *  something true about the one field that can be checked. Never throws and
 *  never refuses: a block it cannot read comes back empty, and an empty
 *  result is what tells the caller to show the fields instead. */
export function readFapiao(text) {
  const raw = String(text ?? "").slice(0, 2000);
  const out = { title: "", taxId: "", addr: "", tel: "", bank: "", acct: "" };
  /* Full-width spaces and the bullets people paste out of WeChat count as
     line breaks when they are the only thing separating two labels. */
  const lines = raw.split(/[\r\n;；]+/);
  for (const line of lines) {
    const parts = split(line);
    if (!parts) continue;
    const key = fieldFor(parts.label);
    if (!key || !parts.value) continue;
    if (key === "addrTel") {
      const [addr, tel] = splitTail(parts.value, "[0-9+()\\-– ]{7,24}");
      if (!out.addr) out.addr = addr;
      if (!out.tel) out.tel = tel;
    } else if (key === "bankAcct") {
      const [bank, acct] = splitTail(parts.value, "[0-9][0-9 \\-]{8,30}");
      if (!out.bank) out.bank = bank;
      if (!out.acct) out.acct = acct;
    } else if (!out[key]) {
      out[key] = parts.value;
    }
  }
  /* NO LABELS AT ALL, WHICH IS A THIRD OF WHAT GETS PASTED. Somebody sends
     two lines — the company and the number — and nothing else. The tax
     number identifies itself: eighteen characters that pass the checksum
     cannot be anything else. Whatever line is left and ends the way a
     Chinese company's name ends is the title. */
  if (!out.taxId) {
    for (const t of raw.match(/[0-9A-Za-z]{15,20}/g) || []) {
      if (taxIdState(t) === "ok") { out.taxId = t.toUpperCase(); break; }
    }
  }
  if (!out.title) {
    for (const line of lines) {
      const t = line.trim();
      if (t.length >= 4 && t.length <= 60 && /(公司|中心|集团|工作室|事务所|学校|学院|医院|厂|店|部)$/.test(t)) {
        out.title = t; break;
      }
    }
  }
  out.title = clean(out.title, 80);
  out.taxId = clean(out.taxId, 24).toUpperCase().replace(/\s/g, "");
  out.addr = clean(out.addr, 120);
  out.tel = clean(out.tel, 40);
  out.bank = clean(out.bank, 80);
  out.acct = clean(out.acct, 40).replace(/[\s\-]/g, "");
  return { ...out, taxIdState: taxIdState(out.taxId), found: Boolean(out.title && out.taxId) };
}

/** The stored form, off whatever the screen sends — typed, pasted or both.
 *
 *  A 普通发票 is the default because it is what almost everybody asks for and
 *  it needs two fields. `kind` is "special" only when the payer said so, and
 *  then the other four stop being optional — a 专用发票 missing the bank line
 *  is one the tax bureau will not let us issue, and finding that out after
 *  the deal has settled means chasing somebody who has already been paid. */
export function cleanFapiao(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = clean(raw.title, 80);
  const taxId = clean(raw.taxId, 24).toUpperCase().replace(/\s/g, "");
  if (!title || taxIdState(taxId) === "bad" || taxIdState(taxId) === "missing") return null;
  const kind = raw.kind === "special" ? "special" : "plain";
  const out = {
    kind, title, taxId,
    addr: clean(raw.addr, 120),
    tel: clean(raw.tel, 40),
    bank: clean(raw.bank, 80),
    acct: clean(raw.acct, 40).replace(/[\s\-]/g, ""),
    at: clean(raw.at, 40) || new Date().toISOString(),
  };
  /* The email it goes to. A 电子发票 is a PDF and it has to be sent
     somewhere; the payer is the only person who knows where. */
  const to = clean(raw.to, 120);
  if (/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(to)) out.to = to;
  if (raw.done) out.done = true;
  return out;
}

/** What is still missing, as field names the screen can name back.
 *  Empty means it can be issued. */
export function fapiaoMissing(inv) {
  if (!inv) return ["title", "taxId"];
  const gaps = [];
  if (!inv.title) gaps.push("title");
  if (taxIdState(inv.taxId) !== "ok" && taxIdState(inv.taxId) !== "old") gaps.push("taxId");
  if (inv.kind === "special") {
    for (const k of ["addr", "tel", "bank", "acct"]) if (!inv[k]) gaps.push(k);
  }
  return gaps;
}
