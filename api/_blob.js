import { put, list } from "@vercel/blob";

const PREFIX = "energysave/responses/";

export async function append(data) {
  // ponytail: __blobMock เป็น test seam — ใช้เฉพาะใน test.mjs
  if (globalThis.__blobMock) { globalThis.__blobMock.push(data); return; }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await put(`${PREFIX}${id}.json`, JSON.stringify(data), { access: "public" });
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
