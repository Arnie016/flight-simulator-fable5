import { aviatorHealthPayload } from "../../server/aviator-session.mjs";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(aviatorHealthPayload());
}
