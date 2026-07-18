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
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
  await page.evaluate(() => {
    if (BOOT.active) { BOOT.ready = true; enterFlight(); }
    boot.style.display = "none"; document.body.classList.remove("booting");
    REPLAY.history.length = 0;
    for (let i = 0; i < 52; i++) REPLAY.history.push({ t:i*.2, x:9-Math.sin(i*.18)*5-i*.12, y:35-i*.6, z:430-i*8, qx:0, qy:0, qz:0, qw:1 });
    S.pos.set(3, CFG.restY, 12); S.touchSink = 1.3;
    SCORE.value = 83; SCORE.grade = "B"; SCORE.tdSink = 1.3; SCORE.tdOff = 4;
    MISSION.idx = MISSION.legs.length; MISSION.done = true;
    showDebrief(83);
  });
  await page.waitForTimeout(250);

  const reportCard = await page.evaluate(() => {
    const pixels = debriefTraceCanvas.getContext("2d").getImageData(0,0,debriefTraceCanvas.width,debriefTraceCanvas.height).data;
    let colored = 0; for (let i=0;i<pixels.length;i+=4) if (pixels[i+3] && (pixels[i] > 70 || pixels[i+1] > 90 || pixels[i+2] > 90)) colored++;
    return {
      title:debriefTitle.textContent,
      imageBytes:debriefMomentImage.src.length,
      stars:debriefStars.querySelectorAll("i.on").length,
      metrics:debriefMetrics.children.length,
      metricText:debriefMetrics.textContent.replace(/\s+/g," ").trim(),
      traceTitle:debriefTraceTitle.textContent,
      traceNote:debriefTraceNote.textContent,
      traceColoredPixels:colored,
      logOpen:document.querySelector("#debrief .flight-log").open,
      actions:[...document.querySelectorAll("#debrief .actions button")].map(button=>button.textContent.trim())
    };
  });
  await page.screenshot({ path:path.join(artifacts,"flight-report-card-desktop.png") });

  const coaching = await page.evaluate(() => {
    AVIATOR.status = "REALTIME VOICE OFFLINE"; requestAviatorDebrief(); const offline = debriefAviatorText.textContent, offlineMeta = debriefAviatorMeta.textContent;
    const sent=[]; AVIATOR.status="LIVE"; AVIATOR.micEnabled=false; AVIATOR.dc={readyState:"open",send:payload=>sent.push(JSON.parse(payload))}; requestAviatorDebrief();
    handleAviatorEvent({type:"response.output_audio_transcript.done",transcript:"Strength: Stable flare and calm energy management. Correction: Hold the centerline two seconds longer. Next drill: One centerline-only circuit; the runway is not moving, promise."});
    return { offline, offlineMeta, sent, state:debriefAviatorState.textContent, strength:debriefAviatorStrength.textContent, correction:debriefAviatorCorrection.textContent, drill:debriefAviatorDrill.textContent, meta:debriefAviatorMeta.textContent, hiddenTranscript:debriefAviatorText.textContent };
  });

  await page.evaluate(() => { hideDebrief(); openMissionBoard(); drawIslandAtlas(); });
  await page.waitForTimeout(350);
  const academy = await page.evaluate(() => ({
    selected:BOARD.selectedId, pins:WORLD_STATE.mapHits.length, lessons:locationGrid.querySelectorAll(".ground-mission").length,
    selectedLessons:locationGrid.querySelectorAll(".ground-mission.selected").length, launchDisabled:destinationLaunch.disabled,
    cardWall:getComputedStyle(missionBoardGrid).display, heading:missionBoardTitle.textContent
  }));
  await page.evaluate(() => setAtlasSelection("silverLake"));
  const freeFlight = await page.evaluate(() => ({ selected:BOARD.selectedId, lessons:locationGrid.querySelectorAll(".ground-mission").length, launchDisabled:destinationLaunch.disabled, copy:locationGrid.textContent.replace(/\s+/g," ").trim() }));
  await page.evaluate(() => { setAtlasSelection("alpineRidge"); const option=locationGrid.querySelectorAll(".ground-mission")[1]; option.click(); });
  const alpine = await page.evaluate(() => ({ selected:BOARD.selectedId, lesson:locationGrid.querySelector(".ground-mission.selected strong")?.textContent || "", persisted:SIM.storyMissions().selected.alpine }));
  await page.screenshot({ path:path.join(artifacts,"training-island-map-desktop.png") });

  await page.setViewportSize({ width:390, height:844 });
  await page.waitForTimeout(180);
  const mobileMap = await page.evaluate(() => ({ overflow:document.documentElement.scrollWidth-innerWidth, map:islandMapCanvas.getBoundingClientRect().toJSON(), sheet:missionBoardEl.querySelector(".sheet").getBoundingClientRect().toJSON() }));
  await page.screenshot({ path:path.join(artifacts,"training-island-map-mobile.png") });
  await page.evaluate(() => { hideMissionBoard(); debriefEl.classList.add("show"); debriefEl.setAttribute("aria-hidden","false"); });
  const mobileDebrief = await page.evaluate(() => { const sheet=debriefEl.querySelector(".sheet").getBoundingClientRect(); return { overflow:document.documentElement.scrollWidth-innerWidth, sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom}, metrics:debriefMetrics.children.length }; });
  await page.screenshot({ path:path.join(artifacts,"flight-report-card-mobile.png") });

  const eventText = coaching.sent.find(event=>event.item?.content?.[0]?.text)?.item.content[0].text || "";
  const checks = {
    visualReport:reportCard.imageBytes>1000 && reportCard.stars===2 && reportCard.metrics===3 && reportCard.traceColoredPixels>100 && !reportCard.logOpen,
    honestHighlights:reportCard.metricText.includes("1.3 m/s") && reportCard.metricText.includes("4 m") && /replay samples/i.test(reportCard.traceNote),
    simpleActions:["RETRY FLIGHT","REPLAY","TRAINING MAP","FREE FLIGHT"].every(label=>reportCard.actions.includes(label)),
    offlineIsTextOnly:coaching.offline.includes("83/100") && coaching.offline.includes("Connect GPT Realtime") && coaching.offlineMeta.includes("No synthetic fallback voice"),
    groundedRealtime:eventText.includes('"score":83') && eventText.includes('"touchdown_sink_mps":1.3') && coaching.strength.startsWith("Stable flare") && coaching.correction.startsWith("Hold the centerline") && coaching.drill.startsWith("One centerline-only"),
    mapIsLevelSelector:academy.pins===10 && academy.lessons===2 && academy.selectedLessons===1 && !academy.launchDisabled && academy.cardWall==="none" && academy.heading==="Island Flight Atlas",
    freeFlightHonest:freeFlight.selected==="silverLake" && freeFlight.lessons===0 && freeFlight.launchDisabled && freeFlight.copy.includes("FREE FLIGHT LANDMARK"),
    lessonPersists:alpine.selected==="alpineRidge" && alpine.lesson==="Ridge Mail" && alpine.persisted==="ridge-mail",
    responsive:mobileMap.overflow<=0 && mobileMap.map.width<=370 && mobileDebrief.overflow<=0 && mobileDebrief.sheet.left>=0 && mobileDebrief.sheet.right<=390 && mobileDebrief.metrics===3,
    zeroConsoleErrors:errors.length===0
  };
  const report = { ok:Object.values(checks).every(Boolean), checks, reportCard, coaching, academy, freeFlight, alpine, mobileMap, mobileDebrief, errors };
  fs.writeFileSync(path.join(artifacts,"debrief-training-map-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,reportCard,academy,freeFlight,alpine,mobileDebrief,errors},null,2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
