import { redis, KEY } from "./_redis.js";
import { authed } from "./_auth.js";

export default async function handler(req, res) {
  if (!authed(req, res)) return;

  // lrange ดึงทั้งหมดในครั้งเดียว; @upstash/redis แปลง JSON ให้อัตโนมัติ
  // ponytail: โหลดทั้งก้อน พอสำหรับหลักพันรายการ — เกินกว่านั้นค่อยทำ paging
  const rows = await redis().lrange(KEY, 0, -1);
  res.status(200).json(rows.map(r => (typeof r === "string" ? JSON.parse(r) : r)));
}
