import { append } from "./_blob.js";

const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  // trust boundary: endpoint นี้เปิดสาธารณะ ต้องตรวจรูปร่างข้อมูลทุกฟิลด์
  const { name, empid, unit, type, scores } = req.body ?? {};
  if (!str(name, 100) || !str(unit, 120))
    return res.status(400).json({ error: "ข้อมูลผู้ตอบไม่ถูกต้อง" });
  // พนักงานต้องมี empid, ลูกจ้างไม่ต้องมี
  if (type === "พนักงาน" && !str(empid, 30))
    return res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
  if (!Array.isArray(scores) || scores.length !== 6 ||
      !scores.every(s => Number.isInteger(s) && s >= 0 && s <= 4))
    return res.status(400).json({ error: "คำตอบไม่ครบหรือไม่ถูกต้อง" });

  try {
    await append({ name: name.trim(), empid: empid?.trim() || null, unit: unit.trim(), type: type ?? "พนักงาน", scores,
      at: new Date().toISOString() });
  } catch (err) {
    console.error("[submit] blob error:", err);
    return res.status(500).json({ error: err.message || "blob write failed" });
  }

  res.status(201).json({ ok: true });
}
