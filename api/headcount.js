import { saveHeadcount, readHeadcount } from "./_blob.js";
import { authed } from "./_auth.js";

export const DEFAULT_DEPARTMENTS = {
  "สก.ชธธ.": {
    headcount: 330,
    divisions: {
      "กปฟร-ธ.": 98,
      "กปฟรร-ธ.": 70,
      "กปฟนม-ธ.": 66,
      "กบคธ-ธ.": 50,
      "กบห-ธ.": 22,
      "กศม-ธ.": 13,
      "ขึ้นตรง ชธธ.": 11
    }
  },
  "อบค.": {
    headcount: 609,
    divisions: {
      "กมน-ธ.": 206,
      "กกห-ธ.": 162,
      "กกอ-ธ.": 146,
      "กฟนม-ธ.": 66,
      "กผงค-ธ.": 17,
      "สก. อบค.": 12
    }
  },
  "อบฟ.": {
    headcount: 455,
    divisions: {
      "กบคพ-ธ.": 126,
      "กบกม-ธ.": 112,
      "สก. อบฟ.": 69,
      "กบมอ-ธ.": 63,
      "กททอ-ธ.": 43,
      "กมสว-ธ.": 22,
      "กผงฟ-ธ.": 20
    }
  },
  "อบย.": {
    headcount: 104,
    divisions: {
      "กบร-ธ.": 29,
      "กวย-ธ.": 28,
      "กคข-ธ.": 27,
      "กผงย-ธ.": 16,
      "สก. อบย.": 4
    }
  },
  "อรอ.": {
    headcount: 212,
    divisions: {
      "กงค-ธ.": 110,
      "กทค-ธ.": 43,
      "กบออ-ธ.": 31,
      "กผงอ-ธ.": 18,
      "สก. อรอ.": 6,
      "ขึ้นตรง อรอ.": 4
    }
  },
  "อคม.": {
    headcount: 149,
    divisions: {
      "กคฟ-ธ.": 60,
      "กคว-ธ.": 34,
      "กคค-ธ.": 26,
      "กคภ-ธ.": 13,
      "กผงม-ธ.": 12,
      "สก. อคม.": 4
    }
  },
  "อหข.": {
    headcount: 131,
    divisions: {
      "กขส-ห.": 73,
      "กชย-ห.": 32,
      "กวข-ห.": 21,
      "สก. อหข.": 5
    }
  }
};

export const DEFAULT_HEADCOUNT = Object.fromEntries(
  Object.entries(DEFAULT_DEPARTMENTS).map(([dept, d]) => [dept, d.headcount])
);
export const DEFAULT_TOTAL = Object.values(DEFAULT_HEADCOUNT).reduce((a, b) => a + b, 0); // 1990

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = await readHeadcount();
      if (data && typeof data === "object" && data.headcount) {
        // ถ้ามี departments ให้คืนตามนั้น ถ้าไม่มี ให้สร้างจาก DEFAULT_DEPARTMENTS ร่วมกับ headcount ที่มี
        const departments = data.departments || {};
        const mergedDepartments = {};
        const allDepts = new Set([...Object.keys(DEFAULT_DEPARTMENTS), ...Object.keys(data.headcount), ...Object.keys(departments)]);
        for (const dept of allDepts) {
          if (departments[dept]) {
            mergedDepartments[dept] = departments[dept];
          } else if (DEFAULT_DEPARTMENTS[dept]) {
            mergedDepartments[dept] = {
              headcount: data.headcount[dept] ?? DEFAULT_DEPARTMENTS[dept].headcount,
              divisions: { ...DEFAULT_DEPARTMENTS[dept].divisions }
            };
          } else {
            mergedDepartments[dept] = {
              headcount: data.headcount[dept] ?? 0,
              divisions: {}
            };
          }
        }
        return res.status(200).json({
          departments: mergedDepartments,
          headcount: data.headcount,
          total: data.total ?? Object.values(data.headcount).reduce((a, b) => a + b, 0)
        });
      }
      return res.status(200).json({
        departments: DEFAULT_DEPARTMENTS,
        headcount: DEFAULT_HEADCOUNT,
        total: DEFAULT_TOTAL
      });
    } catch (err) {
      console.error("[headcount] get error:", err);
      return res.status(500).json({ error: "failed to load headcount" });
    }
  }

  if (req.method === "POST") {
    if (!authed(req, res)) return;

    const { departments, headcount, total } = req.body ?? {};

    // รองรับกรณีส่ง departments โครงสร้างใหม่แบบ 2 ระดับ
    if (departments && typeof departments === "object" && !Array.isArray(departments)) {
      const cleanedDepts = {};
      const cleanedHeadcount = {};

      for (const [deptRaw, dData] of Object.entries(departments)) {
        const dept = deptRaw.trim();
        if (!dept) continue;
        if (!dData || typeof dData !== "object" || Array.isArray(dData)) {
          return res.status(400).json({ error: `ข้อมูลฝ่าย "${dept}" ไม่ถูกต้อง` });
        }

        const divisionsRaw = dData.divisions && typeof dData.divisions === "object" && !Array.isArray(dData.divisions)
          ? dData.divisions : {};
        const cleanedDivisions = {};
        let divSum = 0;

        for (const [divRaw, divVal] of Object.entries(divisionsRaw)) {
          const divName = divRaw.trim();
          if (!divName) continue;
          const num = Number(divVal);
          if (!Number.isInteger(num) || num < 0) {
            return res.status(400).json({ error: `กำลังพลของกอง "${divName}" ในฝ่าย "${dept}" ต้องเป็นจำนวนเต็มที่ไม่ติดลบ` });
          }
          cleanedDivisions[divName] = num;
          divSum += num;
        }

        const deptHc = (Number.isInteger(Number(dData.headcount)) && Number(dData.headcount) >= 0)
          ? Number(dData.headcount)
          : divSum;

        cleanedDepts[dept] = {
          headcount: deptHc,
          divisions: cleanedDivisions
        };
        cleanedHeadcount[dept] = deptHc;
      }

      const calculatedSum = Object.values(cleanedHeadcount).reduce((a, b) => a + b, 0);
      const finalTotal = (Number.isInteger(Number(total)) && Number(total) > 0)
        ? Number(total)
        : (calculatedSum > 0 ? calculatedSum : DEFAULT_TOTAL);

      const record = {
        departments: cleanedDepts,
        headcount: cleanedHeadcount,
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

    // รองรับกรณีส่ง headcount แบบ 1 ระดับเดิม (Backwards compatibility)
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
