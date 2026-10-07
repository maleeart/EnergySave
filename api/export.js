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

async function handleSummaryExport(all, hcData, res) {
  const departments = (hcData?.departments && Object.keys(hcData.departments).length > 0)
    ? hcData.departments
    : DEFAULT_DEPARTMENTS;
  const HEADCOUNT = (hcData?.headcount && Object.keys(hcData.headcount).length > 0)
    ? hcData.headcount
    : DEFAULT_HEADCOUNT;
  const effectiveTotal = hcData?.total ?? DEFAULT_TOTAL;

  const personId = r => r.empid ? String(r.empid).trim() : `__${(r.name || "").trim()}__${r.unit || ""}`;
  const totalPeople = new Set(all.map(personId)).size;
  const totalHc = effectiveTotal;
  const totalRemaining = totalHc > 0 ? Math.max(0, totalHc - totalPeople) : 0;
  const overallPct = totalHc > 0 ? +(totalPeople / totalHc * 100).toFixed(1) : 0;

  const wb = new ExcelJS.Workbook();
  wb.creator = "แบบประเมินสถานภาพการจัดการพลังงาน กฟผ.";

  const ws = wb.addWorksheet("สรุปความก้าวหน้ารายฝ่าย-กอง", {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = [
    { key: "no", width: 10 },
    { key: "dept", width: 20 },
    { key: "division", width: 24 },
    { key: "target", width: 20 },
    { key: "done", width: 18 },
    { key: "remaining", width: 22 },
    { key: "pct", width: 16 },
    { key: "status", width: 24 },
  ];

  // 1. หัวรายงาน
  const titleRow = ws.addRow(["รายงานสรุปความก้าวหน้าการตอบแบบประเมินสถานภาพการจัดการพลังงาน (EMM) กฟผ. ไทรน้อย"]);
  ws.mergeCells(`A${titleRow.number}:H${titleRow.number}`);
  titleRow.font = { ...FONT, size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  titleRow.alignment = { horizontal: "center", vertical: "middle" };
  titleRow.height = 36;
  titleRow.eachCell(c => (c.border = BORDER));

  // 2. ข้อมูล ณ วันที่
  const dateStr = new Date().toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const subRow = ws.addRow([`ข้อมูล ณ วันที่: ${dateStr} น. | จำแนกตามฝ่ายและกอง (เฉพาะจำนวนบุคลากร)`]);
  ws.mergeCells(`A${subRow.number}:H${subRow.number}`);
  subRow.font = { ...FONT, size: 12, italic: true, color: { argb: "FFDCE7F9" } };
  subRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  subRow.alignment = { horizontal: "center", vertical: "middle" };
  subRow.height = 22;
  subRow.eachCell(c => (c.border = BORDER));

  ws.addRow([]); // ว่างแถว 3

  // 4-5. KPI สรุปภาพรวม
  const kpiHeadRow = ws.addRow([
    "กำลังพลเป้าหมายทั้งหมด", "",
    "เข้าร่วมประเมินแล้ว", "",
    "ยังไม่ทำ (คงเหลือ)", "",
    "ความคืบหน้าภาพรวม", ""
  ]);
  const kpiValRow = ws.addRow([
    `${totalHc.toLocaleString()} คน`, "",
    `${totalPeople.toLocaleString()} คน`, "",
    `${totalRemaining.toLocaleString()} คน`, "",
    `${overallPct.toFixed(1)}%`, ""
  ]);
  ws.mergeCells(`A${kpiHeadRow.number}:B${kpiHeadRow.number}`);
  ws.mergeCells(`C${kpiHeadRow.number}:D${kpiHeadRow.number}`);
  ws.mergeCells(`E${kpiHeadRow.number}:F${kpiHeadRow.number}`);
  ws.mergeCells(`G${kpiHeadRow.number}:H${kpiHeadRow.number}`);
  ws.mergeCells(`A${kpiValRow.number}:B${kpiValRow.number}`);
  ws.mergeCells(`C${kpiValRow.number}:D${kpiValRow.number}`);
  ws.mergeCells(`E${kpiValRow.number}:F${kpiValRow.number}`);
  ws.mergeCells(`G${kpiValRow.number}:H${kpiValRow.number}`);

  kpiHeadRow.height = 20;
  kpiHeadRow.font = { ...FONT, size: 12, bold: true, color: { argb: GRAY_TEXT } };
  kpiHeadRow.alignment = { horizontal: "center", vertical: "middle" };

  kpiValRow.height = 30;
  kpiValRow.font = { ...FONT, size: 16, bold: true };
  kpiValRow.alignment = { horizontal: "center", vertical: "middle" };
  kpiValRow.getCell(3).font = { ...FONT, size: 16, bold: true, color: { argb: GREEN_TEXT } };
  kpiValRow.getCell(5).font = { ...FONT, size: 16, bold: true, color: { argb: RED_TEXT } };
  kpiValRow.getCell(7).font = { ...FONT, size: 16, bold: true, color: { argb: BLUE } };

  [kpiHeadRow, kpiValRow].forEach(r => {
    r.eachCell(c => {
      c.border = BORDER;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });

  ws.addRow([]); // ว่างแถว 6

  // 7. หัวตารางข้อมูล
  const headerRow = ws.addRow([
    "ลำดับ",
    "สังกัดฝ่าย",
    "สังกัดกอง",
    "กำลังพลเป้าหมาย (คน)",
    "ประเมินแล้ว (คน)",
    "ยังไม่ทำ / คงเหลือ (คน)",
    "ความคืบหน้า (%)",
    "สถานะการติดตาม"
  ]);
  styleHeader(headerRow);
  headerRow.height = 30;

  const getStatus = (done, target, pct) => {
    if (target === 0 && done === 0) return "—";
    if (pct >= 100) return "ครบตามเป้าหมาย (100%)";
    if (done === 0) return "ยังไม่มีผู้ประเมิน";
    if (pct < 50) return "ต้องเร่งรัดติดตาม";
    return "กำลังดำเนินการ";
  };

  const deptList = Object.keys(departments);
  const otherRows = all.filter(r => !deptList.includes(r.unit));
  const allDeptsToRender = [...deptList];
  if (otherRows.length > 0) allDeptsToRender.push("อื่นๆ");

  allDeptsToRender.forEach((dept, deptIdx) => {
    const isOther = dept === "อื่นๆ";
    const dRows = isOther ? otherRows : all.filter(r => r.unit === dept);
    const dPeople = new Set(dRows.map(personId)).size;
    const targetHc = isOther ? 0 : (departments[dept]?.headcount ?? HEADCOUNT[dept] ?? 0);
    const dRemaining = targetHc > 0 ? Math.max(0, targetHc - dPeople) : 0;
    const dPct = targetHc > 0 ? +(dPeople / targetHc * 100).toFixed(1) : (dPeople > 0 ? 100 : 0);

    const deptRow = ws.addRow([
      deptIdx + 1,
      dept,
      "รวมระดับฝ่าย",
      targetHc ? targetHc : "—",
      dPeople,
      targetHc ? dRemaining : "—",
      targetHc > 0 ? `${dPct.toFixed(1)}%` : "—",
      getStatus(dPeople, targetHc, dPct)
    ]);
    deptRow.height = 25;
    deptRow.font = { ...FONT, bold: true };
    deptRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    deptRow.eachCell(c => (c.border = BORDER));
    deptRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    deptRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    deptRow.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
    if (targetHc > 0) {
      if (dRemaining > 0) deptRow.getCell(6).font = { ...FONT, bold: true, color: { argb: RED_TEXT } };
      else deptRow.getCell(6).font = { ...FONT, bold: true, color: { argb: GREEN_TEXT } };
    }

    if (isOther) return;

    const dDivs = departments[dept]?.divisions || {};
    const divNames = [...new Set([...Object.keys(dDivs), ...dRows.filter(r => r.subUnit).map(r => r.subUnit)])].sort();

    divNames.forEach((divName, divIdx) => {
      const divRows = dRows.filter(r => r.subUnit === divName);
      const divPeople = new Set(divRows.map(personId)).size;
      const divTargetHc = dDivs[divName] ?? 0;
      const divRemaining = divTargetHc > 0 ? Math.max(0, divTargetHc - divPeople) : 0;
      const divPct = divTargetHc > 0 ? +(divPeople / divTargetHc * 100).toFixed(1) : (divPeople > 0 ? 100 : 0);

      const divRow = ws.addRow([
        `${deptIdx + 1}.${divIdx + 1}`,
        dept,
        `↳ ${divName}`,
        divTargetHc ? divTargetHc : "—",
        divPeople,
        divTargetHc ? divRemaining : "—",
        divTargetHc > 0 ? `${divPct.toFixed(1)}%` : "—",
        getStatus(divPeople, divTargetHc, divPct)
      ]);
      divRow.height = 22;
      divRow.font = FONT;
      divRow.eachCell(c => (c.border = BORDER));
      if (divIdx % 2 === 1) {
        divRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
      divRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      divRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
      divRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      divRow.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      if (divTargetHc > 0) {
        if (divRemaining > 0) divRow.getCell(6).font = { ...FONT, color: { argb: RED_TEXT } };
        else divRow.getCell(6).font = { ...FONT, color: { argb: GREEN_TEXT } };
      }
    });
  });

  // แถวสรุปภาพรวมทั้งหมด (Grand Total)
  const totalRow = ws.addRow([
    "รวม",
    "ภาพรวมทั้งหมด",
    "กฟผ. ไทรน้อย",
    totalHc,
    totalPeople,
    totalRemaining,
    `${overallPct.toFixed(1)}%`,
    overallPct >= 100 ? "ครบตามเป้าหมาย (100%)" : `ความคืบหน้าภาพรวม ${overallPct.toFixed(1)}%`
  ]);
  totalRow.height = 28;
  totalRow.font = { ...FONT, size: 15, bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  totalRow.eachCell(c => (c.border = BORDER));
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  totalRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
  if (totalRemaining > 0) {
    totalRow.getCell(6).font = { ...FONT, size: 15, bold: true, color: { argb: RED_TEXT } };
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("content-disposition", `attachment; filename="energy-progress-summary-${stamp}.xlsx"`);
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
