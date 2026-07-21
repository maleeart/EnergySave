import { readAll } from "./_blob.js";

const normName = s => s.trim().replace(/^(นาย|นางสาว|นาง)\s*/, "").trim();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { name, empid, unit, type } = req.body ?? {};
  if (!name || !unit) return res.status(400).end();

  const rows = await readAll();
  const norm = normName(name);

  const match = rows.find(r => {
    const nameUnitMatch = normName(r.name || "") === norm && r.unit === unit;
    if (type === "พนักงาน" && empid) return r.empid === empid || nameUnitMatch;
    return nameUnitMatch;
  });

  if (!match) return res.status(404).end();
  const { _blobUrl: _, ...safe } = match;
  res.json(safe);
}
