#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8644";

async function main() {
  fs.mkdirSync(artifacts, { recursive:true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless:true, ...(fs.existsSync(systemChrome) ? { executablePath:systemChrome } : {}) });
  const page = await browser.newPage({ viewport:{ width:1440, height:940 } });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });

  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout:30000 });
  const recommendations = await page.evaluate(() => {
    if (BOOT.active) { BOOT.ready = true; enterFlight(); }
    boot.style.display = "none"; document.body.classList.remove("booting");
    localStorage.removeItem(STORY_PROGRESS_KEY); STORY_PROGRESS_CACHE = null;
    BLACK_BOX.events.length = 0; BLACK_BOX.transcripts.length = 0; BLACK_BOX.runId = 21; BLACK_BOX.sequence = 0;
    const base = { preflight_complete:true, route_complete:true, objectives_complete:true, stable_final:true, touchdown_sink_mps:1.1, centerline_m:1, score:94, events:[] };
    return {
      unstable:SIM.lessonRecommendation({ ...base, stable_final:false }),
      hardTouchdown:SIM.lessonRecommendation({ ...base, touchdown_sink_mps:3.8 }),
      centerline:SIM.lessonRecommendation({ ...base, centerline_m:8 }),
      systems:SIM.lessonRecommendation({ ...base, system_event:"Pitot icing reached 42 percent; sensed airspeed unreliable." }),
      progression:SIM.lessonRecommendation(base)
    };
  });

  await page.evaluate(() => {
    PREFLIGHT.awarded = true; APPROACH.awarded = false;
    MISSION.idx = MISSION.legs.length; MISSION.done = true;
    S.pos.set(2, CFG.restY, 12); S.touchSink = 1.2;
    SCORE.value = 84; SCORE.grade = "B"; SCORE.tdSink = 1.2; SCORE.tdOff = 2;
    REPLAY.history.length = 0;
    for (let i=0;i<46;i++) REPLAY.history.push({ t:i*.2, x:5-i*.08, y:32-i*.55, z:440-i*8, qx:0, qy:0, qz:0, qw:1 });
    showDebrief(84);
  });
  await page.waitForTimeout(250);
  const debrief = await page.evaluate(() => {
    const state = SIM.realtimeFlightState(), record = SIM.debriefState().record, sent = [];
    AVIATOR.status = "LIVE"; AVIATOR.micEnabled = false; AVIATOR.dc = { readyState:"open", send:payload => sent.push(JSON.parse(payload)) };
    requestAviatorDebrief();
    return {
      visible:getComputedStyle(debriefLessonPrescription).display,
      recommendation:record.recommendation,
      competency:debriefLessonCompetency.textContent,
      evidence:debriefLessonEvidence.textContent,
      destination:debriefLessonDestination.textContent,
      conditions:debriefLessonConditions.textContent,
      realtimeRecommendation:state.training_recommendation,
      realtimePrompt:sent.find(event => event.item?.content?.[0]?.text)?.item.content[0].text || ""
    };
  });
  await page.screenshot({ path:path.join(artifacts,"measured-next-lesson-debrief-desktop.png") });

  await page.locator("#debriefLessonOpen").click();
  await page.waitForTimeout(350);
  const handoff = await page.evaluate(() => {
    const selection = BLACK_BOX.events.filter(event => event.run===BLACK_BOX.runId && event.type==="lesson_recommendation_selected").at(-1);
    return {
      boardOpen:BOARD.visible,
      selectedId:BOARD.selectedId,
      selectedMission:locationGrid.querySelector(".ground-mission.selected")?.dataset.mission || "",
      selectedTitle:locationGrid.querySelector(".ground-mission.selected strong")?.textContent || "",
      routeFramed:LIVE_ATLAS.routeFramed,
      routeMode:BOARD.routePlan?.mode || "",
      routeDistanceKm:BOARD.routePlan?.distance_km || 0,
      launchEnabled:!document.getElementById("destinationLaunch").disabled,
      activeMissionUnchanged:MISSION.storyId,
      blackBox:selection?.data || null,
      focusedMission:document.activeElement?.dataset?.mission || ""
    };
  });
  await page.screenshot({ path:path.join(artifacts,"measured-next-lesson-atlas-desktop.png") });

  const checks = {
    deterministicCategories:
      recommendations.unstable.mission_id === "basin-photo-run" && recommendations.unstable.id === "approach" &&
      recommendations.hardTouchdown.mission_id === "academy-checkride" && recommendations.hardTouchdown.evidence.value === "3.8 M/S" &&
      recommendations.centerline.mission_id === "lighthouse-survey" && recommendations.centerline.evidence.value === "8 M OFFSET" &&
      recommendations.systems.mission_id === "stormhaven-medevac" && recommendations.systems.id === "systems",
    progressionUsesAuthoredMission:recommendations.progression.mission_id === "basin-photo-run" && recommendations.progression.training_reference_only === true,
    compactDesktopPrescription:debrief.visible === "grid" && debrief.competency === "Stabilized approach" && debrief.evidence === "NOT LOGGED" && debrief.destination.includes("Basin Photo Run") && debrief.conditions.includes("INTERMEDIATE"),
    realtimeGrounded:debrief.realtimeRecommendation?.mission_id === "basin-photo-run" && debrief.realtimePrompt.includes('"mission":"Basin Photo Run"') && debrief.realtimePrompt.includes("eight words maximum") && debrief.realtimePrompt.includes("stern and decisive"),
    atlasHandoff:handoff.boardOpen && handoff.selectedId === "academy" && handoff.selectedMission === "basin-photo-run" && handoff.routeFramed && handoff.routeMode === "lesson" && handoff.routeDistanceKm > 0 && handoff.launchEnabled,
    pilotRetainsControl:handoff.activeMissionUnchanged === "academy-checkride",
    blackBoxAgreement:handoff.blackBox?.mission_id === "basin-photo-run" && handoff.blackBox?.location_id === "academy" && handoff.blackBox?.competency === "Stabilized approach",
    keyboardFocusLandsOnLesson:handoff.focusedMission === "basin-photo-run",
    zeroConsoleErrors:errors.length === 0
  };
  const report = { ok:Object.values(checks).every(Boolean), checks, recommendations, debrief, handoff, errors };
  fs.writeFileSync(path.join(artifacts,"measured-next-lesson-verification.json"), JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ ok:report.ok, checks, recommendations:Object.fromEntries(Object.entries(recommendations).map(([key,value])=>[key,{ id:value.id, mission_id:value.mission_id, evidence:value.evidence.value }])), debrief:{ competency:debrief.competency, destination:debrief.destination }, handoff, errors },null,2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
