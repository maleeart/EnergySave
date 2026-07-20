import { timingSafeEqual } from "node:crypto";

// เทียบรหัสผ่านแบบเวลาคงที่ กัน timing attack
const matches = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// คืน true เมื่อผ่าน; ถ้าไม่ผ่านจะตอบ error ให้เรียบร้อยแล้ว ผู้เรียกแค่ return
export function authed(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) { res.status(500).json({ error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD" }); return false; }
  if (!matches(req.headers["x-admin-password"] ?? "", expected)) {
    res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" }); return false;
  }
  return true;
}
