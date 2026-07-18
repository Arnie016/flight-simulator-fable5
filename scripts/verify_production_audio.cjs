#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "https://flight-sim-sandy.vercel.app";

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}), args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const context = await browser.newContext({ permissions: ["microphone"], viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
  await page.evaluate(() => { boot.style.display = "none"; BOOT.active = false; S.paused = true; document.body.classList.remove("booting"); SIM.reset(); });
  await page.click("#gearBtn");
  await page.click("#aviatorBtn");
  await page.waitForFunction(() => AVIATOR.status === "LIVE" && !AVIATOR.micEnabled && AVIATOR.dc?.readyState === "open", null, { timeout: 30000 });
  await page.evaluate(() => {
    sendAviatorEvent({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: "What are flaps?" }] } });
    sendAviatorEvent({ type: "response.create" });
  });
  await page.waitForFunction(() => AVIATOR.audible === true && AVIATOR.turns.some(turn => turn.role === "ai" && turn.text.toLowerCase().includes("flap")), null, { timeout: 30000 });
  await page.evaluate(() => setAviatorMic(true));
  await page.waitForFunction(() => AVIATOR.micEnabled, null, { timeout: 15000 });
  const proof = await page.evaluate(() => ({ status: AVIATOR.status, mic: AVIATOR.micEnabled, audible: AVIATOR.audible, railStatus: aviatorRailStatus.textContent, lastAi: [...AVIATOR.turns].reverse().find(turn => turn.role === "ai" && turn.text.toLowerCase().includes("flap"))?.text || "", audioStream: AVIATOR.audio?.srcObject instanceof MediaStream, remoteTracks: AVIATOR.audio?.srcObject?.getAudioTracks().length || 0 }));
  await page.screenshot({ path: path.join(artifacts, "production-realtime-audio-proof.png"), fullPage: false });
  const checks = { live: proof.status === "LIVE", microphoneConnected: proof.mic, remoteAudioPlaying: proof.audible && proof.audioStream && proof.remoteTracks > 0, conciseFlapsAnswer: proof.lastAi.toLowerCase().includes("flap") && proof.lastAi.split(/\s+/).length <= 30, zeroConsoleErrors: errors.length === 0 };
  const report = { ok: Object.values(checks).every(Boolean), url: baseUrl, checks, proof, errors };
  fs.writeFileSync(path.join(artifacts, "production-realtime-audio-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await page.evaluate(() => disconnectAviator(false));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
