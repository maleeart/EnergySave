import { put, list } from "@vercel/blob";

const PREFIX = "energysave/responses/";

export async function append(data) {
  if (globalThis.__blobMock) {
    let idx = -1;
    if (data._blobUrl) {
      idx = globalThis.__blobMock.findIndex(r => r._blobUrl === data._blobUrl);
    }
    if (idx === -1 && data.empid) {
      idx = globalThis.__blobMock.findIndex(r => r.empid === data.empid && r.empid !== null);
    }
    if (idx >= 0) {
      globalThis.__blobMock[idx] = data;
    } else {
      globalThis.__blobMock.push(data);
    }
    return { url: data._blobUrl || `mock-url-${Math.random()}` };
  }
  // พนักงาน: key = empid, ลูกจ้าง: key = ชื่อ+ฝ่าย
  const normName = s => s.trim().replace(/^(นาย|นางสาว|นาง)\s*/, "").trim();
  const safeStr = s => s.replace(/\s+/g, "_").replace(/[^\w฀-๿]/g, "").slice(0, 40);
  const key = data.empid
    ? `emp-${String(data.empid).replace(/[^a-zA-Z0-9]/g, "_")}`
    : `contractor-${safeStr(normName(data.name))}-${safeStr(data.unit)}`;
  return await put(`${PREFIX}${key}.json`, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function readAll() {
  if (globalThis.__blobMock) return [...globalThis.__blobMock].map((r, i) => ({ ...r, _blobUrl: r._blobUrl || `mock-url-${i}` }));
  const { blobs } = await list({ prefix: PREFIX });
  if (!blobs.length) return [];
  const rows = await Promise.all(blobs.map(async b => {
    const data = await fetch(b.url).then(r => r.json());
    return { ...data, _blobUrl: b.url }; // URL ใช้สำหรับลบ — ไม่ถูก save ลงใน blob
  }));
  return rows.sort((a, b) => new Date(a.at) - new Date(b.at));
}

export async function remove(url) {
  if (globalThis.__blobMock) {
    const idx = globalThis.__blobMock.findIndex(r => r._blobUrl === url);
    if (idx >= 0) globalThis.__blobMock.splice(idx, 1);
    return;
  }
  const { del } = await import("@vercel/blob");
  await del(url);
}

const CONFIG_HEADCOUNT_KEY = "energysave/config/headcount.json";

export async function saveHeadcount(data) {
  if (globalThis.__blobMock !== undefined || !process.env.BLOB_READ_WRITE_TOKEN) {
    globalThis.__headcountMock = data;
    return;
  }
  await put(CONFIG_HEADCOUNT_KEY, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function readHeadcount() {
  if (globalThis.__blobMock !== undefined || !process.env.BLOB_READ_WRITE_TOKEN) {
    return globalThis.__headcountMock ?? null;
  }
  try {
    const { blobs } = await list({ prefix: "energysave/config/" });
    const b = blobs.find(x => x.pathname === CONFIG_HEADCOUNT_KEY || x.pathname.endsWith("headcount.json"));
    if (!b) return null;
    return await fetch(b.url).then(r => r.json()).catch(() => null);
  } catch (err) {
    console.warn("[readHeadcount] blob read error, fallback to mock/null:", err.message);
    return globalThis.__headcountMock ?? null;
  }
}
