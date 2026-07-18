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
  await page.waitForFunction(() => ["loaded","fallback"].includes(COCKPIT_YOKE_ASSET.status) && ["loaded","fallback"].includes(COCKPIT_COMPASS_ASSET.status), null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById("boot").style.display = "none"; document.body.classList.remove("booting"); });
}

async function boardFit(page) {
  return page.evaluate(() => {
    const options = [...document.querySelectorAll(".ground-mission")], cards = [...document.querySelectorAll("#missionBoard .destination-card")];
    const inside = options.every(option => {
      const button = option.getBoundingClientRect(), card = option.closest(".destination-card").getBoundingClientRect();
      return button.left >= card.left && button.right <= card.right && button.top >= card.top && button.bottom <= card.bottom;
    });
    return { overflow: document.documentElement.scrollWidth - innerWidth, optionCount: options.length, cardCount: cards.length, selectedCount: options.filter(option => option.classList.contains("selected")).length, controlsInside: inside, pins:WORLD_STATE.mapHits.length, cardWall:getComputedStyle(missionBoardGrid).display };
  });
}

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(systemChrome) ? { executablePath:systemChrome } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [], ignoredReloadWarnings = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Reloading destroys GLTFLoader's browser-owned texture URL; the cockpit suite verifies both assets independently.
    if (/THREE\.GLTFLoader: Couldn't load texture blob:http:\/\/127\.0\.0\.1:8643\//.test(text)) { ignoredReloadWarnings.push(text); return; }
    errors.push("console: " + text);
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSim(page);

  const catalog = await page.evaluate(() => SIM.storyMissions());
  await page.evaluate(() => openMissionBoard());
  const initialBoard = await boardFit(page);
  await page.evaluate(() => setAtlasSelection("breakwater"));
  await page.click('.ground-mission[data-level="coast"][data-mission="lighthouse-survey"]');
  const selectedTitle = await page.locator("#missionBoard .ground-mission.selected strong").textContent();
  await page.screenshot({ path: path.join(artifacts, "story-missions-board-desktop.png") });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSim(page);
  await page.evaluate(() => { openMissionBoard(); setAtlasSelection("breakwater"); });
  const persistedSelection = await page.evaluate(() => ({ selected:SIM.storyMissions().selected.coast, title:document.querySelector("#missionBoard .ground-mission.selected strong")?.textContent || "" }));

  await page.evaluate(() => {
    hideMissionBoard(true);
    SIM.selectStoryMission("circuit", "academy-checkride", true);
    acknowledgeDeparture();
    MISSION.idx = MISSION.legs.length;
    SCORE.value = 82; SCORE.grade = "B"; SCORE.tdSink = 1.4; SCORE.tdOff = 3;
  });
  const liveObjectives = await page.evaluate(() => SIM.contracts());
  await page.evaluate(() => { MISSION.done = true; showDebrief(82); });
  const debrief = await page.evaluate(() => ({
    visible:debriefEl.classList.contains("show"), title:debriefTitle.textContent, contract:debriefContract.textContent.replace(/\s+/g, " ").trim(),
    missionXp:MISSION.xp, progress:SIM.storyMissions().missions.find(mission => mission.id === "academy-checkride")
  }));
  await page.screenshot({ path: path.join(artifacts, "story-missions-debrief-desktop.png") });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSim(page);
  const persistedProgress = await page.evaluate(() => SIM.storyMissions().missions.find(mission => mission.id === "academy-checkride"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => openMissionBoard());
  const mobileBoard = await boardFit(page);
  await page.evaluate(() => { const sheet = document.querySelector("#missionBoard .sheet"); sheet.scrollTop = sheet.scrollHeight; });
  await page.screenshot({ path: path.join(artifacts, "story-missions-board-mobile.png") });

  const byScene = Object.fromEntries(Object.keys(catalog.selected).map(scene => [scene, catalog.missions.filter(mission => mission.scene === scene).length]));
  const checks = {
    twelveMissions: catalog.count === 12 && catalog.missions.length === 12,
    sixArchetypes: catalog.archetypes.length === 6 && ["delivery", "emergency", "rescue", "survey", "training", "transport"].every(type => catalog.archetypes.includes(type)),
    twoPerScene: Object.keys(byScene).length === 6 && Object.values(byScene).every(count => count === 2),
    authoredContracts: catalog.missions.every(mission => mission.briefing.length >= 24 && mission.completionXp > 0 && mission.goals.length === 3 && mission.goals.every(goal => goal.label && goal.kind && goal.xp > 0)),
    mapScopedSelectors: initialBoard.optionCount === 2 && initialBoard.cardCount === 1 && initialBoard.selectedCount === 1 && initialBoard.controlsInside && initialBoard.pins === 10 && initialBoard.cardWall === "none",
    selectionChangesBriefing: selectedTitle.trim() === "Lighthouse Survey",
    selectionPersists: persistedSelection.selected === "lighthouse-survey" && persistedSelection.title.trim() === "Lighthouse Survey",
    statefulObjectives: liveObjectives.missionId === "academy-checkride" && liveObjectives.completed === 3 && liveObjectives.goals.every(goal => goal.current && goal.progress === 1),
    visibleOutcome: debrief.visible && debrief.title.includes("MISSION COMPLETE") && debrief.contract.includes("MISSION COMPLETE") && debrief.contract.includes("3/3"),
    xpBanked: debrief.missionXp >= 415 && debrief.contract.includes("XP"),
    missionProgressPersists: debrief.progress.completed && debrief.progress.attempts === 1 && persistedProgress.completed && persistedProgress.attempts === 1,
    desktopFit: initialBoard.overflow <= 0,
    mobileFit: mobileBoard.overflow <= 0 && mobileBoard.optionCount === 2 && mobileBoard.controlsInside && mobileBoard.pins === 10,
    zeroConsoleErrors: errors.length === 0
  };
  const report = { ok:Object.values(checks).every(Boolean), checks, catalog:{ count:catalog.count, archetypes:catalog.archetypes, byScene }, initialBoard, persistedSelection, liveObjectives, debrief, persistedProgress, mobileBoard, ignoredReloadWarnings, errors };
  fs.writeFileSync(path.join(artifacts, "story-missions-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
