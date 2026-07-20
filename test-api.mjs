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

console.log("✓ ผ่านทั้งหมด — validation และการกันรหัสผ่านทำงานถูกต้อง");
