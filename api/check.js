import { findRecord } from "./_blob.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { name, empid, type } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "bad request" });
  }

  try {
    const match = await findRecord({ name: name.trim(), empid: empid?.trim() || null, type });
    if (!match) return res.status(404).json({ error: "not found" });
    const { _blobUrl, ...safe } = match;
    res.status(200).json({ ...safe, url: _blobUrl });
  } catch (err) {
    console.error("[api/check] error:", err);
    res.status(500).json({ error: err.message || "internal check error" });
  }
}
