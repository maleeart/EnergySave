import ExcelJS from "exceljs";
import { redis, KEY } from "./_redis.js";
import { authed } from "./_auth.js";

// หัวข้อ EMM — ต้องตรงกับ MATRIX ใน index.html (ชุดนี้เป็นมาตรฐาน พพ. ไม่เปลี่ยน)
const TOPICS = ["นโยบายการจัดการพลังงาน", "การจัดองค์กร", "การกระตุ้นและสร้างแรงจูงใจ",
                "ระบบข้อมูลข่าวสาร", "การประชาสัมพันธ์", "การลงทุน"];

const FONT = { name: "TH SarabunPSK", size: 14 };
const BLUE = "FF1B4C9E", YELLOW = "FFFDC500", ZEBRA = "FFF4F8FF";
const thin = { style: "thin", color: { argb: "FFCFD9E8" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

const styleHeader = row => {
  row.font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  row.height = 42;
  row.eachCell(c => (c.border = BORDER));
};

export default async function handler(req, res) {
  if (!authed(req, res)) return;

  const raw = await redis().lrange(KEY, 0, -1);
  const all = raw.map(r => (typeof r === "string" ? JSON.parse(r) : r));
  const unit = req.query?.unit || "";
  const rows = unit ? all.filter(r => r.unit === unit) : all;

  const wb = new ExcelJS.Workbook();
  wb.creator = "แบบประเมินสถานภาพการจัดการพลังงาน กฟผ.";

  // --- ชีต 1: คำตอบรายบุคคล ---
  const ws = wb.addWorksheet("ผลประเมินรายบุคคล", {
    views: [{ state: "frozen", ySplit: 1 }],           // ตรึงหัวตารางไว้ตอนเลื่อน
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { header: "ลำดับ", key: "no", width: 7 },
    { header: "วันที่ตอบ", key: "at", width: 20 },
    { header: "ชื่อ - สกุล", key: "name", width: 28 },
    { header: "รหัสพนักงาน", key: "empid", width: 14 },
    { header: "สังกัด", key: "unit", width: 16 },
    ...TOPICS.map((t, i) => ({ header: `${i + 1}. ${t}`, key: "q" + i, width: 13 })),
    { header: "คะแนนเฉลี่ย", key: "avg", width: 12 },
  ];
  styleHeader(ws.getRow(1));

  rows.forEach((r, i) => {
    const row = ws.addRow({
      no: i + 1,
      at: new Date(r.at).toLocaleString("th-TH"),
      name: r.name, empid: r.empid, unit: r.unit,
      ...Object.fromEntries(r.scores.map((s, j) => ["q" + j, s])),
      avg: +(r.scores.reduce((a, b) => a + b, 0) / 6).toFixed(2),
    });
    row.font = FONT;
    row.alignment = { vertical: "top", wrapText: true };   // ข้อความยาวขึ้นบรรทัดใหม่ ไม่ล้นออกนอกช่อง
    row.eachCell(c => (c.border = BORDER));
    if (i % 2) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    ["no", "empid", ...TOPICS.map((_, j) => "q" + j), "avg"]
      .forEach(k => (row.getCell(k).alignment = { horizontal: "center", vertical: "top" }));
  });
  if (rows.length) ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };

  // --- ชีต 2: สรุปสำหรับกรอก e-service ---
  const sum = wb.addWorksheet("สรุปสำหรับ e-service");
  sum.columns = [
    { header: "หัวข้อ EMM", key: "topic", width: 40 },
    { header: "คะแนนเฉลี่ย", key: "avg", width: 15 },
    { header: "ระดับที่กรอก", key: "lvl", width: 15 },
  ];
  styleHeader(sum.getRow(1));

  const avgs = TOPICS.map((_, i) =>
    rows.length ? rows.reduce((s, r) => s + r.scores[i], 0) / rows.length : 0);

  avgs.forEach((v, i) => {
    const row = sum.addRow({ topic: `${i + 1}. ${TOPICS[i]}`, avg: +v.toFixed(2), lvl: Math.round(v) });
    row.font = FONT;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell(c => (c.border = BORDER));
    row.getCell("avg").alignment = row.getCell("lvl").alignment = { horizontal: "center" };
    row.getCell("lvl").font = { ...FONT, bold: true };
  });

  const overall = rows.length ? avgs.reduce((a, b) => a + b, 0) / 6 : 0;
  const last = sum.addRow({
    topic: `ภาพรวม${unit ? ` (${unit})` : ""} — ${rows.length} คน`,
    avg: +overall.toFixed(2), lvl: Math.round(overall),
  });
  last.font = { ...FONT, bold: true };
  last.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  last.eachCell(c => (c.border = BORDER));
  last.getCell("avg").alignment = last.getCell("lvl").alignment = { horizontal: "center" };

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("content-disposition", `attachment; filename="energy-emm-${stamp}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}
