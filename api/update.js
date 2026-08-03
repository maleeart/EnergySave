import { append, remove } from "./_blob.js";
import { authed } from "./_auth.js";

const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;

export default async function handler(req, res) {
  if (!authed(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { url, name, empid, unit, type, scores, at } = req.body ?? {};
  if (typeof url !== "string" || !url.startsWith("https://") && !url.startsWith("mock-url-"))
    return res.status(400).json({ error: "invalid url" });
  if (!str(name, 100) || !str(unit, 120))
    return res.status(400).json({ error: "ข้อมูลผู้ตอบไม่ถูกต้อง" });
  if (type === "พนักงาน" && !str(empid, 30))
    return res.status(400).json({ error: "กรุณากรอกรหัสพนักงาน" });
  if (!Array.isArray(scores) || scores.length !== 6 ||
      !scores.every(s => Number.isInteger(s) && s >= 0 && s <= 4))
    return res.status(400).json({ error: "คำตอบไม่ถูกต้อง" });
  if (typeof at !== "string")
    return res.status(400).json({ error: "ข้อมูลเวลาไม่ถูกต้อง" });

  try {
    const record = {
      name: name.trim(),
      empid: type === "พนักงาน" ? empid?.trim() || null : null,
      unit: unit.trim(),
      type: type ?? "พนักงาน",
      scores,
      at
    };
    
    // บันทึก blob ใหม่ก่อน
    const putResult = await append(record);
    const newUrl = putResult?.url || url;

    // ถ้า URL ใหม่ต่างจาก URL เดิม (เช่น เปลี่ยนคีย์/ไฟล์ใหม่) ให้ลบไฟล์เดิมทิ้งด้วย
    if (newUrl !== url) {
      await remove(url);
    }
    
    res.status(200).json({ ok: true, url: newUrl });
  } catch (err) {
    console.error("[update] blob error:", err);
    return res.status(500).json({ error: err.message || "blob update failed" });
  }
}
