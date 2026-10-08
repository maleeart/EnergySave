import ExcelJS from "exceljs";
import { readAll, readHeadcount } from "./_blob.js";
import { authed } from "./_auth.js";
import { DEFAULT_DEPARTMENTS, DEFAULT_HEADCOUNT, DEFAULT_TOTAL } from "./headcount.js";

const TOPICS = ["นโยบายการจัดการพลังงาน", "การจัดองค์กร", "การกระตุ้นและสร้างแรงจูงใจ",
                "ระบบข้อมูลข่าวสาร", "การประชาสัมพันธ์", "การลงทุน"];
const TOTAL_HEADCOUNT = 1700; // กำลังพล กฟผ. ไทรน้อย ทั้งหมด (default)

const FONT = { name: "TH SarabunPSK", size: 14 };
const BLUE = "FF1B4C9E", YELLOW = "FFFDC500", ZEBRA = "FFF4F8FF";
const LIGHT_BLUE = "FFEBF3FC", GREEN_TEXT = "FF059669", RED_TEXT = "FFE11D48", GRAY_TEXT = "FF64748B";
const thin = { style: "thin", color: { argb: "FFCFD9E8" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

const styleHeader = row => {
  row.font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  row.height = 36;
  row.eachCell(c => (c.border = BORDER));
};

const NAVY = "FF0F2C59";
const DEPT_BG = "FFF1F5F9";
const ROW_BG = "FFF8FAFC";

async function handleSummaryExport(all, hcData, res) {
  const departments = (hcData?.departments && Object.keys(hcData.departments).length > 0)
    ? hcData.departments
    : DEFAULT_DEPARTMENTS;
  const HEADCOUNT = (hcData?.headcount && Object.keys(hcData.headcount).length > 0)
    ? hcData.headcount
    : DEFAULT_HEADCOUNT;
  const effectiveTotal = hcData?.total ?? DEFAULT_TOTAL;

  const personId = r => (r.empid && r.empid !== "-" && r.empid !== "(ลูกจ้าง)") ? `emp:${String(r.empid).trim()}` : `contractor:${(r.name || "").trim()}_${(r.unit || "").trim()}`;
  const totalPeople = new Set(all.map(personId)).size;
  const totalHc = effectiveTotal;
  const totalRemaining = totalHc > 0 ? Math.max(0, totalHc - totalPeople) : 0;
  const overallPct = totalHc > 0 ? +(totalPeople / totalHc * 100).toFixed(1) : 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = "แบบประเมินสถานภาพการจัดการพลังงาน กฟผ.";

  const ws = wb.addWorksheet("สรุปความก้าวหน้ารายฝ่าย-กอง", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { key: "dept", width: 22 },
    { key: "division", width: 28 },
    { key: "target", width: 18 },
    { key: "done", width: 18 },
    { key: "remaining", width: 22 },
    { key: "pct", width: 16 },
  ];

  // 1. หัวรายงาน
  const titleRow = ws.addRow(["รายงานสรุปผลการเข้าร่วมแบบประเมินพฤติกรรมการอนุรักษ์พลังงาน กฟผ. ไทรน้อย"]);
  ws.mergeCells(`A${titleRow.number}:F${titleRow.number}`);
  titleRow.font = { ...FONT, size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 36;
  titleRow.eachCell(c => (c.border = BORDER));

  // 2. ข้อมูล ณ วันที่
  const dateStr = new Date().toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const subRow = ws.addRow([`ข้อมูล ณ วันที่: ${dateStr} น.`]);
  ws.mergeCells(`A${subRow.number}:F${subRow.number}`);
  subRow.font = { ...FONT, size: 12, italic: true, color: { argb: "FFDCE7F9" } };
  subRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  subRow.alignment = { horizontal: "center", vertical: "middle" };
  subRow.height = 22;
  subRow.eachCell(c => (c.border = BORDER));

  // 3. หัวตารางข้อมูล (6 คอลัมน์ตามแบบ EPAGO)
  const headerRow = ws.addRow([
    "สังกัดฝ่าย",
    "สังกัดกอง",
    "เป้าหมาย (คน)",
    "ประเมินแล้ว (คน)",
    "ยังไม่ทำ/คงเหลือ (คน)",
    "% ประเมินแล้ว"
  ]);
  styleHeader(headerRow);
  headerRow.height = 30;

  // 4. แถวสรุปภาพรวมทั้งหมด (Grand Total) แสดงบนสุดเพื่อให้เห็นทันทีแบบ EPAGO
  const grandRow = ws.addRow([
    "ภาพรวมทั้งหมด (รวมทุกฝ่าย/ทุกกอง)",
    "",
    totalHc,
    totalPeople,
    totalRemaining,
    `${overallPct.toFixed(1)}%`
  ]);
  ws.mergeCells(`A${grandRow.number}:B${grandRow.number}`);
  grandRow.height = 30;
  grandRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  grandRow.eachCell(c => (c.border = BORDER));
  grandRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  grandRow.getCell(1).font = { ...FONT, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  grandRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
  grandRow.getCell(3).font = { ...FONT, size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  grandRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
  grandRow.getCell(4).font = { ...FONT, size: 14, bold: true, color: { argb: "FF34D399" } };
  grandRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
  grandRow.getCell(5).font = { ...FONT, size: 14, bold: true, color: { argb: "FFFBBF24" } };
  grandRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
  grandRow.getCell(6).font = { ...FONT, size: 14, bold: true, color: { argb: "FF34D399" } };

  const deptList = Object.keys(departments);
  const otherRows = all.filter(r => !deptList.includes(r.unit));
  const allDeptsToRender = [...deptList];
  if (otherRows.length > 0) allDeptsToRender.push("อื่นๆ");

  allDeptsToRender.forEach((dept) => {
    const isOther = dept === "อื่นๆ";
    const dRows = isOther ? otherRows : all.filter(r => r.unit === dept);
    const dPeople = new Set(dRows.map(personId)).size;
    const targetHc = isOther ? 0 : (departments[dept]?.headcount ?? HEADCOUNT[dept] ?? 0);
    const dRemaining = targetHc > 0 ? Math.max(0, targetHc - dPeople) : 0;
    const dPct = targetHc > 0 ? +(dPeople / targetHc * 100).toFixed(1) : (dPeople > 0 ? 100 : 0);

    const dDivs = isOther ? {} : (departments[dept]?.divisions || {});
    const divNames = isOther ? [] : [...new Set([...Object.keys(dDivs), ...dRows.filter(r => r.subUnit).map(r => r.subUnit)])].sort();

    const startDeptRowNum = ws.rowCount + 1;
    const totalDeptRows = 1 + divNames.length;
    const endDeptRowNum = startDeptRowNum + totalDeptRows - 1;

    // Dept Summary Row
    const deptCompColor = targetHc > 0 ? (dPct >= 80 ? "FF059669" : dPct >= 50 ? "FFD97706" : "FFDC2626") : "FF64748B";
    const deptRow = ws.addRow([
      dept,
      "ภาพรวมฝ่าย (รวมทุกกอง)",
      targetHc > 0 ? targetHc : "—",
      dPeople,
      targetHc > 0 ? dRemaining : "—",
      targetHc > 0 ? `${dPct.toFixed(1)}%` : "—"
    ]);
    deptRow.height = 26;
    deptRow.font = { ...FONT, bold: true };
    deptRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_BG } };
    deptRow.eachCell(c => (c.border = BORDER));
    deptRow.getCell(2).font = { ...FONT, bold: true, color: { argb: "FF1B4C9E" } };
    deptRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(4).font = { ...FONT, bold: true, color: { argb: "FF059669" } };
    deptRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(5).font = { ...FONT, bold: true, color: { argb: "FFD97706" } };
    deptRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(6).font = { ...FONT, bold: true, color: { argb: deptCompColor } };

    // Division rows
    divNames.forEach((divName) => {
      const divRows = dRows.filter(r => r.subUnit === divName);
      const divPeople = new Set(divRows.map(personId)).size;
      const divTargetHc = dDivs[divName] ?? 0;
      const divRemaining = divTargetHc > 0 ? Math.max(0, divTargetHc - divPeople) : 0;
      const divPct = divTargetHc > 0 ? +(divPeople / divTargetHc * 100).toFixed(1) : (divPeople > 0 ? 100 : 0);
      const divCompColor = divTargetHc > 0 ? (divPct >= 80 ? "FF059669" : divPct >= 50 ? "FFD97706" : "FFDC2626") : "FF64748B";

      const divRow = ws.addRow([
        "",
        `↳ ${divName}`,
        divTargetHc > 0 ? divTargetHc : "—",
        divPeople,
        divTargetHc > 0 ? divRemaining : "—",
        divTargetHc > 0 ? `${divPct.toFixed(1)}%` : "—"
      ]);
      divRow.height = 22;
      divRow.font = FONT;
      divRow.eachCell(c => (c.border = BORDER));
      divRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      divRow.getCell(2).font = { ...FONT, color: { argb: "FF334155" } };
      divRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(4).font = { ...FONT, bold: true, color: { argb: "FF059669" } };
      divRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(5).font = { ...FONT, bold: true, color: { argb: "FFD97706" } };
      divRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(6).font = { ...FONT, bold: true, color: { argb: divCompColor } };
    });

    // Merge Department Cell across all rows of this department
    if (totalDeptRows > 1) {
      ws.mergeCells(startDeptRowNum, 1, endDeptRowNum, 1);
    }
    const mergedDeptCell = ws.getCell(startDeptRowNum, 1);
    mergedDeptCell.alignment = { horizontal: "center", vertical: "middle" };
    mergedDeptCell.font = { ...FONT, bold: true, size: 14, color: { argb: "FF0F2C59" } };
    mergedDeptCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DEPT_BG } };
    for (let r = startDeptRowNum; r <= endDeptRowNum; r++) {
      ws.getCell(r, 1).border = BORDER;
    }
  });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("content-disposition", `attachment; filename="EnergySave_Summary_Report_${stamp}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}

export default async function handler(req, res) {
  if (!authed(req, res)) return;

  const all = await readAll();
  const hcData = await readHeadcount();

  if (req.query?.type === "summary" || req.query?.mode === "progress") {
    return await handleSummaryExport(all, hcData, res);
  }

  const HEADCOUNT = hcData?.headcount ?? {};
  const effectiveTotal = hcData?.total ?? TOTAL_HEADCOUNT;

  const unit = req.query?.unit || "";
  const q = (req.query?.q || "").trim().toLowerCase();
  const rows = all
    .filter(r => !unit || r.unit === unit)
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.empid.toLowerCase().includes(q));

  const participated = new Set(rows.map(r => r.empid)).size;
  const currentHeadcount = unit ? (HEADCOUNT[unit] ?? 0) : effectiveTotal;
  const pct = currentHeadcount ? +(participated / currentHeadcount * 100).toFixed(1) : null;

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
    const unitLabel = r.subUnit ? `${r.unit} / ${r.subUnit}` : r.unit;
    const row = ws.addRow({
      no: i + 1,
      at: new Date(r.at).toLocaleString("th-TH"),
      name: r.name, empid: r.empid, unit: unitLabel,
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
    ["กำลังพลทั้งหมด", currentHeadcount, "คน"],
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
