import { requestAviatorClientSecret } from "../../server/aviator-session.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  try {
    return res.status(200).json(await requestAviatorClientSecret());
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Unable to create a Realtime session." });
  }
}
