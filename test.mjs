// ตรวจสอบ input validation + การกันรหัสผ่าน (path ที่พลาดไม่ได้)
// รัน: node test-api.mjs   — ทดสอบเฉพาะเส้นทางที่ถูกปฏิเสธ จึงไม่ต้องต่อ Redis จริง
import assert from "node:assert/strict";
import submit from "./api/submit.js";
import responses from "./api/responses.js";

const call = (handler, req) => new Promise(done => {
  const res = { status(c){ this.code = c; return this; }, json(b){ done({code: this.code ?? 200, body: b}); }, end(){ done({code: this.code ?? 200}); } };
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
  ["subUnit ไม่ใช่ string", {...ok, subUnit: 123}],
  ["subUnit ยาวเกิน",   {...ok, subUnit: "ก".repeat(121)}],
]) {
  assert.equal((await call(submit, {body})).code, 400, `ต้องปฏิเสธ: ${label}`);
}

// submit ข้อมูลพร้อม subUnit ถูกต้อง
globalThis.__blobMock = [];
const subOk = await call(submit, {body: {...ok, subUnit: "กมน-ธ."}});
assert.equal(subOk.code, 201, "submit พร้อม subUnit ต้องได้ 201");
assert.equal(globalThis.__blobMock[0]?.subUnit, "กมน-ธ.", "subUnit ต้องถูกบันทึก");
delete globalThis.__blobMock;

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

// DOM จำลองแบบบางที่สุด: noop รับทุกการเรียก รวมถึง addEventListener / classList
const noop = new Proxy(() => {}, { get: () => noop, apply: () => noop });
const el = new Proxy({}, {get: (t, k) => k in t ? t[k] : (t[k] = k === "value" ? "" : noop),
                        set: (t, k, v) => (t[k] = v, true)});
const ctx = vm.createContext({document: {querySelector: () => el, querySelectorAll: () => [el]}, localStorage: null, console});
vm.runInContext(src, ctx);
const { emmChart, avgOf, MATRIX, coverage, HEADCOUNT, TOTAL_HEADCOUNT, DEFAULT_DEPARTMENTS, DEPARTMENTS, normName: htmlNormName } =
  vm.runInContext("({emmChart, avgOf, MATRIX, coverage, HEADCOUNT, TOTAL_HEADCOUNT, DEFAULT_DEPARTMENTS, DEPARTMENTS, normName})", ctx);

assert.equal(htmlNormName("นส ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา", "normName ใน index.html ต้องตัด นส ได้");
assert.equal(htmlNormName("นางสาว ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา", "normName ใน index.html ต้องตัด นางสาว ได้");
assert.equal(htmlNormName("น.ส. ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา", "normName ใน index.html ต้องตัด น.ส. ได้");
assert.equal(htmlNormName("นสวรรณ สวยงาม"), "นสวรรณ สวยงาม", "normName ใน index.html ต้องไม่ตัดชื่อจริง");

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
assert.ok(svg.includes("3.00"), "ต้องแสดงค่าเฉลี่ยบนกราฟ");

// radar: แกนบน (i=0) y = cy - v*R/4 → คะแนนมากขึ้น y น้อยลง (สูงขึ้น)
const dotY = s => +[...s.matchAll(/cy="([\d.]+)" r="5"/g)][0][1];
const [ry0, ry2, ry4] = [0, 2, 4].map(v => dotY(emmChart([v,v,v,v,v,v], 1)));
assert.ok(ry4 < ry2 && ry2 < ry0, "คะแนนมากขึ้น จุดบนแกนสูงขึ้น (y ลดลง)");
assert.ok(Math.abs((ry2 - ry4) - (ry0 - ry2)) < 0.5, "ระดับ 2 ต้องอยู่กึ่งกลางระหว่าง 0 กับ 4");

assert.match(emmChart([0,0,0,0,0,0], 0), /ยังไม่มีข้อมูล/, "ไม่มีข้อมูลต้องไม่วาดกราฟเปล่า");

// --- โครงสร้างองค์กร 7 ฝ่าย 39 กอง 1,990 คน ---
assert.equal(Object.keys(DEFAULT_DEPARTMENTS).length, 7, "ต้องมี 7 ฝ่ายเริ่มต้น");
const totalDivisions = Object.values(DEFAULT_DEPARTMENTS).reduce((s, d) => s + Object.keys(d.divisions).length, 0);
assert.equal(totalDivisions, 41, "ต้องมี 41 กองเริ่มต้นตามแผนผัง");
assert.equal(TOTAL_HEADCOUNT, 1990, "กำลังพลรวมเริ่มต้นต้องเป็น 1990 คน");

// --- ความครอบคลุม: นับคนไม่ซ้ำ และไม่โชว์ร้อยละมั่วเมื่อยังไม่ตั้งกำลังพล ---
const r = (empid, unit) => ({empid, unit, scores: [2,2,2,2,2,2]});

let c = coverage([r("1","อบค."), r("1","อบค."), r("2","อบฟ.")], "");
assert.equal(c.people, 2, "คนเดิมตอบซ้ำต้องนับเป็นคนเดียว");
assert.equal(c.deptDone, 2, "ต้องนับได้ 2 ฝ่าย");
assert.equal(c.deptAll, Object.keys(HEADCOUNT).length, "ฝ่ายทั้งหมดต้องมาจาก HEADCOUNT");
assert.equal(c.total, TOTAL_HEADCOUNT, "ภาพรวมต้องใช้ TOTAL_HEADCOUNT เป็นตัวหาร");
assert.ok(c.pct !== null && c.pct > 0, "ตั้ง TOTAL_HEADCOUNT แล้วต้องคำนวณร้อยละได้");

// ทดสอบความครอบคลุมระดับกอง
const divR = (empid, unit, subUnit) => ({empid, unit, subUnit, scores: [2,2,2,2,2,2]});
const divCov = coverage([divR("1", "อบค.", "กมน-ธ."), divR("2", "อบค.", "กมน-ธ.")], "อบค.", "กมน-ธ.");
assert.equal(divCov.people, 2, "ผู้ประเมินระดับกองต้องนับได้ 2 คน");
assert.equal(divCov.total, 206, "กอง กมน-ธ. ต้องมีกำลังพล 206 คน");
assert.ok(Math.abs(divCov.pct - (2/206*100)) < 0.01, "ร้อยละระดับกองต้องคำนวณถูก");

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

// --- export Excel สรุปความก้าวหน้ารายฝ่าย-กอง (type=summary) เฉพาะจำนวนบุคลากร ---
const summaryChunks = [];
const sxres = {
  setHeader(k, v){ (this.h ??= {})[k] = v; },
  status(c){ this.code = c; return this; },
  json(b){ this.body = b; return this; },
  send(buf){ summaryChunks.push(buf); },
};
await exportHandler({headers: {"x-admin-password": "M@lee8888"}, query: { type: "summary" }}, sxres);
assert.ok(summaryChunks[0]?.length > 0, "ต้องได้ไฟล์ summary xlsx ออกมา");
const wbSummary = new ExcelJS.Workbook();
await wbSummary.xlsx.load(summaryChunks[0]);

const wsProg = wbSummary.getWorksheet("สรุปความก้าวหน้ารายฝ่าย-กอง");
assert.ok(wsProg, "ต้องมีชีตสรุปความก้าวหน้ารายฝ่าย-กอง");
assert.equal(wsProg.columnCount, 8, "ต้องมี 8 คอลัมน์ (ไม่มีคอลัมน์คะแนน EMM)");
assert.equal(wsProg.getRow(7).getCell(1).value, "ลำดับ");
assert.equal(wsProg.getRow(7).getCell(4).value, "กำลังพลเป้าหมาย (คน)");
assert.equal(wsProg.getRow(7).getCell(5).value, "ประเมินแล้ว (คน)");
assert.equal(wsProg.getRow(7).getCell(6).value, "ยังไม่ทำ / คงเหลือ (คน)");
assert.equal(wsProg.getRow(7).getCell(7).value, "ความคืบหน้า (%)");
assert.equal(wsProg.getRow(7).getCell(8).value, "สถานะการติดตาม");

// ตรวจสอบแถวสรุปภาพรวมทั้งหมดที่ล่างสุด
const lastSummaryRow = wsProg.lastRow;
assert.equal(lastSummaryRow.getCell(1).value, "รวม");
assert.equal(lastSummaryRow.getCell(2).value, "ภาพรวมทั้งหมด");
assert.equal(lastSummaryRow.getCell(4).value, 1990, "กำลังพลรวมต้องเป็น 1990");
assert.equal(lastSummaryRow.getCell(5).value, 2, "ผู้เข้าร่วมประเมินรวมต้องเป็น 2");
assert.equal(lastSummaryRow.getCell(6).value, 1988, "ยังไม่ทำต้องเป็น 1990 - 2 = 1988");
// --- update: ต้องแอนมินเท่านั้น และข้อมูลต้องถูกต้อง ---
const updateHandler = (await import("./api/update.js")).default;
const mockPerson = {
  url: "mock-url-123",
  name: "สมชาย ทดสอบ",
  empid: "88888",
  unit: "อบค.",
  type: "พนักงาน",
  scores: [1, 2, 3, 4, 0, 1],
  at: new Date().toISOString()
};

assert.equal((await call(updateHandler, { body: mockPerson })).code, 401, "update: ไม่ส่งรหัสผ่านต้องได้ 401");
assert.equal((await call(updateHandler, {
  headers: { "x-admin-password": "M@lee8888" },
  body: { ...mockPerson, name: "" }
})).code, 400, "update: ชื่อว่างต้องได้ 400");

globalThis.__blobMock = [
  { name: "สมชาย ทดสอบ", empid: "88888", unit: "อบค.", subUnit: "กมน-ธ.", type: "พนักงาน", scores: [1, 2, 3, 4, 0, 1], at: mockPerson.at, _blobUrl: "mock-url-123" }
];
const updateRes = await call(updateHandler, {
  headers: { "x-admin-password": "M@lee8888" },
  body: {
    ...mockPerson,
    name: "สมชาย แก้ไขแล้ว",
    subUnit: "กกห-ธ."
  }
});
assert.equal(updateRes.code, 200, "update: ข้อมูลถูกต้องต้องได้ 200");
assert.equal(globalThis.__blobMock[0].name, "สมชาย แก้ไขแล้ว", "ข้อมูลใน mock ต้องอัปเดตแล้ว");
assert.equal(globalThis.__blobMock[0].subUnit, "กกห-ธ.", "subUnit ใน mock ต้องอัปเดตแล้ว");

delete globalThis.__blobMock;

// --- headcount: ตรวจสอบการจัดการกำลังพล ---
const headcountHandler = (await import("./api/headcount.js")).default;

// 1. GET ต้องอ่านได้แม้ไม่ต้องส่งรหัสผ่าน
const getInitRes = await call(headcountHandler, { method: "GET" });
assert.equal(getInitRes.code, 200, "headcount: GET ต้องได้ 200");
assert.ok(getInitRes.body.headcount, "headcount: ต้องมี object headcount");
assert.ok(getInitRes.body.departments, "headcount: ต้องมี object departments");
assert.equal(Object.keys(getInitRes.body.departments).length, 7, "headcount: เริ่มต้นต้องมี 7 ฝ่าย");

// 2. POST ต้องกันคนไม่มีรหัสผ่าน
assert.equal((await call(headcountHandler, {
  method: "POST",
  body: { headcount: { "อบค.": 100 } }
})).code, 401, "headcount: POST ไม่มีรหัสผ่านต้องได้ 401");

// 3. POST ข้อมูลผิด (เช่น ตัวเลขติดลบ) ต้องปฏิเสธ 400
assert.equal((await call(headcountHandler, {
  method: "POST",
  headers: { "x-admin-password": "M@lee8888" },
  body: { headcount: { "อบค.": -5 } }
})).code, 400, "headcount: ติดลบต้องได้ 400");

assert.equal((await call(headcountHandler, {
  method: "POST",
  headers: { "x-admin-password": "M@lee8888" },
  body: { headcount: "not-an-object" }
})).code, 400, "headcount: ไม่ใช่ object ต้องได้ 400");

// 4. POST ข้อมูลถูกต้อง ต้องได้ 200 และคำนวณยอดรวมได้
globalThis.__blobMock = [];
const postValidRes = await call(headcountHandler, {
  method: "POST",
  headers: { "x-admin-password": "M@lee8888" },
  body: {
    headcount: { "สก.ชธธ.": 50, "อบค.": 100, "อบฟ.": 150 }
  }
});
assert.equal(postValidRes.code, 200, "headcount: บันทึกถูกต้องต้องได้ 200");
assert.equal(postValidRes.body.total, 300, "headcount: ผลรวมกำลังพลต้องได้ 300");

// 5. GET อีกรอบต้องได้ข้อมูลที่เพิ่งบันทึกไป
const getUpdatedRes = await call(headcountHandler, { method: "GET" });
assert.equal(getUpdatedRes.body.headcount["อบค."], 100, "headcount: GET ต้องได้ค่าที่เพิ่งอัปเดต");
assert.equal(getUpdatedRes.body.total, 300, "headcount: total ต้องเป็น 300");

// 6. POST บันทึกโครงสร้าง 2 ระดับ (departments + divisions)
const postHierarchicalRes = await call(headcountHandler, {
  method: "POST",
  headers: { "x-admin-password": "M@lee8888" },
  body: {
    departments: {
      "อบค.": {
        headcount: 250,
        divisions: { "กมน-ธ.": 150, "กกห-ธ.": 100 }
      },
      "ฝ่ายทดสอบ": {
        headcount: 50,
        divisions: { "กองทดสอบ 1": 50 }
      }
    }
  }
});
assert.equal(postHierarchicalRes.code, 200, "headcount: บันทึกโครงสร้าง 2 ระดับต้องได้ 200");
assert.equal(postHierarchicalRes.body.total, 300, "headcount: ผลรวมกำลังพลฝ่ายและกองต้องได้ 300");
assert.ok(postHierarchicalRes.body.departments["ฝ่ายทดสอบ"], "headcount: ต้องมีฝ่ายใหม่");
assert.equal(postHierarchicalRes.body.departments["ฝ่ายทดสอบ"].divisions["กองทดสอบ 1"], 50);

const getHierarchicalRes = await call(headcountHandler, { method: "GET" });
assert.equal(getHierarchicalRes.body.departments["ฝ่ายทดสอบ"].divisions["กองทดสอบ 1"], 50);

delete globalThis.__blobMock;
delete globalThis.__headcountMock;

// --- ตรวจสอบการตัดคำนำหน้า (normName) และการตรวจจับข้อมูลซ้ำ (api/check.js) ---
import { normName } from "./api/_blob.js";
import checkHandler from "./api/check.js";

assert.equal(normName("นาย สมชาย ใจดี"), "สมชาย ใจดี");
assert.equal(normName("นาง สมหญิง ใจดี"), "สมหญิง ใจดี");
assert.equal(normName("นางสาว ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา");
assert.equal(normName("นส ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา");
assert.equal(normName("น.ส. ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา");
assert.equal(normName("นส. ธิฌาดา จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา");
assert.equal(normName("น.ส ธิฌาดา   จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา");
assert.equal(normName("นสวรรณ สวยงาม"), "นสวรรณ สวยงาม", "ต้องไม่ตัด 'นส' ที่เป็นส่วนหนึ่งของชื่อจริง");

// ทดสอบ checkHandler method GET ต้อง 405
assert.equal((await call(checkHandler, { method: "GET" })).code, 405, "check: GET ต้อง 405");
assert.equal((await call(checkHandler, { body: {} })).code, 400, "check: ไม่มี name/unit ต้อง 400");

// จำลองข้อมูลเดิมใน mock: กรณี 'นางสาว ธิฌาดา' ทำไว้ตอนเดือน 7 ในสังกัดเดิม 'สก.ชธธ.'
globalThis.__blobMock = [
  {
    name: "นางสาว ธิฌาดา จันทร์ศิริชญา",
    empid: null,
    unit: "สก.ชธธ.",
    subUnit: null,
    type: "ลูกจ้าง",
    scores: [3, 3, 2, 2, 1, 3],
    at: "2024-07-15T08:30:00.000Z",
    _blobUrl: "mock-url-thichada-old"
  },
  {
    name: "นาย สมชาย ใจดี",
    empid: "12345",
    unit: "อบค.",
    subUnit: "กมน-ธ.",
    type: "พนักงาน",
    scores: [4, 4, 4, 4, 4, 4],
    at: "2024-08-01T10:00:00.000Z",
    _blobUrl: "mock-url-somchai"
  },
  {
    name: "นาย สมชาย ใจดี",
    empid: "99999",
    unit: "อบฟ.",
    subUnit: null,
    type: "พนักงาน",
    scores: [1, 1, 1, 1, 1, 1],
    at: "2024-08-02T10:00:00.000Z",
    _blobUrl: "mock-url-somchai2"
  }
];

// 1. ลูกจ้างกรอก 'นส ธิฌาดา จันทร์ศิริชญา' และเปลี่ยนสังกัดเป็น 'กบห-ธ.' ต้องตรวจพบข้อมูลเดิม
const checkContractor = await call(checkHandler, {
  body: {
    name: "นส ธิฌาดา จันทร์ศิริชญา",
    empid: null,
    unit: "กบห-ธ.",
    subUnit: null,
    type: "ลูกจ้าง"
  }
});
assert.equal(checkContractor.code, 200, "check: ลูกจ้างชื่อตรงแม้คำนำหน้าและสังกัดต่าง ต้องพบข้อมูลเดิม");
assert.equal(checkContractor.body.url, "mock-url-thichada-old", "check: ต้องส่ง url เดิมกลับมา");
assert.deepEqual(checkContractor.body.scores, [3, 3, 2, 2, 1, 3], "check: ต้องส่งคะแนนเดิมกลับมา");

// 2. พนักงานรหัส 12345 เปลี่ยนคำนำหน้าหรือหน่วยงาน ต้องตรวจพบข้อมูลเดิม
const checkEmp = await call(checkHandler, {
  body: {
    name: "สมชาย ใจดี",
    empid: "12345",
    unit: "อบค.",
    type: "พนักงาน"
  }
});
assert.equal(checkEmp.code, 200, "check: พนักงานรหัสตรง ต้องพบข้อมูลเดิม");
assert.equal(checkEmp.body.url, "mock-url-somchai");

// 3. พนักงานชื่อเหมือนกัน แต่รหัสพนักงานคนละเบอร์ ต้องแยกแยะได้
const checkEmpOther = await call(checkHandler, {
  body: {
    name: "สมชาย ใจดี",
    empid: "88888", // รหัสใหม่ ยังไม่เคยทำ
    unit: "อบค.",
    type: "พนักงาน"
  }
});
assert.equal(checkEmpOther.code, 404, "check: รหัสพนักงานใหม่ แม้ชื่อเหมือนคนเดิมต้องไม่เจอซ้ำ");

// 4. ผู้ตอบใหม่ที่ไม่เคยมีในระบบ ต้อง 404
const checkNew = await call(checkHandler, {
  body: {
    name: "นาย ทดสอบ ไม่เคยมี",
    empid: "77777",
    unit: "อบค.",
    type: "พนักงาน"
  }
});
assert.equal(checkNew.code, 404, "check: ผู้ตอบใหม่ต้อง 404");

// 5. ทดสอบการบันทึกซ้ำพร้อม oldUrl ผ่าน submitHandler เพื่อยืนยันว่าข้อมูลเดิมถูกแทนที่ ไม่เกิดรายการซ้ำ
const submitUpdateRes = await call(submit, {
  body: {
    name: "นส ธิฌาดา จันทร์ศิริชญา",
    empid: null,
    unit: "กบห-ธ.",
    subUnit: "กองทดสอบ",
    type: "ลูกจ้าง",
    scores: [4, 4, 4, 4, 4, 4],
    oldUrl: "mock-url-thichada-old"
  }
});
assert.equal(submitUpdateRes.code, 201, "submit: บันทึกอัปเดตต้องได้ 201");
const thichadaRecords = globalThis.__blobMock.filter(r => normName(r.name) === "ธิฌาดา จันทร์ศิริชญา");
assert.equal(thichadaRecords.length, 1, "ต้องไม่มีข้อมูลซ้ำของ ธิฌาดา ใน mock");
assert.deepEqual(thichadaRecords[0].scores, [4, 4, 4, 4, 4, 4], "คะแนนต้องได้รับการอัปเดต");
assert.equal(thichadaRecords[0].unit, "กบห-ธ.", "สังกัดต้องได้รับการอัปเดต");

// 6. ทดสอบอักขระล่องหน (zero-width chars) และ non-breaking space
assert.equal(normName("นส\u200B ธิฌาดา\u200B จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา", "ต้องตัด zero-width space ได้");
assert.equal(normName("นส\u00A0ธิฌาดา\u00A0จันทร์ศิริชญา"), "ธิฌาดา จันทร์ศิริชญา", "ต้องแปลง non-breaking space ได้");

// 7. ตรวจสอบว่า checkHandler ทำงานได้แม้ไม่ส่ง unit มา
const checkNoUnit = await call(checkHandler, {
  body: {
    name: "นส\u200B ธิฌาดา จันทร์ศิริชญา",
    type: "ลูกจ้าง"
  }
});
assert.equal(checkNoUnit.code, 200, "check: ไม่ส่ง unit หรือมี zero-width space ก็ต้องตรวจพบข้อมูลเดิม");
assert.equal(checkNoUnit.body.url, "mock-url-thichada-old");

delete globalThis.__blobMock;

console.log("✓ ผ่านทั้งหมด — validation, รหัสผ่าน, กราฟ EMM, ความครอบคลุม, export Excel, update, headcount และ duplicate check");
