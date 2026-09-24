import { put, list } from "@vercel/blob";

const PREFIX = "energysave/responses/";

export const normName = s => {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .replace(/^(?:นาย|นางสาว|นาง|น\s*\.\s*ส\s*\.?|นส\.|นส\s+|ด\s*\.\s*[ชญ]\s*\.?|ด[ชญ]\.|ด[ชญ]\s+)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

export async function append(data) {
  if (globalThis.__blobMock) {
    let idx = -1;
    if (data._blobUrl) {
      idx = globalThis.__blobMock.findIndex(r => r._blobUrl === data._blobUrl);
    }
    if (idx === -1 && data.oldUrl) {
      idx = globalThis.__blobMock.findIndex(r => r._blobUrl === data.oldUrl);
    }
    if (idx === -1 && data.empid) {
      idx = globalThis.__blobMock.findIndex(r => r.empid && String(r.empid).trim() === String(data.empid).trim());
    }
    if (idx === -1 && data.name) {
      idx = globalThis.__blobMock.findIndex(r => normName(r.name) === normName(data.name));
    }
    const { oldUrl, ...saveData } = data;
    if (idx >= 0) {
      const existingUrl = globalThis.__blobMock[idx]._blobUrl;
      globalThis.__blobMock[idx] = { ...saveData, _blobUrl: existingUrl };
      return { url: existingUrl };
    } else {
      const mockUrl = data._blobUrl || `mock-url-${Math.random()}`;
      globalThis.__blobMock.push({ ...saveData, _blobUrl: mockUrl });
      return { url: mockUrl };
    }
  }
  // พนักงาน: key = empid, ลูกจ้าง: key = ชื่อ (ไม่รวมฝ่าย เพื่อป้องกันไฟล์ซ้ำกรณีเปลี่ยนสังกัด)
  const safeStr = s => s.replace(/\s+/g, "_").replace(/[^\w฀-๿]/g, "").slice(0, 40);
  const key = data.empid
    ? `emp-${String(data.empid).replace(/[^a-zA-Z0-9]/g, "_")}`
    : `contractor-${safeStr(normName(data.name))}`;
  const { oldUrl, ...saveData } = data;
  const res = await put(`${PREFIX}${key}.json`, JSON.stringify(saveData), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  if (oldUrl && oldUrl !== res.url) {
    try {
      await remove(oldUrl);
    } catch (err) {
      console.warn("[append] failed to remove old blob:", err.message);
    }
  }
  return res;
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
