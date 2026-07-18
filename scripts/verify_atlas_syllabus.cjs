#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8644";

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
  await page.evaluate(() => { boot.style.display = "none"; BOOT.active = false; document.body.classList.remove("booting"); S.paused = true; SIM.reset(); SIM.openMissionBoard(); });

  const disciplines = ["handling", "navigation", "weather", "systems", "emergency"];
  const states = {};
  for (const discipline of disciplines) {
    await page.locator(`[data-discipline="${discipline}"]`).click();
    states[discipline] = await page.evaluate(active => {
      const buttons = [...document.querySelectorAll(".ground-mission")];
      const missionIds = buttons.map(button => button.dataset.mission);
      const activeMission = document.querySelector(".ground-mission.selected")?.dataset.mission || "";
      const location = WORLD_LOCATIONS[BOARD.selectedId];
      return {
        active: BOARD.discipline,
        selectedLocation: BOARD.selectedId,
        activeMission,
        missionIds,
        allMatch: missionIds.length > 0 && missionIds.every(id => storyMissionDisciplines(STORY_MISSION_MAP[id]).includes(active)),
        locationMatches: locationMatchesDiscipline(location, active),
        matchingPins: SIM.liveAtlas().hits.filter(hit => hit.disciplineMatch).map(hit => hit.id),
        currentLabel: atlasCurrent.textContent,
        routeDestination: BOARD.routePlan?.destinationId || BOARD.routePlan?.to || null
      };
    }, discipline);
  }

  await page.locator('[data-discipline="handling"]').focus();
  await page.keyboard.press("ArrowRight");
  const keyboard = await page.evaluate(() => ({ discipline: BOARD.discipline, focused: document.activeElement?.dataset.discipline || "", selected: document.querySelector('[data-discipline][aria-selected="true"]')?.dataset.discipline || "" }));
  const layout = await page.evaluate(() => {
    const syllabus = atlasSyllabus.getBoundingClientRect(), header = document.querySelector(".atlas-head").getBoundingClientRect();
    const tabs = [...atlasDisciplineButtons].map(button => { const rect = button.getBoundingClientRect(); return { id:button.dataset.discipline,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,scrollWidth:button.scrollWidth,clientWidth:button.clientWidth }; });
    return { syllabus:{left:syllabus.left,right:syllabus.right,top:syllabus.top,bottom:syllabus.bottom,scrollWidth:atlasSyllabus.scrollWidth,clientWidth:atlasSyllabus.clientWidth}, header:{left:header.left,right:header.right,top:header.top,bottom:header.bottom}, tabs, inside:syllabus.left>=header.left&&syllabus.right<=header.right&&tabs.every(tab=>tab.scrollWidth<=tab.clientWidth+1) };
  });
  await page.screenshot({ path: path.join(artifacts, "atlas-syllabus-desktop.png"), fullPage: false });

  const beforeLaunch = await page.evaluate(() => ({ discipline:BOARD.discipline, mission:document.querySelector(".ground-mission.selected")?.dataset.mission || "", scene:WORLD_LOCATIONS[BOARD.selectedId]?.level || "" }));
  await page.locator("#destinationLaunch").click();
  await page.waitForTimeout(180);
  const handoff = await page.evaluate(() => ({ boardVisible:BOARD.visible, camera:SIM.camInfo().mode, mission:MISSION.storyId, scene:activeLevel.id, discipline:storyMissionDisciplines(STORY_MISSION_MAP[MISSION.storyId] || STORY_MISSIONS[0]) }));
  await page.evaluate(() => SIM.openMissionBoard());
  const returned = await page.evaluate(() => ({ boardVisible:BOARD.visible, discipline:BOARD.discipline, selectedLocation:BOARD.selectedId, selectedMission:document.querySelector(".ground-mission.selected")?.dataset.mission || "" }));

  const checks = {
    fiveRealTrainingDisciplines: disciplines.every(id => states[id]?.active === id && states[id]?.allMatch && states[id]?.locationMatches),
    authoredLessonsRemainVisible: disciplines.every(id => states[id].missionIds.length > 0),
    matchingRegionsExposed: disciplines.every(id => states[id].matchingPins.length > 0),
    keyboardRovingSelection: keyboard.discipline === "navigation" && keyboard.focused === "navigation" && keyboard.selected === "navigation",
    desktopHeaderFits: layout.inside && layout.syllabus.scrollWidth <= layout.syllabus.clientWidth + 1,
    cockpitHandoffPreservesLesson: !handoff.boardVisible && handoff.camera === "COCKPIT" && handoff.mission === beforeLaunch.mission && handoff.scene === beforeLaunch.scene && handoff.discipline.includes(beforeLaunch.discipline),
    returnToAtlasPreservesSyllabus: returned.boardVisible && returned.discipline === beforeLaunch.discipline && returned.selectedMission === beforeLaunch.mission,
    zeroConsoleErrors: errors.length === 0
  };
  const report = { ok:Object.values(checks).every(Boolean), url:baseUrl, checks, states, keyboard, layout, beforeLaunch, handoff, returned, errors };
  fs.writeFileSync(path.join(artifacts, "atlas-syllabus-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok:report.ok, checks, states, keyboard, layout, beforeLaunch, handoff, returned, errors }, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
