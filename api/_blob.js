import { put, list } from "@vercel/blob";

const PREFIX = "energysave/responses/";

export async function append(data) {
  if (globalThis.__blobMock) {
    const idx = globalThis.__blobMock.findIndex(r => r.empid === data.empid);
    if (idx >= 0) globalThis.__blobMock.splice(idx, 1);
    globalThis.__blobMock.push(data);
    return;
  }
  // พนักงาน: key = empid, ลูกจ้าง: key = ชื่อ+ฝ่าย
  const normName = s => s.trim().replace(/^(นาย|นางสาว|นาง)\s*/, "").trim();
  const safeStr = s => s.replace(/\s+/g, "_").replace(/[^\w฀-๿]/g, "").slice(0, 40);
  const key = data.empid
    ? `emp-${String(data.empid).replace(/[^a-zA-Z0-9]/g, "_")}`
    : `contractor-${safeStr(normName(data.name))}-${safeStr(data.unit)}`;
  await put(`${PREFIX}${key}.json`, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function readAll() {
  if (globalThis.__blobMock) return [...globalThis.__blobMock];
  const { blobs } = await list({ prefix: PREFIX });
  if (!blobs.length) return [];
  const rows = await Promise.all(blobs.map(async b => {
    const data = await fetch(b.url).then(r => r.json());
    return { ...data, _blobUrl: b.url }; // URL ใช้สำหรับลบ — ไม่ถูก save ลงใน blob
  }));
  return rows.sort((a, b) => new Date(a.at) - new Date(b.at));
}

export async function remove(url) {
  const { del } = await import("@vercel/blob");
  await del(url);
}
