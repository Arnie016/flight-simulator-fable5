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
  const page = await browser.newPage({ viewport:{ width:1600, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if(message.type()==="error")errors.push("console: "+message.text()); });

  await page.goto(baseUrl,{ waitUntil:"domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout:30000 });
  const rankResult = await page.evaluate(() => {
    if(BOOT.active){BOOT.ready=true;enterFlight();}
    boot.style.display="none";document.body.classList.remove("booting");
    localStorage.removeItem(FLIGHT_MOMENTS_KEY);FLIGHT_MOMENTS_CACHE=null;
    localStorage.removeItem(STORY_PROGRESS_KEY);STORY_PROGRESS_CACHE=null;
    localStorage.setItem(PILOT_PROFILE_KEY,JSON.stringify({xp:895,runs:0,deliveries:0,recoveries:0,deadSticks:0,bestSkill:0,lastScene:""}));
    PREFLIGHT.awarded=true;APPROACH.awarded=true;MISSION.idx=MISSION.legs.length;MISSION.done=true;
    S.pos.set(1,CFG.restY,12);S.touchSink=1.1;SCORE.value=94;SCORE.grade="A";SCORE.tdSink=1.1;SCORE.tdOff=1;
    REPLAY.history.length=0;for(let i=0;i<58;i++)REPLAY.history.push({t:i*.2,x:2-i*.02,y:35-i*.55,z:470-i*8,qx:0,qy:0,qz:0,qw:1});
    showDebrief(94);
    return{label:debriefBestLabel.textContent,value:debriefBest.textContent,rankUp:debriefEl.dataset.rankUp,profile:loadPilotProfile()};
  });
  await page.waitForFunction(() => { try{return JSON.parse(localStorage.getItem(FLIGHT_MOMENTS_KEY)||"null")?.locations?.academy?.image?.length>1000;}catch(error){return false;} }, null, { timeout:5000 });
  await page.evaluate(() => openMissionBoard());
  await page.waitForFunction(() => BOARD.visible && LIVE_ATLAS.frames>0 && document.querySelector(".destination-logbook"));
  await page.waitForTimeout(350);

  const atlas = await page.evaluate(() => {
    const rect = element => { const box=element.getBoundingClientRect();return{left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height}; };
    const sheet=missionBoardEl.querySelector(".sheet"),map=atlasMapStage,card=locationGrid.querySelector(".destination-card"),art=locationGrid.querySelector(".destination-art"),tabs=[...atlasSyllabus.querySelectorAll("button")],reel=[...locationGrid.querySelectorAll(".reel-frame")],pixels=islandMapCanvas.getContext("2d").getImageData(0,0,islandMapCanvas.width,islandMapCanvas.height).data;
    let nonBlank=0;for(let i=0;i<pixels.length;i+=Math.max(4,Math.floor(pixels.length/16000/4)*4))if(pixels[i+3]&&(pixels[i]+pixels[i+1]+pixels[i+2])>20)nonBlank++;
    return{
      viewport:{width:innerWidth,height:innerHeight},sheet:rect(sheet),map:rect(map),card:rect(card),art:rect(art),
      sheetOverflow:sheet.scrollHeight-sheet.clientHeight,cardOverflow:card.scrollHeight-card.clientHeight,
      tabs:tabs.map(button=>({label:button.querySelector("span").textContent,height:button.getBoundingClientRect().height,font:parseFloat(getComputedStyle(button).fontSize),selected:button.getAttribute("aria-selected")})),
      logbook:[...locationGrid.querySelectorAll(".destination-logbook>span")].map(item=>item.textContent.replace(/\s+/g," ").trim()),
      story:locationGrid.querySelector(".destination-story")?.textContent.replace(/\s+/g," ").trim()||"",
      reel:{total:reel.length,captured:reel.filter(frame=>frame.classList.contains("captured")).length,current:reel.filter(frame=>frame.classList.contains("current")).length,label:locationGrid.querySelector(".destination-reel")?.getAttribute("aria-label")||""},
      rankMark:careerBoard.querySelector(".career-rank-mark")?.textContent.trim()||"",
      currentLabelDisplay:getComputedStyle(atlasCurrent).display,
      momentLabel:locationGrid.querySelector(".destination-moment")?.textContent.replace(/\s+/g," ").trim()||"",
      momentImage:loadFlightMoments().locations.academy,
      background:getComputedStyle(art).backgroundImage.slice(0,80),
      mapNonBlank:nonBlank,
      mapHits:WORLD_STATE.mapHits.length,
      atlasState:SIM.liveAtlas()
    };
  });
  await page.screenshot({ path:path.join(artifacts,"expansive-training-atlas-desktop.png") });

  await page.locator('[data-discipline="navigation"]').click();
  await page.waitForTimeout(120);
  const navigation = await page.evaluate(() => ({ discipline:BOARD.discipline,selectedLabel:atlasSyllabus.querySelector('[aria-selected="true"] span')?.textContent||"",missionCount:locationGrid.querySelectorAll(".ground-mission").length,selectedId:BOARD.selectedId }));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
  const compact=await page.evaluate(()=>({moment:getComputedStyle(locationGrid.querySelector(".destination-moment")).display,logbook:getComputedStyle(locationGrid.querySelector(".destination-logbook")).display,story:getComputedStyle(locationGrid.querySelector(".destination-story")).display,reel:getComputedStyle(locationGrid.querySelector(".destination-reel")).display,overflow:document.documentElement.scrollWidth-innerWidth}));

  const checks={
    rankUpgradeVisible:rankResult.label==="RANK UPGRADE"&&rankResult.value==="FLIGHT STUDENT"&&rankResult.rankUp==="true"&&rankResult.profile.xp>900,
    expansiveDesktop:atlas.sheet.width>=1550&&atlas.sheet.height>=980&&atlas.map.width>=1150&&atlas.map.height>=750,
    destinationIsVisual:atlas.card.width>=360&&atlas.art.height>=275&&atlas.momentLabel.includes("LAST FLIGHT")&&atlas.story.includes("Academy Airfield")&&atlas.background.startsWith('url("data:image/jpeg'),
    personalLogbook:atlas.logbook.some(text=>text==="FLIGHTS1")&&atlas.logbook.some(text=>text.includes("94 / 100"))&&atlas.logbook.some(text=>text.includes("A-GRADE ARRIVAL")),
    cinematicFlightReel:atlas.reel.total===10&&atlas.reel.captured===1&&atlas.reel.current===1&&atlas.reel.label.includes("1 of 10"),
    rankProgressProminent:atlas.rankMark==="02",
    reducedDuplicateChrome:atlas.currentLabelDisplay==="none",
    captureCompressedAndLocal:atlas.momentImage.image.length>1000&&atlas.momentImage.image.length<300000&&atlas.momentImage.score===94&&atlas.momentImage.mission_id==="academy-checkride",
    disciplinesLegible:atlas.tabs.length===6&&atlas.tabs.every(tab=>tab.height>=34&&tab.font>=9)&&atlas.tabs.some(tab=>tab.label==="NAVIGATION"),
    mapActuallyRendered:atlas.mapNonBlank>100&&atlas.mapHits===10&&atlas.atlasState.ready&&!atlas.atlasState.failed,
    contained:atlas.sheetOverflow<=1&&atlas.cardOverflow<=1,
    navigationStillWorks:navigation.discipline==="navigation"&&navigation.selectedLabel==="NAVIGATION"&&navigation.missionCount>0,
    noNewCompactUi:compact.moment==="none"&&compact.logbook==="none"&&compact.story==="none"&&compact.reel==="none"&&compact.overflow<=0,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,rankResult,atlas,navigation,compact,errors};
  fs.writeFileSync(path.join(artifacts,"expansive-training-atlas-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,rankResult,atlas:{sheet:atlas.sheet,map:atlas.map,card:atlas.card,art:atlas.art,tabs:atlas.tabs,story:atlas.story,reel:atlas.reel,rankMark:atlas.rankMark,currentLabelDisplay:atlas.currentLabelDisplay,logbook:atlas.logbook,momentLabel:atlas.momentLabel,momentBytes:atlas.momentImage.image.length,mapHits:atlas.mapHits,sheetOverflow:atlas.sheetOverflow,cardOverflow:atlas.cardOverflow},navigation,compact,errors},null,2));
  await browser.close();
  process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
