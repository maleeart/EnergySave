import { readAll, normName } from "./_blob.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { name, empid, unit, type } = req.body ?? {};
  if (!name || !unit) return res.status(400).json({ error: "bad request" });

  const rows = await readAll();
  const norm = normName(name);

  // ค้นหาข้อมูลเดิมล่าสุด (เรียงจากล่าสุดไปเก่าสุด)
  const match = rows.slice().reverse().find(r => {
    // 1. ถ้ามี empid ทั้งคู่ (พนักงาน): ตรวจสอบจากรหัสพนักงานเป็นหลัก
    if (empid && r.empid) {
      return String(r.empid).trim().toLowerCase() === String(empid).trim().toLowerCase();
    }
    // 2. ถ้าชื่อตัดคำนำหน้าแล้วตรงกัน (normName)
    if (r.name && normName(r.name) === norm) {
      // กรณีต่างคนกันแต่ชื่อพ้อง: ถ้าทั้งคู่มี empid คนละเบอร์กัน ไม่ถือว่าซ้ำ
      if (empid && r.empid && String(r.empid).trim().toLowerCase() !== String(empid).trim().toLowerCase()) {
        return false;
      }
      return true;
    }
    return false;
  });

  if (!match) return res.status(404).json({ error: "not found" });
  const { _blobUrl, ...safe } = match;
  res.status(200).json({ ...safe, url: _blobUrl });
}
