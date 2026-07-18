#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8644";

async function waitForSim(page) {
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout:30000 });
  await page.evaluate(() => {
    if (BOOT.active) { BOOT.ready = true; enterFlight(); }
    document.getElementById("boot").style.display = "none";
    document.body.classList.remove("booting");
    applyGraphicsQuality("balanced", false);
  });
}

async function crashProof(page, reason, filename, waitMs, location) {
  await page.evaluate(({ crashReason, proofLocation }) => {
    reset(); S.paused = false; camMode = 0; orbit.az = 0; orbit.el = .2; orbit.dist = 22;
    const x = proofLocation === "lake" ? LAKE.x : proofLocation[0], z = proofLocation === "lake" ? LAKE.z : proofLocation[1];
    S.pos.set(x, terrainH(x, z) + CFG.restY - .02, z); S.quat.identity();
    camPos.set(x, S.pos.y + 4.6, z + 22); updateCamera(1);
    crash(crashReason);
  }, { crashReason:reason, proofLocation:location });
  await page.waitForTimeout(waitMs);
  const state = await page.evaluate(() => ({ crash:SIM.snap(), effects:SIM.crashEffects(), blackBox:SIM.blackBox() }));
  await page.screenshot({ path:path.join(artifacts, filename) });
  return state;
}

async function main() {
  fs.mkdirSync(artifacts, { recursive:true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless:true, ...(fs.existsSync(systemChrome) ? { executablePath:systemChrome } : {}) });
  const context = await browser.newContext({ viewport:{ width:1440, height:900 } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await waitForSim(page);

  const realtime = await page.evaluate(() => {
    reset(); S.paused = false;
    const parked = SIM.realtimeFlightState(), scope = SIM.scopeBoundary();
    const sent = [], previousChannel = AVIATOR.dc;
    AVIATOR.dc = { readyState:"open", send:payload => sent.push(JSON.parse(payload)) };
    const before = { pos:S.pos.toArray(), velocity:S.vel.toArray(), controls:{ ...S.ctl }, throttle:S.thrT, flaps:S.flapSet };
    handleAviatorEvent({ type:"response.function_call_arguments.done", name:"get_flight_state", call_id:"acceptance-read" });
    const after = { pos:S.pos.toArray(), velocity:S.vel.toArray(), controls:{ ...S.ctl }, throttle:S.thrT, flaps:S.flapSet };
    AVIATOR.dc = previousChannel;
    const toolOutputEvent = sent.find(event => event.item?.type === "function_call_output");
    S.onGround = false; S.wasAirborne = true; S.phase = "cruise"; S.pos.y = 160; S.vel.set(0, 0, -36); S.ias = 70 / KT; S.tas = S.ias; S.fail.engine = true;
    const warning = SIM.realtimeFlightState();
    return { parked, warning, scope, before, after, sentTypes:sent.map(event => event.type), toolOutput:toolOutputEvent ? JSON.parse(toolOutputEvent.item.output) : null };
  });

  const terrain = await crashProof(page, "terrain impact", "island-alpha-terrain-impact.png", 620, [760, 980]);
  const gear = await crashProof(page, "gear collapse", "island-alpha-gear-collapse.png", 520, [0, 465]);
  const water = await crashProof(page, "ditched in the lake", "island-alpha-water-ditching.png", 620, "lake");
  const resetState = await page.evaluate(() => { reset(); return { crash:SIM.snap(), effects:SIM.crashEffects() }; });

  await page.setViewportSize({ width:390, height:844 });
  await page.waitForTimeout(350);
  const mobile = await page.evaluate(() => ({
    overflow:document.documentElement.scrollWidth - innerWidth,
    hud:(() => { const rect=missionHud.getBoundingClientRect(); return { left:rect.left, right:rect.right, top:rect.top, bottom:rect.bottom }; })(),
    scope:SIM.scopeBoundary()
  }));

  const serverSource = fs.readFileSync(path.join(project, "server", "aviator-session.mjs"), "utf8");
  const clientSource = fs.readFileSync(path.join(project, "index.html"), "utf8");
  const health = await fetch(baseUrl + "/api/realtime/health").then(response => response.json());
  const stateKeys = ["mission", "navigation", "scene_conditions", "energy", "departure_checks", "warning", "safe_landing", "black_box", "scope"];
  const toolKeys = stateKeys;
  const checks = {
    terrainImpactSignature:terrain.effects.active && terrain.effects.kind === "terrain_impact" && terrain.effects.fire && !terrain.effects.sparks && !terrain.effects.vapor && terrain.effects.flamesVisible >= 5,
    gearCollapseSignature:gear.effects.active && gear.effects.kind === "gear_collapse" && !gear.effects.fire && gear.effects.sparks && gear.effects.scrapeGlow && gear.effects.gearVisualCollapsed && !gear.effects.vapor && gear.effects.sparksVisible >= 8,
    waterDitchingSignature:water.effects.active && water.effects.kind === "water_ditching" && !water.effects.fire && !water.effects.sparks && water.effects.vapor,
    crashFactsRecorded:[terrain, gear, water].every(state => state.blackBox.facts.some(fact => fact.type === "crash")),
    cleanCrashReset:!resetState.crash.crashed && !resetState.effects.active && resetState.effects.kind === "none" && !resetState.effects.fire && !resetState.effects.sparks && !resetState.effects.scrapeGlow && !resetState.effects.gearVisualCollapsed && resetState.effects.pooledSmokeVisible === 0,
    completeRealtimeState:stateKeys.every(key => Object.prototype.hasOwnProperty.call(realtime.parked, key)) && realtime.parked.departure_checks.length >= 8 && realtime.parked.mission.objectives.length === 3,
    liveWarningState:realtime.warning.warning?.code === "ENGINE OUT" && realtime.warning.warning.action.includes("70 KT"),
    readOnlyToolOutput:toolKeys.every(key => Object.prototype.hasOwnProperty.call(realtime.toolOutput || {}, key)) && JSON.stringify(realtime.before) === JSON.stringify(realtime.after) && realtime.sentTypes.includes("conversation.item.create") && realtime.sentTypes.includes("response.create"),
    guardedToolSet:(serverSource.match(/type:\s*"function"/g) || []).length === 3 && serverSource.includes("tools: [flightStateTool, controlLessonTool, releaseBriefingTool]") && serverSource.includes('name: "get_flight_state"') && serverSource.includes('name: "present_control_lesson"') && serverSource.includes('name: "present_release_briefing"') && serverSource.includes("This tool never operates the aircraft") && serverSource.includes("changes no aircraft control and grants no legal dispatch approval"),
    realtimeOnlyVoice:health.model === "gpt-realtime-2" && health.voice === "marin" && !/speechSynthesis|webkitSpeechRecognition/.test(clientSource),
    fixedVoiceProfile:serverSource.includes('const AVIATOR_VOICE = "marin"') && serverSource.includes("voice: AVIATOR_VOICE") && !clientSource.includes("session.update"),
    sternDecisiveTone:/stern, decisive, professional flight instructor/.test(serverSource) && /Remain calm under pressure/.test(serverSource) && /Speak in command style/.test(serverSource),
    conciseGuardedHumor:/one short sentence under 18 words/.test(serverSource) && /Do not use sarcasm during warnings, emergencies, takeoff rotation, approach, or landing/.test(serverSource),
    pilotRetainsControl:/Never operate or modify the aircraft/.test(serverSource) && /The pilot retains all controls/.test(serverSource),
    civilianScope:realtime.scope.mode === "civilian-flight-training" && realtime.scope.multiplayer === "parked" && realtime.scope.dogfights === "parked" && realtime.scope.combat_radio === "parked" && realtime.scope.authoritative_networking === false,
    realtimeScopeMatches:JSON.stringify(realtime.scope) === JSON.stringify(realtime.parked.scope) && /This is civilian training/.test(serverSource) && /Do not role-play weapons, combat radio, invented multiplayer participants, or unsupported failures/.test(serverSource),
    mobileFit:mobile.overflow <= 0 && mobile.hud.left >= 0 && mobile.hud.right <= 390 && mobile.hud.top >= 0 && mobile.hud.bottom <= 844,
    bridgeConfigured:health.bridge === "fable-flight" && health.realtime === true && health.configured === true,
    zeroConsoleErrors:errors.length === 0
  };
  const report = { ok:Object.values(checks).every(Boolean), checks, health, realtime, crash:{ terrain, gear, water, reset:resetState }, mobile, errors };
  fs.writeFileSync(path.join(artifacts, "remaining-acceptance-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok:report.ok, checks, health, errors }, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
