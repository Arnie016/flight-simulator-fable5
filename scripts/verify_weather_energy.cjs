#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";
let activeBrowser = null;

async function waitForSim(page) {
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout:30000 });
  await page.evaluate(() => { if (BOOT.active) { BOOT.ready = true; enterFlight(); } document.getElementById("boot").style.display = "none"; document.body.classList.remove("booting"); });
}

async function selectScene(page, id) {
  await page.evaluate(sceneId => { SIM.setLevel(sceneId, false); S.paused = false; }, id);
  await page.waitForTimeout(180);
  return page.evaluate(() => ({
    snap:SIM.snap(), density:SIM.density(), gust:SIM.gusts(), weather:SIM.weatherSurface(), audio:SIM.audioState(), telemetry:SIM.missionTelemetry(), realtime:SIM.realtimeFlightState()
  }));
}

async function measureRafFps(page, frames = 180) {
  return page.evaluate(sampleCount => new Promise(resolve => {
    const intervals = [];
    let previous = performance.now();
    const tick = now => {
      intervals.push(now - previous);
      previous = now;
      if (intervals.length < sampleCount) return requestAnimationFrame(tick);
      const fps = intervals.slice(10).map(ms => 1000 / ms).sort((a, b) => a - b);
      resolve({
        median:+fps[Math.floor(fps.length / 2)].toFixed(1),
        p10:+fps[Math.floor(fps.length * 0.1)].toFixed(1),
        mean:+(fps.reduce((sum, value) => sum + value, 0) / fps.length).toFixed(1),
        sim:SIM.snap().fps
      });
    };
    requestAnimationFrame(tick);
  }), frames);
}

async function measureRenderCapacity(page, frames = 40) {
  return page.evaluate(sampleCount => {
    const gl = renderer.getContext(), debug = gl.getExtension("WEBGL_debug_renderer_info"), samples = [];
    renderer.render(scene, camera); gl.finish();
    for (let index = 0; index < sampleCount; index++) {
      const start = performance.now();
      syncGraphics(1 / 60); updateCamera(1 / 60); placeSun(); updateSceneWeather();
      renderer.render(scene, camera); gl.finish();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const meanMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return {
      meanMs:+meanMs.toFixed(2),
      medianMs:+samples[Math.floor(samples.length / 2)].toFixed(2),
      p90Ms:+samples[Math.floor(samples.length * 0.9)].toFixed(2),
      capacityFps:+(1000 / meanMs).toFixed(1),
      renderer:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      drawCalls:renderer.info.render.calls,
      triangles:renderer.info.render.triangles
    };
  }, frames);
}

async function fitState(page) {
  return page.evaluate(() => {
    const hud = missionHud.getBoundingClientRect(), panelRect = panel.getBoundingClientRect();
    return { width:innerWidth, height:innerHeight, overflow:document.documentElement.scrollWidth - innerWidth,
      hudInside:hud.left >= 0 && hud.right <= innerWidth && hud.top >= 0 && hud.bottom <= innerHeight,
      panelInside:panelRect.left >= -1 && panelRect.right <= innerWidth + 1 && panelRect.bottom <= innerHeight + 1 };
  });
}

async function main() {
  fs.mkdirSync(artifacts, { recursive:true });
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = activeBrowser = await chromium.launch({ headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{}) });
  const context = await browser.newContext({ viewport:{ width:1440, height:900 } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await waitForSim(page);
  await page.evaluate(() => applyGraphicsQuality("balanced", false));

  const balancedFps = JSON.parse(fs.readFileSync(path.join(artifacts, "mac-balanced-performance.json"), "utf8"));

  const regimes = await page.evaluate(() => SIM.weatherRegimes()), states = {};
  for (const id of ["circuit", "coast", "alpine", "storm", "desert"]) states[id] = await selectScene(page, id);
  const samples = await page.evaluate(() => {
    const first = SIM.weatherSample("desert", 234.5, 0, 0, 0), second = SIM.weatherSample("desert", 234.5, 0, 0, 0);
    return { first, second, clear:SIM.weatherSample("circuit", 234.5, 0, 0, 0), alpine:SIM.weatherSample("alpine", -3530, 2600, 5, 1600) };
  });

  await selectScene(page, "storm");
  await page.waitForTimeout(2600);
  const stormDesktop = await fitState(page);
  await page.screenshot({ path:path.join(artifacts, "weather-heavy-rain-desktop.png") });
  const wetSpray = await page.evaluate(() => {
    S.paused = false; S.crashed = false; S.onGround = true; S.pos.set(0, CFG.restY - 0.02, 320); S.vel.set(0, 0, -18); S.brakes = false;
    for (let i = 0; i < 9; i++) emitSurfaceSpray(0.16);
    return { surface:SIM.surface(), visuals:SIM.surfaceVisuals() };
  });
  await page.setViewportSize({ width:390, height:844 });
  await page.waitForTimeout(500);
  const stormMobile = await fitState(page);
  await page.screenshot({ path:path.join(artifacts, "weather-heavy-rain-mobile.png") });

  await page.setViewportSize({ width:1440, height:900 });
  const performance = await page.evaluate(() => {
    const run = (id, night) => {
      SIM.setLevel(id, false); SIM.setNight(night); SIM.setWind(false); SIM.setTurb(0);
      SIM.set({ throttle:1, pitch:0, roll:0, yaw:0, brakes:false });
      let seconds = 0;
      while (SIM.snap().kt < 55 && seconds < 30 && !SIM.snap().crashed) { SIM.warp(0.25); seconds += 0.25; }
      const rotate = SIM.snap();
      SIM.set({ throttle:1, pitch:0.32, roll:0, yaw:0, brakes:false }); SIM.warp(7);
      const climb = SIM.snap(), energy = SIM.energyTraining(); SIM.clear();
      return { seconds, rotateRollM:+Math.hypot(rotate.x, rotate.z - 520).toFixed(1), rotateIasKt:rotate.kt, rotateTasKt:rotate.tasKt,
        takeoffRollM:energy.takeoffRollM, maxClimbMps:energy.maxClimbMps, endAltitudeM:climb.alt, endVsiMps:climb.vsi, crashed:climb.crashed };
    };
    return { clear:run("circuit", false), alpine:run("alpine", true), desert:run("desert", true) };
  });

  const energyTraining = await page.evaluate(() => {
    SIM.selectStoryMission("desert", "thermal-survey", true); SIM.setNight(true); S.paused = true;
    S.onGround = false; S.phase = "climb"; S.pos.y = 120; S.thrA = 0.82; S.vsi = 0.4; S.ias = 60 / KT; S.tas = S.ias / densityState().indicatedScale;
    updateEnergyTraining(); const lowObjective = currentObjective(), lowRealtime = SIM.realtimeFlightState();
    S.ias = 78 / KT; S.tas = S.ias / densityState().indicatedScale; S.vsi = 1.2;
    for (let i = 0; i < 770; i++) updateEnergyTraining();
    updateMissionHud();
    return { lowObjective, lowRealtime:lowRealtime.energy, state:SIM.energyTraining(), energyGoal:SIM.contracts().goals.find(goal => goal.kind === "energy"), hud:missionHud.textContent.replace(/\s+/g, " ").trim() };
  });
  await page.setViewportSize({ width:390, height:844 });
  const energyMobile = await fitState(page);
  await page.screenshot({ path:path.join(artifacts, "weather-energy-guidance-mobile.png") });

  const representative = [states.circuit, states.coast, states.alpine, states.storm, states.desert];
  const checks = {
    fiveRegimes:regimes.count === 5 && ["clear", "crosswind", "low-density", "heavy-rain", "desert-thermal"].every(regime => regimes.regimes.includes(regime)),
    distinctVisibility:[100, 86, 72, 52, 78].every((value, index) => Math.round(representative[index].snap.vis * 100) === value),
    deterministicWeatherSample:JSON.stringify(samples.first) === JSON.stringify(samples.second) && samples.first.verticalAirMps > samples.clear.verticalAirMps + 2,
    handlingSignatures:states.circuit.gust.base === 0 && states.coast.gust.base === 8 && states.alpine.density.percent <= 90 && states.storm.gust.base === 10 && states.desert.density.percent <= 86,
    distinctSound: new Set(representative.map(state => state.audio.ambience)).size === 5 && states.storm.audio.weatherBed === "mixkitRain" && states.alpine.audio.weatherBed === "mixkitMountainWind",
    coherentGuidance:states.alpine.telemetry.scene.includes("LOW DENSITY") && states.desert.telemetry.scene.includes("THERMALS") && states.storm.telemetry.scene.includes("HEAVY RAIN") && representative.every(state => state.realtime.scene_conditions.regime && state.realtime.energy.action),
    nearFarHeavyRain:states.storm.weather.visibleRainNear && states.storm.weather.visibleRainFar && states.storm.weather.rainNearSegments >= 120 && states.storm.weather.rainFarSegments >= 200,
    wetRunway:states.storm.weather.surface === "wet" && states.storm.weather.brake < states.circuit.weather.brake && states.storm.weather.visiblePuddles > 0 && states.storm.snap.vis === 0.52,
    rollingWetSpray:wetSpray.surface.id === "wet" && wetSpray.visuals.events >= 2 && wetSpray.visuals.activeSprays >= 2,
    longerTakeoff:performance.alpine.takeoffRollM > performance.clear.takeoffRollM * 1.1 && performance.desert.takeoffRollM > performance.clear.takeoffRollM * 1.15 && performance.alpine.rotateTasKt > performance.clear.rotateTasKt && performance.desert.rotateTasKt > performance.clear.rotateTasKt,
    reducedClimb:performance.alpine.maxClimbMps < performance.clear.maxClimbMps * 0.92 && performance.desert.maxClimbMps < performance.clear.maxClimbMps * 0.85,
    energyRecoveryGuidance:energyTraining.lowObjective.title === "Protect Energy" && energyTraining.lowRealtime.state === "low" && energyTraining.lowRealtime.action.includes("Lower the nose") && energyTraining.state.recoveries >= 1,
    energyDisciplineObjective:energyTraining.state.awarded && energyTraining.state.stableSeconds >= 6 && energyTraining.energyGoal?.current && energyTraining.energyGoal.progress === 1 && energyTraining.hud.includes("85% DENSITY"),
    balancedPerformance:balancedFps.ok && balancedFps.checks.metalRenderer && balancedFps.checks.balancedMode && balancedFps.measurement.median >= 45 && balancedFps.measurement.p10 >= 45,
    desktopFit:stormDesktop.overflow <= 0 && stormDesktop.hudInside && stormDesktop.panelInside,
    mobileFit:stormMobile.overflow <= 0 && stormMobile.hudInside && stormMobile.panelInside && energyMobile.overflow <= 0 && energyMobile.hudInside,
    zeroConsoleErrors:errors.length === 0
  };
  const report = { ok:Object.values(checks).every(Boolean), checks, regimes, samples, states, wetSpray, performance, energyTraining, balancedFps, stormDesktop, stormMobile, energyMobile, errors };
  fs.writeFileSync(path.join(artifacts, "weather-energy-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await browser.close(); activeBrowser = null;
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(async error => {
  console.error(error);
  if (activeBrowser) await activeBrowser.close().catch(() => {});
  process.exitCode = 1;
});
