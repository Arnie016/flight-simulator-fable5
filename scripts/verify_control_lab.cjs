#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";

async function enterFlight(page) {
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
  await page.evaluate(() => {
    if (BOOT.active) { BOOT.ready = true; enterFlight(); }
    document.getElementById("boot").style.display = "none";
    document.body.classList.remove("booting");
    applyGraphicsQuality("balanced", false);
  });
}

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  let assetResponse = null;
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  page.on("response", response => {
    if (response.url().endsWith("/assets/cockpit/flight_control_yoke_textured.glb")) {
      assetResponse = { status: response.status(), contentType: response.headers()["content-type"] || "" };
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await enterFlight(page);
  await page.waitForFunction(() => SIM.controlInspection().asset_status === "loaded", null, { timeout: 30000 });

  const cockpit = await page.evaluate(() => {
    SIM.setCam(1);
    return {
      attached: COCKPIT_YOKE_ASSET.cockpitRoot?.parent === cockpitYoke,
      fallbackVisible: cockpitYokeFallback.visible,
      source: COCKPIT_YOKE_ASSET.url,
      bytes: COCKPIT_YOKE_ASSET.bytes
    };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifacts, "control-lab-cockpit-yoke.png") });

  await page.click("#inspectBtn");
  await page.waitForFunction(() => SIM.controlInspection().parts.length === 5);
  await page.evaluate(() => {
    window.__controlRealtimeEvents = [];
    AVIATOR.status = "LIVE";
    AVIATOR.eventAt = {};
    AVIATOR.dc = { readyState: "open", send: payload => window.__controlRealtimeEvents.push(JSON.parse(payload)) };
    updateAviatorUi();
  });
  await page.screenshot({ path: path.join(artifacts, "control-lab-inspection.png") });
  await page.click("#controlLessonStart");

  const pivot = await page.evaluate(() => {
    const hub = CONTROL_LAB.model.getObjectByName("Yoke_Hub");
    const point = new THREE.Box3().setFromObject(hub).getCenter(new THREE.Vector3()).project(CONTROL_LAB.camera);
    return {
      x: (point.x * .5 + .5) * controlLabCanvas.clientWidth,
      y: (-point.y * .5 + .5) * controlLabCanvas.clientHeight
    };
  });
  await page.mouse.move(pivot.x, pivot.y);
  await page.waitForFunction(() => SIM.controlInspection().step === 2, null, { timeout: 5000 });
  await page.mouse.down();
  await page.mouse.move(pivot.x - 510, pivot.y, { steps: 20 });
  await page.waitForFunction(() => SIM.controlInspection().step === 3, null, { timeout: 5000 });
  await page.mouse.move(pivot.x, pivot.y, { steps: 20 });
  await page.mouse.up();
  await page.waitForFunction(() => SIM.controlInspection().completed, null, { timeout: 5000 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(artifacts, "control-lab-debrief.png") });

  const proof = await page.evaluate(() => ({
    inspection: SIM.controlInspection(),
    facts: SIM.blackBox().facts.filter(fact => fact.type.startsWith("control_")),
    realtimeEvents: window.__controlRealtimeEvents,
    audioStatus: controlAudioStatus.textContent,
    micEnabled: AVIATOR.micEnabled,
    debrief: controlDebrief.textContent.replace(/\s+/g, " ").trim()
  }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifacts, "control-lab-mobile.png") });
  const mobile = await page.evaluate(() => {
    const close = document.getElementById("controlLabClose").getBoundingClientRect();
    const left = document.querySelector(".control-lab-pane.left").getBoundingClientRect();
    const right = document.querySelector(".control-lab-pane.right").getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      closeVisible: close.left >= 0 && close.right <= innerWidth && close.top >= 0,
      panesFit: left.left >= 0 && left.right <= innerWidth && right.left >= 0 && right.right <= innerWidth
    };
  });

  const health = await fetch(baseUrl + "/api/realtime/health").then(response => response.json());
  const eventTexts = proof.realtimeEvents.filter(event => event.item?.content?.[0]?.text).map(event => event.item.content[0].text);
  const checks = {
    texturedAssetServed: assetResponse?.status === 200 && assetResponse.contentType === "model/gltf-binary",
    texturedAssetInCockpit: cockpit.attached && !cockpit.fallbackVisible && cockpit.bytes === 2727172,
    fiveInspectableParts: proof.inspection.parts.length === 5 && proof.facts.some(fact => fact.type === "control_inspection"),
    pointerLimitLesson: proof.inspection.completed && proof.inspection.max_deflection_degrees >= 45 && proof.inspection.limit_crossings === 1 && proof.inspection.deflection_degrees === 0,
    telemetryDebrief: proof.facts.some(fact => fact.type === "control_limit") && proof.facts.some(fact => fact.type === "control_recovery") && proof.debrief.includes(proof.inspection.max_deflection_degrees.toFixed(1) + " DEG"),
    realtimeGroundedCoaching: health.model === "gpt-realtime-2" && health.voice === "marin" && eventTexts.some(text => /Hard limit recorded at (4[5-9]|5[0-5])\.\d degrees/.test(text)) && eventTexts.some(text => text.includes("Recovery complete. Maximum deflection " + proof.inspection.max_deflection_degrees.toFixed(1) + " degrees")),
    audioOptIn: proof.audioStatus === "GPT REALTIME 2 · LIVE" && proof.micEnabled === false && proof.inspection.microphone_enabled === false,
    mobileFit: mobile.overflow <= 0 && mobile.closeVisible && mobile.panesFit,
    zeroConsoleErrors: errors.length === 0
  };
  const report = { ok: Object.values(checks).every(Boolean), checks, health, assetResponse, cockpit, proof, mobile, errors };
  fs.writeFileSync(path.join(artifacts, "control-lab-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: report.ok, checks, health, inspection: proof.inspection, mobile, errors }, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
