import { list } from "@vercel/blob";
import { Redis } from "@upstash/redis";
import { authed } from "./_auth.js";

const RESPONSES_KEY = "energysave:responses";

export default async function handler(req, res) {
  if (!authed(req, res)) return;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(500).json({ error: "Redis not configured" });

  const r = new Redis({ url, token });

  try {
    const { blobs } = await list({ prefix: "energysave/responses/" });
    if (!blobs || !blobs.length) {
      return res.status(200).json({ ok: false, message: "No blobs found in prefix" });
    }

    let imported = 0;
    const batch = {};
    for (const b of blobs) {
      try {
        const itemRes = await fetch(b.url);
        if (itemRes.ok) {
          const data = await itemRes.json();
          const cleanKey = b.pathname.replace("energysave/responses/", "").replace(".json", "");
          const record = { ...data, _blobUrl: b.url };
          batch[cleanKey] = JSON.stringify(record);
          imported++;
        }
      } catch (err) {
        console.warn("Failed to fetch blob:", b.url, err.message);
      }
    }

    // Remove any baseline placeholder keys before writing real data
    const existing = await r.hgetall(RESPONSES_KEY) || {};
    const baselineKeys = Object.keys(existing).filter(k => k.startsWith("baseline-"));
    if (baselineKeys.length > 0) {
      for (const k of baselineKeys) {
        await r.hdel(RESPONSES_KEY, k);
      }
    }

    // Save batch to Redis in chunks of 50
    const entries = Object.entries(batch);
    for (let i = 0; i < entries.length; i += 50) {
      const chunk = Object.fromEntries(entries.slice(i, i + 50));
      await r.hset(RESPONSES_KEY, chunk);
    }

    const totalNow = await r.hlen(RESPONSES_KEY);
    return res.status(200).json({
      ok: true,
      blobsFound: blobs.length,
      importedCount: imported,
      removedBaselineCount: baselineKeys.length,
      totalInRedisNow: totalNow
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, status: err.status });
  }
}
