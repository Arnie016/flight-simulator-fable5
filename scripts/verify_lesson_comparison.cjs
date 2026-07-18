#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";

async function waitForSim(page) {
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout:30000 });
  await page.waitForFunction(() => ["loaded","fallback"].includes(COCKPIT_YOKE_ASSET.status) && ["loaded","fallback"].includes(COCKPIT_COMPASS_ASSET.status), null, { timeout:30000 });
  await page.evaluate(() => { boot.style.display = "none"; document.body.classList.remove("booting"); });
}

async function lessonRows(page) {
  return page.evaluate(() => [...document.querySelectorAll(".ground-mission")].map(button => ({
    id:button.dataset.mission,
    title:button.querySelector("strong")?.textContent || "",
    difficulty:button.querySelector(".mission-meta b")?.textContent || "",
    tier:+(button.querySelector(".mission-meta b")?.dataset.tier || 0),
    mode:button.querySelector(".mission-meta i")?.textContent || "",
    state:button.querySelector(".mission-state em")?.textContent || "",
    reward:button.querySelector(".mission-state small")?.textContent || "",
    progress:[...button.querySelectorAll(".mission-progress i")].map(item => item.classList.contains("done")),
    selected:button.getAttribute("aria-pressed") === "true",
    current:button.getAttribute("aria-current") === "true",
    label:button.getAttribute("aria-label") || ""
  })));
}

async function cardFit(page) {
  return page.evaluate(() => {
    const card=document.querySelector(".destination-card"), actions=document.querySelector(".destination-actions"), rows=[...document.querySelectorAll(".ground-mission")], cardRect=card.getBoundingClientRect(), actionRect=actions.getBoundingClientRect();
    return {
      viewport:{ width:innerWidth, height:innerHeight },
      documentOverflow:document.documentElement.scrollWidth-innerWidth,
      card:{ left:cardRect.left, right:cardRect.right, top:cardRect.top, bottom:cardRect.bottom, height:cardRect.height },
      actions:{ left:actionRect.left, right:actionRect.right, top:actionRect.top, bottom:actionRect.bottom },
      rowsInside:rows.every(row=>{const rect=row.getBoundingClientRect();return rect.left>=cardRect.left&&rect.right<=cardRect.right&&rect.top>=cardRect.top&&rect.bottom<=cardRect.bottom;}),
      actionsInside:actionRect.left>=cardRect.left&&actionRect.right<=cardRect.right&&actionRect.bottom<=cardRect.bottom,
      selectedCount:rows.filter(row=>row.getAttribute("aria-pressed")==="true").length,
      currentCount:rows.filter(row=>row.getAttribute("aria-current")==="true").length
    };
  });
}

async function main() {
  fs.mkdirSync(artifacts, { recursive:true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless:true, ...(fs.existsSync(systemChrome) ? { executablePath:systemChrome } : {}) });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 }, deviceScaleFactor:2 });
  const errors=[], ignoredReloadWarnings=[];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    const text=message.text();
    if (/THREE\.GLTFLoader: Couldn't load texture blob:http:\/\/127\.0\.0\.1:\d+\//.test(text)) { ignoredReloadWarnings.push(text); return; }
    errors.push("console: " + text);
  });

  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("ff_story_selected_v1", JSON.stringify({ storm:"stormhaven-medevac" }));
    localStorage.setItem("ff_story_progress_v1", JSON.stringify({ version:1, missions:{
      "stormhaven-medevac":{ goalIds:["check","relay"], completed:false, attempts:1, bestScore:76, bestXp:230 },
      "night-courier":{ goalIds:["relay","route","score"], completed:true, attempts:2, bestScore:91, bestXp:460 }
    }}));
  });
  await page.reload({ waitUntil:"domcontentloaded" });
  await waitForSim(page);
  await page.evaluate(() => { openMissionBoard(); setAtlasSelection("stormhaven"); });
  const catalog=await page.evaluate(() => SIM.storyMissions().missions.filter(mission=>mission.scene==="storm"));
  const initial=await lessonRows(page), desktopFit=await cardFit(page);

  await page.locator('.ground-mission[data-mission="night-courier"]').click();
  const mouseSelection={
    rows:await lessonRows(page),
    preview:await page.locator("#destinationLessonPreview").textContent(),
    stored:await page.evaluate(() => JSON.parse(localStorage.getItem("ff_story_selected_v1") || "{}").storm)
  };

  await page.locator('.ground-mission[data-mission="night-courier"]').focus();
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector('.ground-mission[data-mission="stormhaven-medevac"]')?.getAttribute("aria-pressed") === "true" && document.activeElement?.dataset?.mission === "stormhaven-medevac");
  const keyboardUp=await page.evaluate(() => ({ selected:document.querySelector(".ground-mission.selected")?.dataset.mission, focus:document.activeElement?.dataset?.mission, preview:destinationLessonPreview.textContent }));
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector('.ground-mission[data-mission="night-courier"]')?.getAttribute("aria-pressed") === "true" && document.activeElement?.dataset?.mission === "night-courier");
  const keyboardDown=await page.evaluate(() => ({ selected:document.querySelector(".ground-mission.selected")?.dataset.mission, focus:document.activeElement?.dataset?.mission, preview:destinationLessonPreview.textContent }));
  await page.screenshot({ path:path.join(artifacts,"lesson-comparison-desktop.png") });

  await page.reload({ waitUntil:"domcontentloaded" });
  await waitForSim(page);
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => { openMissionBoard(); setAtlasSelection("stormhaven"); });
  const persisted={ rows:await lessonRows(page), selected:await page.evaluate(() => SIM.storyMissions().selected.storm), preview:await page.locator("#destinationLessonPreview").textContent() };
  const mobileFit=await cardFit(page);
  await page.locator(".destination-card").scrollIntoViewIfNeeded();
  await page.screenshot({ path:path.join(artifacts,"lesson-comparison-mobile.png") });

  await page.locator("#destinationLaunch").click();
  await page.waitForFunction(() => !SIM.boardState().visible && SIM.camInfo().mode === "COCKPIT");
  const handoff=await page.evaluate(() => ({ mission:SIM.cockpitDock().mission_id, realtime:SIM.realtimeFlightState().cockpit.controls.mission_id, camera:SIM.camInfo().mode }));

  const checks={
    authoredComparison:catalog.length===2&&catalog[0].difficulty==="ADVANCED"&&catalog[1].difficulty==="EXPERT"&&catalog[0].mode==="EMERGENCY"&&catalog[1].mode==="LOGISTICS",
    visibleComparison:initial.length===2&&initial[0].difficulty==="ADVANCED"&&initial[1].difficulty==="EXPERT"&&initial[0].mode!==initial[1].mode&&initial.every(row=>row.label.includes(row.difficulty)&&row.progress.length===3),
    progressIsVisual:initial[0].progress.filter(Boolean).length===2&&initial[1].progress.every(Boolean)&&initial[1].state==="MASTERED"&&initial[0].reward==="BEST 76",
    selectedHierarchy:initial.filter(row=>row.selected).length===1&&initial.filter(row=>row.current).length===1&&initial[0].state==="SELECTED",
    mouseSelection:mouseSelection.rows[1].selected&&mouseSelection.rows[1].current&&mouseSelection.preview.includes("dark route")&&mouseSelection.stored==="night-courier",
    keyboardSelection:keyboardUp.selected==="stormhaven-medevac"&&keyboardUp.focus==="stormhaven-medevac"&&keyboardUp.preview.includes("medical supplies")&&keyboardDown.selected==="night-courier"&&keyboardDown.focus==="night-courier"&&keyboardDown.preview.includes("dark route"),
    selectionPersists:persisted.selected==="night-courier"&&persisted.rows[1].selected&&persisted.preview.includes("dark route"),
    desktopFit:desktopFit.documentOverflow<=0&&desktopFit.rowsInside&&desktopFit.actionsInside&&desktopFit.selectedCount===1&&desktopFit.currentCount===1,
    mobileFit:mobileFit.documentOverflow<=0&&mobileFit.rowsInside&&mobileFit.actionsInside&&mobileFit.selectedCount===1&&mobileFit.currentCount===1&&mobileFit.card.left>=0&&mobileFit.card.right<=390,
    launchContinuity:handoff.mission==="night-courier"&&handoff.realtime==="night-courier"&&handoff.camera==="COCKPIT",
    zeroConsoleErrors:errors.length===0
  };
  const report={ ok:Object.values(checks).every(Boolean), checks, catalog, initial, mouseSelection, keyboardUp, keyboardDown, persisted, desktopFit, mobileFit, handoff, ignoredReloadWarnings, errors };
  fs.writeFileSync(path.join(artifacts,"lesson-comparison-verification.json"), JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ ok:report.ok, checks, desktopFit, mobileFit, handoff, errors },null,2));
  await browser.close();
  process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
