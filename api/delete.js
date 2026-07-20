import { remove } from "./_blob.js";
import { authed } from "./_auth.js";

export default async function handler(req, res) {
  if (!authed(req, res)) return;
  if (req.method !== "DELETE") return res.status(405).json({ error: "method not allowed" });
  const { url } = req.body ?? {};
  if (typeof url !== "string" || !url.startsWith("https://"))
    return res.status(400).json({ error: "invalid url" });
  await remove(url);
  res.status(200).json({ ok: true });
}
