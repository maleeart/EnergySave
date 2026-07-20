import ExcelJS from "exceljs";
import { readAll } from "./_blob.js";
import { authed } from "./_auth.js";

const TOPICS = ["นโยบายการจัดการพลังงาน", "การจัดองค์กร", "การกระตุ้นและสร้างแรงจูงใจ",
                "ระบบข้อมูลข่าวสาร", "การประชาสัมพันธ์", "การลงทุน"];
const TOTAL_HEADCOUNT = 1700; // กำลังพล กฟผ. ไทรน้อย ทั้งหมด

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

  const all = await readAll();
  const unit = req.query?.unit || "";
  const q = (req.query?.q || "").trim().toLowerCase();
  const rows = all
    .filter(r => !unit || r.unit === unit)
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.empid.toLowerCase().includes(q));

  const participated = new Set(rows.map(r => r.empid)).size;
  const pct = TOTAL_HEADCOUNT ? +(participated / TOTAL_HEADCOUNT * 100).toFixed(1) : null;

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
  ];
  styleHeader(ws.getRow(1));

  rows.forEach((r, i) => {
    const row = ws.addRow({
      no: i + 1,
      at: new Date(r.at).toLocaleString("th-TH"),
      name: r.name, empid: r.empid, unit: r.unit,
      ...Object.fromEntries(r.scores.map((s, j) => ["q" + j, s])),
    });
    row.font = FONT;
    row.alignment = { vertical: "top", wrapText: true };   // ข้อความยาวขึ้นบรรทัดใหม่ ไม่ล้นออกนอกช่อง
    row.eachCell(c => (c.border = BORDER));
    if (i % 2) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    ["no", "empid", ...TOPICS.map((_, j) => "q" + j)]
      .forEach(k => (row.getCell(k).alignment = { horizontal: "center", vertical: "top" }));
  });
  if (rows.length) ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columnCount } };

  // --- ชีต 2: สรุปสำหรับกรอก e-service ---
  const avgs = TOPICS.map((_, i) =>
    rows.length ? rows.reduce((s, r) => s + r.scores[i], 0) / rows.length : 0);
  const overall = rows.length ? avgs.reduce((a, b) => a + b, 0) / 6 : 0;

  const sum = wb.addWorksheet("สรุปสำหรับ e-service");
  sum.columns = [{ key: "c1", width: 40 }, { key: "c2", width: 15 }, { key: "c3", width: 15 }];

  // แถวหัวสถิติการเข้าร่วม (merged, สีน้ำเงิน)
  const titleRow = sum.addRow([`สถิติการเข้าร่วมประเมิน${unit ? ` — ${unit}` : ""}`, "", ""]);
  sum.mergeCells(`A${titleRow.number}:C${titleRow.number}`);
  titleRow.font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 28;
  titleRow.eachCell(c => (c.border = BORDER));

  for (const [label, val, u] of [
    ["ผู้เข้าร่วมประเมิน", participated, "คน"],
    ["กำลังพลทั้งหมด", TOTAL_HEADCOUNT, "คน"],
    ["คิดเป็นร้อยละ", pct ?? "—", pct !== null ? "%" : ""],
  ]) {
    const r = sum.addRow([label, val, u]);
    r.font = FONT;
    r.alignment = { vertical: "middle" };
    r.getCell(2).alignment = r.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    r.eachCell(c => (c.border = BORDER));
  }

  sum.addRow([]); // คั่นระหว่างสถิติกับตาราง EMM

  // หัวตาราง EMM
  styleHeader(sum.addRow(["หัวข้อ EMM", "คะแนนเฉลี่ย", "ระดับที่กรอก"]));

  // แถวหัวข้อ EMM 1–6
  avgs.forEach((v, i) => {
    const row = sum.addRow([`${i + 1}. ${TOPICS[i]}`, +v.toFixed(2), Math.round(v)]);
    row.font = FONT;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell(c => (c.border = BORDER));
    row.getCell(2).alignment = row.getCell(3).alignment = { horizontal: "center" };
    row.getCell(3).font = { ...FONT, bold: true };
  });

  // แถวภาพรวม
  const last = sum.addRow([
    `ภาพรวม${unit ? ` (${unit})` : ""} — ${rows.length} คน`,
    +overall.toFixed(2), Math.round(overall),
  ]);
  last.font = { ...FONT, bold: true };
  last.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  last.eachCell(c => (c.border = BORDER));
  last.getCell(2).alignment = last.getCell(3).alignment = { horizontal: "center" };

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("content-disposition", `attachment; filename="energy-emm-${stamp}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}
