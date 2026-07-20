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
vm.runInContext(src, ctx);
const { emmChart, avgOf, MATRIX, coverage, HEADCOUNT, TOTAL_HEADCOUNT } =
  vm.runInContext("({emmChart, avgOf, MATRIX, coverage, HEADCOUNT, TOTAL_HEADCOUNT})", ctx);

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

// --- ความครอบคลุม: นับคนไม่ซ้ำ และไม่โชว์ร้อยละมั่วเมื่อยังไม่ตั้งกำลังพล ---
const r = (empid, unit) => ({empid, unit, scores: [2,2,2,2,2,2]});

let c = coverage([r("1","อบค."), r("1","อบค."), r("2","อบฟ.")], "");
assert.equal(c.people, 2, "คนเดิมตอบซ้ำต้องนับเป็นคนเดียว");
assert.equal(c.deptDone, 2, "ต้องนับได้ 2 ฝ่าย");
assert.equal(c.deptAll, Object.keys(HEADCOUNT).length, "ฝ่ายทั้งหมดต้องมาจาก HEADCOUNT");
assert.equal(c.total, TOTAL_HEADCOUNT, "ภาพรวมต้องใช้ TOTAL_HEADCOUNT เป็นตัวหาร");
assert.ok(c.pct !== null && c.pct > 0, "ตั้ง TOTAL_HEADCOUNT แล้วต้องคำนวณร้อยละได้");

// "อื่นๆ" ไม่อยู่ใน HEADCOUNT จึงไม่ควรถูกนับเป็นฝ่าย
assert.equal(coverage([r("9","อื่นๆ: หน่วยงานอื่น")], "").deptDone, 0, "สังกัดอื่นๆ ต้องไม่นับเป็นฝ่าย");
assert.equal(coverage([], "").people, 0, "ไม่มีข้อมูลต้องเป็นศูนย์ ไม่ใช่ error");

// ตั้งกำลังพลแล้วต้องคำนวณร้อยละถูก
HEADCOUNT["อบค."] = 10;
c = coverage([r("1","อบค."), r("2","อบค.")], "อบค.");
assert.equal(c.total, 10);
assert.equal(c.pct, 20, "2 จาก 10 คน ต้องได้ 20%");
HEADCOUNT["อบค."] = 0;

// --- export Excel: สร้างไฟล์จริงแล้วอ่านกลับ ตรวจว่าฟอนต์/ความกว้าง/ข้อมูลครบ ---
const ExcelJS = (await import("exceljs")).default;
process.env.ADMIN_PASSWORD = "M@lee8888";
const people2 = [
  {name: "สมชาย ใจดี", empid: "111", unit: "อบค.", scores: [4,3,2,4,1,3], at: new Date().toISOString()},
  {name: "สมหญิง รักษ์พลังงาน", empid: "222", unit: "อบฟ.", scores: [2,3,3,3,2,1], at: new Date().toISOString()},
];
// ใช้ __blobMock แทน network call — _blob.js ตรวจ globalThis.__blobMock ก่อนเรียก Vercel API
globalThis.__blobMock = people2;

const chunks = [];
const xres = {
  setHeader(k, v){ (this.h ??= {})[k] = v; },
  status(c){ this.code = c; return this; },
  json(b){ this.body = b; return this; },
  send(buf){ chunks.push(buf); },
};
const exportHandler = (await import("./api/export.js")).default;
await exportHandler({headers: {"x-admin-password": "M@lee8888"}, query: {}}, xres);

assert.ok(chunks[0]?.length > 0, "ต้องได้ไฟล์ xlsx ออกมา");
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.load(chunks[0]);

const s1 = wb2.getWorksheet("ผลประเมินรายบุคคล");
assert.ok(s1, "ต้องมีชีตผลรายบุคคล");
assert.equal(s1.rowCount, 3, "หัวตาราง 1 แถว + ข้อมูล 2 คน");
assert.equal(s1.getRow(2).getCell(3).value, "สมชาย ใจดี", "ชื่อภาษาไทยต้องไม่เพี้ยน");
assert.equal(s1.getRow(2).font.name, "TH SarabunPSK", "ต้องใช้ฟอนต์ TH Sarabun");
assert.ok(s1.getRow(2).alignment.wrapText, "ต้องเปิด wrapText กันข้อความล้นช่อง");
assert.ok(s1.columns.every(c => c.width >= 7), "ทุกคอลัมน์ต้องกว้างพอ");
// อ่านกลับต้องอ้างด้วยเลขคอลัมน์ (key ของคอลัมน์ไม่ได้ถูกเก็บลงไฟล์ xlsx)
assert.equal(s1.getRow(1).getCell(6).value, "1. นโยบายการจัดการพลังงาน", "หัวคอลัมน์ต้องเป็นหัวข้อ EMM");
assert.equal(s1.columnCount, 11, "5 คอลัมน์ข้อมูลผู้ตอบ + 6 หัวข้อ (ไม่มีคะแนนเฉลี่ยรายคน)");
assert.equal(s1.getRow(1).getCell(11).value, "6. การลงทุน", "คอลัมน์สุดท้ายต้องเป็นหัวข้อที่ 6");

const s2 = wb2.getWorksheet("สรุปสำหรับ e-service");
// layout: หัวสถิติ(1) + สถิติ(3) + ว่าง(1) + หัว EMM(1) + หัวข้อ(6) + ภาพรวม(1) = 13 แถว
assert.equal(s2.rowCount, 13, "สถิติ 4 แถว + ว่าง 1 + หัว EMM 1 + 6 หัวข้อ + ภาพรวม 1");
assert.equal(s2.getRow(2).getCell(2).value, 2, "ผู้เข้าร่วมประเมิน = 2 คน (empid ไม่ซ้ำ)");
assert.equal(s2.getRow(3).getCell(2).value, 1700, "กำลังพลทั้งหมด = 1700");
assert.equal(s2.getRow(7).getCell(2).value, 3, "ข้อ 1: (4+2)/2 = 3");
assert.equal(s2.getRow(13).getCell(3).value, 3, "ภาพรวมต้องปัดเป็นระดับ 3");

assert.equal(xres.h["content-type"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "MIME ต้องเป็น xlsx จริง");

delete globalThis.__blobMock;

console.log("✓ ผ่านทั้งหมด — validation, รหัสผ่าน, กราฟ EMM, ความครอบคลุม และ export Excel");
