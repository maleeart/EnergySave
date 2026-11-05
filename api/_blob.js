import { Redis } from "@upstash/redis";

const PREFIX = "energysave/responses/";
const RESPONSES_KEY = "energysave:responses";
const CONFIG_HEADCOUNT_KEY = "energysave:headcount";

const getRedis = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export const normName = s => {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, "") // ตัด zero-width space และ invisible chars
    .replace(/\u00A0/g, " ") // non-breaking space
    .trim()
    .replace(/^(?:นาย|นางสาว|นาง|น\s*\.\s*ส\s*\.?|นส\.|นส\s+|ด\s*\.\s*[ชญ]\s*\.?|ด[ชญ]\.|ด[ชญ]\s+)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const safeStr = s => (s || "")
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .replace(/\s+/g, "_")
  .replace(/[^\w฀-๿]/g, "")
  .slice(0, 40);

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

  const key = data.empid
    ? `emp-${String(data.empid).replace(/[^a-zA-Z0-9]/g, "_")}`
    : `contractor-${safeStr(normName(data.name))}`;
  const { oldUrl, ...saveData } = data;

  const r = getRedis();
  if (r) {
    const record = { ...saveData, _blobUrl: key };
    await r.hset(RESPONSES_KEY, { [key]: JSON.stringify(record) });
    if (oldUrl && oldUrl !== key) {
      try {
        await r.hdel(RESPONSES_KEY, oldUrl);
      } catch (err) {
        console.warn("[append] failed to remove old record:", err.message);
      }
    }
    return { url: key };
  }

  // Fallback to Vercel Blob if redis not configured
  try {
    const { put } = await import("@vercel/blob");
    const res = await put(`${PREFIX}${key}.json`, JSON.stringify(saveData), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return res;
  } catch (err) {
    console.error("[append] storage error:", err.message);
    throw err;
  }
}

export async function findRecord({ name, empid, type }) {
  if (globalThis.__blobMock) {
    const norm = normName(name || "");
    const rows = globalThis.__blobMock.slice().reverse();
    return rows.find(r => {
      if (empid && r.empid) {
        return String(r.empid).trim().toLowerCase() === String(empid).trim().toLowerCase();
      }
      if (r.name && normName(r.name) === norm) {
        if (empid && r.empid && String(r.empid).trim().toLowerCase() !== String(empid).trim().toLowerCase()) {
          return false;
        }
        return true;
      }
      return false;
    }) ?? null;
  }

  const norm = normName(name || "");
  const cleanEmpid = empid ? String(empid).trim().replace(/[^a-zA-Z0-9]/g, "_") : null;
  const safeName = safeStr(norm);

  const r = getRedis();
  if (r) {
    if (cleanEmpid) {
      const raw = await r.hget(RESPONSES_KEY, `emp-${cleanEmpid}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return { ...parsed, _blobUrl: `emp-${cleanEmpid}` };
      }
    }
    if (safeName) {
      const raw = await r.hget(RESPONSES_KEY, `contractor-${safeName}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        return { ...parsed, _blobUrl: `contractor-${safeName}` };
      }
    }

    const allRows = await readAll();
    return allRows.slice().reverse().find(row => {
      if (empid && row.empid) {
        return String(row.empid).trim().toLowerCase() === String(empid).trim().toLowerCase();
      }
      if (row.name && normName(row.name) === norm) {
        if (empid && row.empid && String(row.empid).trim().toLowerCase() !== String(row.empid).trim().toLowerCase()) {
          return false;
        }
        return true;
      }
      return false;
    }) ?? null;
  }

  // Fallback to Vercel Blob if redis not configured
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });
    if (!blobs || !blobs.length) return null;
    const candidates = blobs.filter(b => {
      const p = decodeURIComponent(b.pathname);
      if (cleanEmpid && p.includes(`emp-${cleanEmpid}`)) return true;
      if (safeName && p.includes(safeName)) return true;
      if (name && p.includes(safeStr(name))) return true;
      return false;
    });
    for (const b of candidates) {
      try {
        const data = await fetch(b.url).then(res => res.json());
        const record = { ...data, _blobUrl: b.url };
        if (empid && record.empid && String(record.empid).trim().toLowerCase() === String(empid).trim().toLowerCase()) return record;
        if (record.name && normName(record.name) === norm) return record;
      } catch {}
    }
  } catch {}
  return null;
}

export async function readAll() {
  if (globalThis.__blobMock) return [...globalThis.__blobMock].map((r, i) => ({ ...r, _blobUrl: r._blobUrl || `mock-url-${i}` }));

  const r = getRedis();
  if (r) {
    const map = await r.hgetall(RESPONSES_KEY);
    if (!map) return [];
    const rows = Object.entries(map).map(([k, v]) => {
      try {
        const data = typeof v === "string" ? JSON.parse(v) : v;
        return { ...data, _blobUrl: data._blobUrl || k };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    return rows.sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });
    if (!blobs.length) return [];
    const rows = (await Promise.all(blobs.map(async b => {
      try {
        const data = await fetch(b.url).then(res => res.json());
        return { ...data, _blobUrl: b.url };
      } catch {
        return null;
      }
    }))).filter(Boolean);
    return rows.sort((a, b) => new Date(a.at) - new Date(b.at));
  } catch {
    return [];
  }
}

export async function remove(url) {
  if (globalThis.__blobMock) {
    const idx = globalThis.__blobMock.findIndex(r => r._blobUrl === url);
    if (idx >= 0) globalThis.__blobMock.splice(idx, 1);
    return;
  }

  const r = getRedis();
  if (r) {
    const key = url ? url.replace(/^.*[\\\/]/, "").replace(/\.json$/, "") : url;
    await r.hdel(RESPONSES_KEY, key);
    return;
  }

  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch (err) {
    console.warn("[remove] delete error:", err.message);
  }
}

export async function saveHeadcount(data) {
  if (globalThis.__blobMock !== undefined) {
    globalThis.__headcountMock = data;
    return;
  }

  const r = getRedis();
  if (r) {
    await r.set(CONFIG_HEADCOUNT_KEY, JSON.stringify(data));
    return;
  }

  try {
    const { put } = await import("@vercel/blob");
    await put("energysave/config/headcount.json", JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } catch (err) {
    console.warn("[saveHeadcount] error:", err.message);
  }
}

export async function readHeadcount() {
  if (globalThis.__blobMock !== undefined) {
    return globalThis.__headcountMock ?? null;
  }

  const r = getRedis();
  if (r) {
    const data = await r.get(CONFIG_HEADCOUNT_KEY);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : data;
  }

  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: "energysave/config/" });
    const b = blobs.find(x => x.pathname.endsWith("headcount.json"));
    if (!b) return null;
    return await fetch(`${b.url}?t=${Date.now()}`).then(res => res.json());
  } catch {
    return null;
  }
}
