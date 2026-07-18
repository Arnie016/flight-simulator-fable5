import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { aviatorHealthPayload, requestAviatorClientSecret } from "./aviator-session.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8643);
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
  ".wav": "audio/wav", ".glb": "model/gltf-binary", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}
function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), { "Content-Type": "application/json; charset=utf-8" });
}
function aviatorHealth(res) {
  // Configuration truth only: never expose the API key or a session secret to this endpoint.
  sendJson(res, 200, aviatorHealthPayload());
}
async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error("Request body too large");
  }
  return body;
}
async function createClientSecret(req, res) {
  try {
    await readBody(req);
    sendJson(res, 200, await requestAviatorClientSecret());
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Unable to create a Realtime session." });
  }
}
async function serveStatic(req, res, pathname) {
  const requestPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(root, "." + decodeURIComponent(requestPath));
  if (!filePath.startsWith(root + "/") && filePath !== root) { send(res, 403, "Forbidden"); return; }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) { send(res, 404, "Not found"); return; }
    const body = await readFile(filePath);
    send(res, 200, body, { "Content-Type": mime[extname(filePath).toLowerCase()] || "application/octet-stream" });
  } catch (error) {
    send(res, 404, "Not found");
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://" + host + ":" + port);
  if (req.method === "GET" && url.pathname === "/api/realtime/health") {
    aviatorHealth(res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/realtime/client-secret") {
    await createClientSecret(req, res);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { send(res, 405, "Method not allowed"); return; }
  if (req.method === "HEAD") { send(res, 204, ""); return; }
  await serveStatic(req, res, url.pathname);
}).listen(port, host, () => {
  console.log("Fable Flight server listening on http://" + host + ":" + port);
});
