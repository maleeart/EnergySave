import { readAll } from "./_blob.js";
import { authed } from "./_auth.js";

export default async function handler(req, res) {
  if (!authed(req, res)) return;
  res.status(200).json(await readAll());
}
