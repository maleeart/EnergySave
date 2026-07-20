import { append } from "./_blob.js";

const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  // trust boundary: endpoint นี้เปิดสาธารณะ ต้องตรวจรูปร่างข้อมูลทุกฟิลด์
  const { name, empid, unit, scores } = req.body ?? {};
  if (!str(name, 100) || !str(empid, 30) || !str(unit, 120))
    return res.status(400).json({ error: "ข้อมูลผู้ตอบไม่ถูกต้อง" });
  if (!Array.isArray(scores) || scores.length !== 6 ||
      !scores.every(s => Number.isInteger(s) && s >= 0 && s <= 4))
    return res.status(400).json({ error: "คำตอบไม่ครบหรือไม่ถูกต้อง" });

  await append({ name: name.trim(), empid: empid.trim(), unit: unit.trim(), scores,
    at: new Date().toISOString() });

  res.status(201).json({ ok: true });
}
