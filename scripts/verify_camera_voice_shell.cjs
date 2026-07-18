#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
  await page.evaluate(() => {
    boot.style.display = "none";
    BOOT.active = false;
    S.paused = true;
    document.body.classList.remove("booting");
    SIM.reset();
  });
  await page.waitForFunction(() => COCKPIT_YOKE_ASSET.status === "loaded" && COCKPIT_INSTRUMENT_ASSET.status === "loaded" && COCKPIT_ENGINE_ASSET.status === "loaded" && COCKPIT_SYSTEMS_ASSET.status === "loaded" && COCKPIT_FLIGHT_ASSET.status === "loaded", null, { timeout: 30000 });

  async function camera(mode, screenshot) {
    await page.evaluate(value => { SIM.setCam(value); updateCamera(.016); syncGraphics(.016); }, mode);
    await page.waitForTimeout(120);
    if (screenshot) await page.screenshot({ path: path.join(artifacts, screenshot), fullPage: false });
    return page.evaluate(() => ({
      info: SIM.camInfo(),
      label: cameraCycleLabel.textContent,
      body: [...document.body.classList],
      cockpitVisible: !!cockpitOnly?.visible,
      externalVisible: !!externalAirframe?.visible,
      cameraDistance: +camera.position.distanceTo(S.pos).toFixed(2),
      canvas: (() => { const rect = sceneCanvas.getBoundingClientRect(); return { width: rect.width, height: rect.height }; })()
    }));
  }

  const chase = await camera(0, "camera-chase-desktop.png");
  const cockpit = await camera(1, "camera-cockpit-desktop.png");
  const nose = await camera(4, "camera-nose-desktop.png");
  const tail = await camera(5, "camera-tail-desktop.png");
  const free = await camera(2);
  const tower = await camera(3);

  const cycle = await page.evaluate(() => {
    SIM.setCam(0);
    const modes = [];
    for (let index = 0; index < 6; index += 1) {
      cameraCycleBtn.click();
      modes.push({ mode: SIM.camInfo().mode, label: cameraCycleLabel.textContent });
    }
    return modes;
  });

  const voice = await page.evaluate(async () => {
    const originalConnect = connectAviator;
    let autoOptions = null;
    try { Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => false }); } catch (error) {}
    connectAviator = options => { autoOptions = options; return Promise.resolve(true); };
    AVIATOR.pc = null; AVIATOR.connecting = false;
    const autoStarted = startAviatorFromFlightGesture();
    connectAviator = originalConnect;

    AVIATOR.status = "REALTIME VOICE OFFLINE"; AVIATOR.micEnabled = false; AVIATOR.connecting = false; AVIATOR.micPending = false; updateAviatorUi();
    const offline = { label: aviatorQuickLabel.textContent, state: aviatorQuickBtn.dataset.state };
    AVIATOR.status = "LIVE"; updateAviatorUi();
    const receive = { label: aviatorQuickLabel.textContent, state: aviatorQuickBtn.dataset.state, title: aviatorQuickBtn.title };
    AVIATOR.micEnabled = true; updateAviatorUi();
    const live = { label: aviatorQuickLabel.textContent, state: aviatorQuickBtn.dataset.state, title: aviatorQuickBtn.title, pressed: aviatorQuickBtn.getAttribute("aria-pressed") };
    AVIATOR.status = "REALTIME VOICE OFFLINE"; AVIATOR.micEnabled = false; updateAviatorUi();
    return { autoStarted, autoOptions, offline, receive, live };
  });

  const lab = await page.evaluate(() => ({ button: inspectBtn.textContent.trim(), eyebrow: document.querySelector(".control-lab-top .eyebrow").textContent.trim(), close: controlLabClose.getAttribute("aria-label") }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { SIM.setCam(1); updateCamera(.016); syncGraphics(.016); banner(""); });
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(artifacts, "camera-voice-shell-mobile.png"), fullPage: false });
  const mobile = await page.evaluate(() => {
    const bounds = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width }; };
    const voiceRect = bounds(aviatorQuickBtn), cameraRect = bounds(cameraCycleBtn), gearRect = bounds(gearBtn);
    const missionRect = bounds(missionHud);
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      voice: voiceRect,
      camera: cameraRect,
      gear: gearRect,
      mission: missionRect,
      ordered: voiceRect.right <= cameraRect.left && cameraRect.right <= gearRect.left,
      inside: voiceRect.left >= 0 && gearRect.right <= innerWidth && voiceRect.top >= 0 && gearRect.bottom <= innerHeight,
      missionClear: missionRect.right <= voiceRect.left || missionRect.bottom <= voiceRect.top || missionRect.left >= gearRect.right || missionRect.top >= gearRect.bottom
    };
  });

  const checks = {
    sixCameraModes: [chase.info.mode, cockpit.info.mode, nose.info.mode, tail.info.mode, free.info.mode, tower.info.mode].join(",") === "CHASE,COCKPIT,NOSE,TAIL,FREE,TOWER",
    cockpitIsIntegrated: cockpit.body.includes("cockpit-view") && cockpit.cockpitVisible && !cockpit.externalVisible && cockpit.cameraDistance < 2,
    externalModesStayExternal: !chase.cockpitVisible && chase.externalVisible && !nose.cockpitVisible && !nose.externalVisible && !tail.cockpitVisible && tail.externalVisible,
    mountedCameraGeometry: nose.cameraDistance > 2 && nose.cameraDistance < 3 && tail.cameraDistance > 9 && tail.cameraDistance < 10.5,
    forzaStyleCycleOrder: cycle.map(item => item.mode).join(",") === "COCKPIT,NOSE,TAIL,FREE,TOWER,CHASE" && cycle.every(item => item.mode === item.label),
    autoVoiceContract: voice.autoStarted && voice.autoOptions?.requestMic === true && voice.autoOptions?.source === "flight_start",
    voicePauseStateVisible: voice.offline.label === "VOICE" && voice.receive.label === "VOICE ON" && voice.live.label === "MIC LIVE" && voice.live.state === "mic" && voice.live.pressed === "true" && voice.live.title.includes("Pause"),
    labIsClearlySeparate: lab.button === "YOKE LAB" && lab.eyebrow.startsWith("SEPARATE CONTROL LAB") && lab.close === "Return to flight",
    mobileToolbarFit: mobile.overflow <= 0 && mobile.ordered && mobile.inside && mobile.missionClear,
    renderedCanvas: cockpit.canvas.width === 1440 && cockpit.canvas.height === 900,
    zeroConsoleErrors: errors.length === 0
  };
  const report = { ok: Object.values(checks).every(Boolean), checks, cameras: { chase, cockpit, nose, tail, free, tower, cycle }, voice, lab, mobile, errors };
  fs.writeFileSync(path.join(artifacts, "camera-voice-shell-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: report.ok, checks, cycle, voice, mobile, errors }, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
