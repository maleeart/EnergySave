import { timingSafeEqual } from "node:crypto";
import { redis, KEY } from "./_redis.js";

const matches = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD" });
  if (!matches(req.headers["x-admin-password"] ?? "", expected))
    return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

  // lrange ดึงทั้งหมดในครั้งเดียว; @upstash/redis แปลง JSON ให้อัตโนมัติ
  // ponytail: โหลดทั้งก้อน พอสำหรับหลักพันรายการ — เกินกว่านั้นค่อยทำ paging
  const rows = await redis().lrange(KEY, 0, -1);
  res.status(200).json(rows.map(r => (typeof r === "string" ? JSON.parse(r) : r)));
}
