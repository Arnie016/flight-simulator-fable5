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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
    await page.evaluate(() => {
      boot.style.display = "none";
      BOOT.active = false;
      document.body.classList.remove("booting");
      S.paused = false;
      SIM.reset();
      S.paused = false;
      SIM.openMissionBoard();
      SIM.setAtlasLayer("traffic");
    });
    await page.waitForFunction(() => {
      const state = SIM.liveAtlas();
      return state.ready && state.layer === "traffic" && state.trafficHits.length >= 4 && state.trafficAwareness.selected;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(350);
    const liveBeforeInteraction = await page.evaluate(() => SIM.liveAtlas().liveFlight);
    await page.evaluate(() => { S.paused = true; drawIslandAtlas(); });

    const initial = await page.evaluate(() => {
      const state = SIM.liveAtlas(), card = atlasFocusEl.getBoundingClientRect(), map = atlasMapStage.getBoundingClientRect();
      const pixels = islandMapCtx.getImageData(0, 0, islandMapCanvas.width, islandMapCanvas.height).data;
      let nonBlank = 0, luminanceMin = 255, luminanceMax = 0;
      for (let index = 0; index < pixels.length; index += 256) {
        const alpha = pixels[index + 3] || 0;
        if (!alpha) continue;
        const luminance = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        nonBlank += 1; luminanceMin = Math.min(luminanceMin, luminance); luminanceMax = Math.max(luminanceMax, luminance);
      }
      return {
        state,
        card: { visible: !atlasFocusEl.classList.contains("hidden"), kind: atlasFocusEl.dataset.kind, id: atlasFocusEl.dataset.id, text: atlasFocusEl.textContent.trim(), left: card.left, right: card.right, top: card.top, bottom: card.bottom },
        map: { left: map.left, right: map.right, top: map.top, bottom: map.bottom },
        pixels: { nonBlank, range: luminanceMax - luminanceMin },
        boundaries: {
          alert: atlasTrafficStatus(600, 100) === "alert",
          monitor: atlasTrafficStatus(900, 200) === "monitor",
          clear: atlasTrafficStatus(1800, 100) === "clear"
        }
      };
    });
    await page.screenshot({ path: path.join(artifacts, "atlas-traffic-awareness-desktop.png"), animations: "disabled" });

    const mapBox = await page.locator("#islandMapCanvas").boundingBox();
    const clickTarget = initial.state.trafficHits.find(hit => hit.id !== initial.state.trafficLockedId && initial.state.trafficAwareness.tracks.some(track => track.id === hit.id && !track.ground));
    await page.mouse.move(mapBox.x + clickTarget.x, mapBox.y + clickTarget.y);
    await page.mouse.click(mapBox.x + clickTarget.x, mapBox.y + clickTarget.y);
    await page.waitForFunction(id => SIM.liveAtlas().trafficLockedId === id, clickTarget.id);
    const clicked = await page.evaluate(() => SIM.liveAtlas());

    await page.locator("#islandMapCanvas").focus();
    const beforeNext = clicked.trafficFocusId;
    await page.keyboard.press("n");
    await page.waitForFunction(id => SIM.liveAtlas().trafficFocusId !== id, beforeNext);
    const afterNext = await page.evaluate(() => SIM.liveAtlas().trafficFocusId);
    await page.keyboard.press("Shift+n");
    await page.waitForFunction(id => SIM.liveAtlas().trafficFocusId !== id, afterNext);
    const afterPrevious = await page.evaluate(() => SIM.liveAtlas().trafficFocusId);

    await page.evaluate(() => { S.paused = false; });
    const motionBefore = await page.evaluate(() => Object.fromEntries(SIM.liveAtlas().trafficHits.map(hit => [hit.id, [hit.x, hit.y]])));
    await page.waitForTimeout(900);
    const motionAfter = await page.evaluate(() => Object.fromEntries(SIM.liveAtlas().trafficHits.map(hit => [hit.id, [hit.x, hit.y]])));
    const moved = Object.keys(motionBefore).some(id => motionAfter[id] && Math.hypot(motionAfter[id][0] - motionBefore[id][0], motionAfter[id][1] - motionBefore[id][1]) > 0.15);

    await page.evaluate(() => SIM.setAtlasLayer("terrain"));
    const stormHit = await page.evaluate(() => SIM.liveAtlas().hits.find(hit => hit.id === "stormhaven"));
    await page.mouse.click(mapBox.x + stormHit.x, mapBox.y + stormHit.y);
    await page.waitForFunction(() => SIM.liveAtlas().selectedId === "stormhaven");
    await page.evaluate(() => SIM.setAtlasLayer("traffic"));
    await page.waitForFunction(() => SIM.liveAtlas().layer === "traffic" && SIM.liveAtlas().trafficFocusId);

    const parity = await page.evaluate(() => {
      const atlas = SIM.liveAtlas(), realtime = SIM.realtimeFlightState().traffic_awareness;
      const same = ["id", "callsign", "clock", "distance_m", "relative_altitude_m", "trend", "status"].every(key => atlas.trafficAwareness.selected?.[key] === realtime.selected?.[key]);
      return { same, atlas: atlas.trafficAwareness.selected, realtime: realtime.selected, selectedDestination: atlas.selectedId };
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { SIM.setAtlasLayer("traffic"); drawIslandAtlas(); });
    await page.waitForFunction(() => SIM.liveAtlas().trafficHits.length >= 3 && !atlasFocusEl.classList.contains("hidden"));
    const mobileBefore = await page.evaluate(() => SIM.liveAtlas());
    const mobileTarget = mobileBefore.trafficHits.find(hit => hit.id !== mobileBefore.trafficLockedId && hit.r >= 28);
    const mobileMap = await page.locator("#islandMapCanvas").boundingBox();
    await page.touchscreen.tap(mobileMap.x + mobileTarget.x, mobileMap.y + mobileTarget.y);
    await page.waitForFunction(id => SIM.liveAtlas().trafficLockedId === id, mobileTarget.id);
    const mobile = await page.evaluate(() => {
      const state = SIM.liveAtlas(), card = atlasFocusEl.getBoundingClientRect(), stage = atlasMapStage.getBoundingClientRect(), brief = atlasMobileBrief.getBoundingClientRect();
      return {
        state,
        overflow: document.documentElement.scrollWidth - innerWidth,
        card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom, visible: !atlasFocusEl.classList.contains("hidden"), text: atlasFocusEl.textContent.trim() },
        stage: { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom },
        brief: { left: brief.left, right: brief.right, top: brief.top, bottom: brief.bottom }
      };
    });
    await page.screenshot({ path: path.join(artifacts, "atlas-traffic-awareness-mobile.png"), animations: "disabled" });

    const serverSource = fs.readFileSync(path.join(project, "server", "aviator-session.mjs"), "utf8");
    const airborne = initial.state.trafficAwareness.tracks.filter(track => !track.own && !track.ground);
    const fields = ["callsign", "agl_m", "course_degrees", "distance_m", "clock", "relative_altitude_m", "closure_mps", "trend", "status"];
    const checks = {
      liveTrackPicture: initial.state.layer === "traffic" && initial.state.trafficAwareness.track_count >= 5 && initial.state.trafficAwareness.airborne_count >= 3,
      completeMeasuredTracks: airborne.length >= 3 && airborne.every(track => fields.every(field => track[field] !== undefined && track[field] !== null)),
      projectedVectorsAndHits: initial.state.layerStats.trafficVectors >= 4 && initial.state.trafficHits.length >= 4,
      defaultTrafficFocus: initial.card.visible && initial.card.kind === "traffic" && initial.card.id === initial.state.trafficLockedId && initial.card.text.includes(initial.state.trafficAwareness.selected.callsign),
      pointerLocksAircraft: clicked.trafficLockedId === clickTarget.id && clicked.trafficAwareness.selected.id === clickTarget.id,
      keyboardCyclesTraffic: afterNext !== beforeNext && afterPrevious !== afterNext,
      tracksMoveWhileBoardOpen: liveBeforeInteraction && moved,
      destinationContinuity: parity.selectedDestination === "stormhaven",
      realtimeParity: parity.same,
      groundedRealtimePrompt: serverSource.includes("Use traffic_awareness only") && serverSource.includes("never invent traffic"),
      advisoryBoundaries: Object.values(initial.boundaries).every(Boolean),
      mobileTouchAndContainment: mobile.overflow <= 0 && mobile.card.visible && mobile.state.trafficLockedId === mobileTarget.id && mobile.card.left >= mobile.stage.left && mobile.card.right <= mobile.stage.right && mobile.card.top >= mobile.stage.top && mobile.card.bottom <= mobile.brief.top && mobile.state.trafficHits.every(hit => hit.r >= 28),
      renderedCanvas: initial.pixels.nonBlank > 500 && initial.pixels.range > 20,
      zeroConsoleErrors: errors.length === 0
    };
    const report = { ok: Object.values(checks).every(Boolean), checks, initial, clicked: { locked: clicked.trafficLockedId, selected: clicked.trafficAwareness.selected }, cycle: { beforeNext, afterNext, afterPrevious }, moved, parity, mobile, errors };
    fs.writeFileSync(path.join(artifacts, "atlas-traffic-awareness-verification.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ ok: report.ok, checks, selected: parity.atlas, mobile: { card: mobile.card, brief: mobile.brief, overflow: mobile.overflow }, errors }, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
