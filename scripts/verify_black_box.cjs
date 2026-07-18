#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";

async function waitForSim(page) {
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
}

async function showBlackBoxDebrief(page) {
  await page.evaluate(() => {
    document.getElementById("boot").style.display = "none";
    document.body.classList.remove("booting");
    SCORE.grade = "A"; SCORE.value = 92; SCORE.tdSink = 1.3; SCORE.tdOff = 4;
    showDebrief(92);
  });
}

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.addInitScript(() => {
    window.__fableMicRequests = 0;
    window.__fableStoppedTracks = 0;
    const getUserMedia = async () => {
      window.__fableMicRequests += 1;
      const track = { kind: "audio", stop() { window.__fableStoppedTracks += 1; } };
      return { getAudioTracks: () => [track], getTracks: () => [track] };
    };
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = getUserMedia;
    else Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  });
  await page.route("**/api/realtime/health", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bridge: "fable-flight", realtime: true, configured: true, model: "gpt-realtime-2" }) }));
  await page.route("**/api/realtime/client-secret", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: "test_ephemeral_secret", expires_at: 0 }) }));
  await page.route("https://api.openai.com/v1/realtime/calls", route => route.fulfill({ status: 200, contentType: "application/sdp", body: "v=0\r\n" }));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSim(page);

  const initial = await page.evaluate(() => ({ blackBox: SIM.blackBox(), aviator: SIM.aviatorState(), micLabel: aviatorMicBtn.textContent, micDisabled: aviatorMicBtn.disabled }));
  await page.evaluate(() => {
    SIM.setLevel("storm", false);
    SIM.blackBoxTestTranscript("Hold sixty-five knots and use the approach lights.");
  });
  const recorded = await page.evaluate(() => SIM.blackBox());
  await page.evaluate(() => {
    document.getElementById("boot").style.display = "none";
    document.body.classList.remove("booting");
    settings.style.display = "flex";
  });
  const settingsDesktop = await page.evaluate(() => {
    const dock = document.querySelector(".aviator-dock").getBoundingClientRect(), mic = aviatorMicBtn.getBoundingClientRect(), connect = aviatorBtn.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth, controlsInside: mic.left >= dock.left && connect.right <= dock.right && mic.right <= connect.left };
  });
  await page.screenshot({ path: path.join(artifacts, "black-box-settings-desktop.png"), fullPage: false });
  await page.evaluate(() => { settings.style.display = "none"; });
  await showBlackBoxDebrief(page);
  const desktop = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    blackBoxText: debriefBlackBox.textContent.replace(/\s+/g, " ").trim(),
    debriefVisible: debriefEl.classList.contains("show")
  }));
  await page.screenshot({ path: path.join(artifacts, "black-box-debrief-desktop.png"), fullPage: false });

  await page.evaluate(() => { debriefEl.classList.remove("show"); });
  await page.evaluate(() => connectAviator());
  const privacy = await page.evaluate(() => ({ micRequests: window.__fableMicRequests, aviator: SIM.aviatorState(), label: aviatorMicBtn.textContent }));
  const explicitMic = await page.evaluate(async () => {
    const replacements = [];
    AVIATOR.status = "LIVE";
    AVIATOR.transceiver = { direction: "sendrecv", sender: { replaceTrack: async track => replacements.push(!!track) } };
    await setAviatorMic(true);
    const enabled = AVIATOR.micEnabled && !!AVIATOR.mic;
    await setAviatorMic(false);
    const disabled = !AVIATOR.micEnabled && !AVIATOR.mic;
    AVIATOR.status = "REALTIME VOICE OFFLINE"; AVIATOR.transceiver = null; updateAviatorUi();
    return { enabled, disabled, replacements, micRequests: window.__fableMicRequests, stoppedTracks: window.__fableStoppedTracks };
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSim(page);
  const persisted = await page.evaluate(() => SIM.blackBox());
  await page.setViewportSize({ width: 390, height: 844 });
  await showBlackBoxDebrief(page);
  const mobile = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, width: innerWidth, height: innerHeight }));
  await page.screenshot({ path: path.join(artifacts, "black-box-debrief-mobile.png"), fullPage: false });
  await page.evaluate(() => { debriefEl.classList.remove("show"); settings.style.display = "flex"; });
  const settingsMobile = await page.evaluate(() => {
    const dock = document.querySelector(".aviator-dock").getBoundingClientRect(), mic = aviatorMicBtn.getBoundingClientRect(), connect = aviatorBtn.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth, controlsInside: mic.left >= dock.left && connect.right <= dock.right && mic.right <= connect.left };
  });
  await page.screenshot({ path: path.join(artifacts, "black-box-settings-mobile.png"), fullPage: false });

  const checks = {
    initialMicOff: initial.aviator.microphoneEnabled === false && initial.aviator.microphoneStream === false && initial.micLabel === "MIC OFF" && initial.micDisabled,
    persistedStore: initial.blackBox.persisted && recorded.persisted && persisted.persisted,
    telemetryRecorded: recorded.eventCount >= 2 && recorded.facts.some(fact => fact.type === "scene_select"),
    transcriptRecorded: recorded.transcriptCount === 1 && recorded.lastTranscript.includes("sixty-five knots") && persisted.totalTranscripts >= 1,
    factualDebriefVisible: desktop.debriefVisible && desktop.blackBoxText.includes("BLACK BOX") && desktop.blackBoxText.includes("Scene selected: storm"),
    noImplicitMicRequest: privacy.micRequests === 0 && privacy.aviator.microphoneStream === false,
    explicitMicControl: explicitMic.enabled && explicitMic.disabled && explicitMic.micRequests === 1 && explicitMic.stoppedTracks >= 1 && explicitMic.replacements.join(",") === "true,false",
    desktopFit: desktop.overflow <= 0,
    mobileFit: mobile.overflow <= 0,
    settingsDesktopFit: settingsDesktop.overflow <= 0 && settingsDesktop.controlsInside,
    settingsMobileFit: settingsMobile.overflow <= 0 && settingsMobile.controlsInside,
    zeroConsoleErrors: errors.length === 0
  };
  const report = { ok: Object.values(checks).every(Boolean), checks, initial, recorded, privacy, explicitMic, persisted, desktop, mobile, settingsDesktop, settingsMobile, errors };
  fs.writeFileSync(path.join(artifacts, "black-box-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
