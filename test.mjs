// ตรวจสอบ input validation + การกันรหัสผ่าน (path ที่พลาดไม่ได้)
// รัน: node test-api.mjs   — ทดสอบเฉพาะเส้นทางที่ถูกปฏิเสธ จึงไม่ต้องต่อ Redis จริง
import assert from "node:assert/strict";
import submit from "./api/submit.js";
import responses from "./api/responses.js";

const call = (handler, req) => new Promise(done => {
  const res = { status(c){ this.code = c; return this; }, json(b){ done({code: this.code, body: b}); } };
  handler({ method: "POST", headers: {}, ...req }, res);
});

const ok = {name: "สมชาย ใจดี", empid: "12345", unit: "อบค.", scores: [4,3,2,1,0,4]};

// --- submit: ต้องปฏิเสธข้อมูลที่ไม่ถูกต้อง ---
assert.equal((await call(submit, {method: "GET"})).code, 405, "GET ต้องถูกปฏิเสธ");

for (const [label, body] of [
  ["ไม่มี body",        undefined],
  ["ชื่อว่าง",           {...ok, name: "  "}],
  ["ชื่อยาวเกิน",        {...ok, name: "ก".repeat(101)}],
  ["ไม่มีรหัสพนักงาน",   {...ok, empid: ""}],
  ["สังกัดผิดชนิด",      {...ok, unit: 123}],
  ["คะแนนไม่ครบ 6 ข้อ",  {...ok, scores: [4,3,2,1,0]}],
  ["คะแนนเกินช่วง 0-4",  {...ok, scores: [5,3,2,1,0,4]}],
  ["คะแนนติดลบ",        {...ok, scores: [-1,3,2,1,0,4]}],
  ["คะแนนไม่ใช่จำนวนเต็ม", {...ok, scores: [1.5,3,2,1,0,4]}],
  ["scores ไม่ใช่ array", {...ok, scores: "4,3,2,1,0,4"}],
]) {
  assert.equal((await call(submit, {body})).code, 400, `ต้องปฏิเสธ: ${label}`);
}

// --- responses: ต้องกันคนที่ไม่มีรหัสผ่าน ---
delete process.env.ADMIN_PASSWORD;
assert.equal((await call(responses, {})).code, 500, "ไม่ตั้ง ADMIN_PASSWORD ต้องไม่ปล่อยข้อมูล");

process.env.ADMIN_PASSWORD = "M@lee8888";
assert.equal((await call(responses, {})).code, 401, "ไม่ส่งรหัสผ่าน ต้องถูกปฏิเสธ");
assert.equal((await call(responses, {headers: {"x-admin-password": "ผิด"}})).code, 401, "รหัสผิด ต้องถูกปฏิเสธ");
assert.equal((await call(responses, {headers: {"x-admin-password": "M@lee888"}})).code, 401, "รหัสสั้นกว่า ต้องถูกปฏิเสธ");

// --- กราฟ EMM: โหลดสคริปต์หน้าเว็บด้วย DOM จำลอง แล้วตรวจเลขที่วาดจริง ---
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync("index.html", "utf8");
const src = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));

// DOM จำลองแบบบางที่สุด: รับทุก property ที่สคริปต์แตะตอนโหลด
const el = new Proxy({}, {get: (t, k) => k in t ? t[k] : (t[k] = k === "value" ? "" : new Proxy({}, {get: () => () => {}})),
                        set: (t, k, v) => (t[k] = v, true)});
const ctx = vm.createContext({document: {querySelector: () => el}, localStorage: null, console});
vm.runInContext(src + "\n;({emmChart, avgOf, MATRIX});", ctx);
const { emmChart, avgOf, MATRIX } = vm.runInContext("({emmChart, avgOf, MATRIX})", ctx);

assert.equal(MATRIX.length, 6, "EMM ต้องมี 6 หัวข้อ");

const people = [
  {...ok, scores: [4,4,4,4,4,4]},
  {...ok, scores: [2,2,2,2,2,2]},
];
// spread เพื่อให้ array ข้ามมาอยู่ realm เดียวกับ assert (ค่าจาก vm คนละ prototype)
assert.deepEqual([...avgOf(people)], [3,3,3,3,3,3], "ค่าเฉลี่ยต้องคำนวณถูก");
assert.deepEqual([...avgOf([])], [0,0,0,0,0,0], "ไม่มีข้อมูลต้องไม่หารด้วยศูนย์");

const svg = emmChart(avgOf(people), people.length);
assert.ok(!/NaN|undefined/.test(svg), "SVG ต้องไม่มี NaN หรือ undefined");
assert.ok(svg.includes("3.00"), "ต้องแสดงค่าเฉลี่ยบนแท่ง");

// ความสูงแท่งต้องแปรผันตามคะแนน: 0 => ไม่มีความสูง, 4 => สูงสุด
const heights = s => [...s.matchAll(/height="([\d.]+)" fill="#1B4C9E"/g)].map(m => +m[1]);
const h = v => heights(emmChart([v,v,v,v,v,v], 1))[0];
assert.equal(h(0), 0, "คะแนน 0 แท่งต้องสูงเป็นศูนย์");
assert.ok(h(2) > h(1) && h(4) > h(2), "คะแนนมากขึ้น แท่งต้องสูงขึ้น");
assert.ok(Math.abs(h(2) - h(4) / 2) < 0.01, "ระดับ 2 ต้องสูงครึ่งหนึ่งของระดับ 4");

assert.match(emmChart([0,0,0,0,0,0], 0), /ยังไม่มีข้อมูล/, "ไม่มีข้อมูลต้องไม่วาดกราฟเปล่า");

console.log("✓ ผ่านทั้งหมด — validation, การกันรหัสผ่าน และกราฟ EMM ถูกต้อง");
