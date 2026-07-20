import { put, list } from "@vercel/blob";

const PREFIX = "energysave/responses/";

export async function append(data) {
  if (globalThis.__blobMock) {
    const idx = globalThis.__blobMock.findIndex(r => r.empid === data.empid);
    if (idx >= 0) globalThis.__blobMock.splice(idx, 1);
    globalThis.__blobMock.push(data);
    return;
  }
  // ใช้ empid เป็น key → put() เขียนทับอัตโนมัติเมื่อรหัสเดิมส่งซ้ำ
  const safe = String(data.empid).replace(/[^a-zA-Z0-9]/g, "_");
  await put(`${PREFIX}emp-${safe}.json`, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
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
