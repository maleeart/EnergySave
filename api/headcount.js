import { saveHeadcount, readHeadcount } from "./_blob.js";
import { authed } from "./_auth.js";

export const DEFAULT_HEADCOUNT = {
  "สก.ชธธ.": 0, "อบค.": 0, "อบฟ.": 0, "อบย.": 0, "อรอ.": 0, "อคม.": 0, "อหข.": 0,
};
export const DEFAULT_TOTAL = 1700;

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = await readHeadcount();
      if (data && typeof data === "object" && data.headcount) {
        return res.status(200).json(data);
      }
      return res.status(200).json({ headcount: DEFAULT_HEADCOUNT, total: DEFAULT_TOTAL });
    } catch (err) {
      console.error("[headcount] get error:", err);
      return res.status(500).json({ error: "failed to load headcount" });
    }
  }

  if (req.method === "POST") {
    if (!authed(req, res)) return;

    const { headcount, total } = req.body ?? {};
    if (!headcount || typeof headcount !== "object" || Array.isArray(headcount)) {
      return res.status(400).json({ error: "รูปแบบข้อมูลกำลังพลไม่ถูกต้อง" });
    }

    const cleaned = {};
    for (const [dept, val] of Object.entries(headcount)) {
      const num = Number(val);
      if (!Number.isInteger(num) || num < 0) {
        return res.status(400).json({ error: `จำนวนกำลังพลของฝ่าย "${dept}" ต้องเป็นจำนวนเต็มที่ไม่ติดลบ` });
      }
      cleaned[dept.trim()] = num;
    }

    const calculatedSum = Object.values(cleaned).reduce((a, b) => a + b, 0);
    const finalTotal = (Number.isInteger(Number(total)) && Number(total) > 0) ? Number(total) : (calculatedSum > 0 ? calculatedSum : DEFAULT_TOTAL);

    const record = {
      headcount: cleaned,
      total: finalTotal,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveHeadcount(record);
      return res.status(200).json({ ok: true, ...record });
    } catch (err) {
      console.error("[headcount] post error:", err);
      return res.status(500).json({ error: err.message || "failed to save headcount" });
    }
  }

  return res.status(405).json({ error: "method not allowed" });
}
