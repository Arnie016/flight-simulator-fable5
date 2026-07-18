#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().hits.length===10,null,{timeout:30000});

  const initial=await page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    return{viewportHeight:innerHeight,sheet:rect(missionBoardEl.querySelector(".sheet")),career:rect(careerBoard),stage:rect(atlasMapStage),brief:rect(atlasMobileBrief),intro:getComputedStyle(missionBoardEl.querySelector(".intro")).display,briefDisplay:getComputedStyle(atlasMobileBrief).display,scrollTop:missionBoardEl.querySelector(".sheet").scrollTop,labels:{state:atlasMobileState.textContent,name:atlasMobileName.textContent,route:atlasMobileRoute.textContent},actions:{travel:atlasMobileTravel.getAttribute("aria-label"),launch:atlasMobileLaunch.getAttribute("aria-label"),disabled:atlasMobileLaunch.disabled}};
  });

  const mapBox=await page.locator("#islandMapCanvas").boundingBox(),breakwater=await page.evaluate(()=>SIM.liveAtlas().hits.find(hit=>hit.id==="breakwater"));
  await page.mouse.click(mapBox.x+breakwater.x,mapBox.y+breakwater.y);
  await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="breakwater");
  const markerSelection=await page.evaluate(()=>({selected:SIM.liveAtlas().selectedId,name:atlasMobileName.textContent}));
  await page.evaluate(()=>setAtlasSelection("alpineRidge"));
  const selected=await page.evaluate(()=>{const rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};};return{selected:SIM.liveAtlas().selectedId,state:atlasMobileState.textContent,name:atlasMobileName.textContent,route:atlasMobileRoute.textContent,launchDisabled:atlasMobileLaunch.disabled,focus:rect(atlasFocus),focusHidden:atlasFocus.classList.contains("hidden"),focusDisplay:getComputedStyle(atlasFocus).display,focusAriaHidden:atlasFocus.getAttribute("aria-hidden"),brief:rect(atlasMobileBrief)};});
  await page.screenshot({path:path.join(artifacts,"mobile-flight-planner.png")});

  await page.evaluate(()=>setAtlasSelection("silverLake"));
  const landmark=await page.evaluate(()=>({state:atlasMobileState.textContent,name:atlasMobileName.textContent,launchDisabled:atlasMobileLaunch.disabled,travelLabel:atlasMobileTravel.getAttribute("aria-label"),launchLabel:atlasMobileLaunch.getAttribute("aria-label")}));

  await page.evaluate(()=>setAtlasSelection("alpineRidge"));
  await page.locator("#atlasMobileSummary").focus();await page.keyboard.press("Enter");await page.waitForTimeout(550);
  const details=await page.evaluate(()=>{const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(),card=locationGrid.getBoundingClientRect();return{scrollTop:missionBoardEl.querySelector(".sheet").scrollTop,card:{top:card.top,bottom:card.bottom},sheet:{top:sheet.top,bottom:sheet.bottom},focused:document.activeElement===atlasMobileSummary};});

  await page.evaluate(()=>{missionBoardEl.querySelector(".sheet").scrollTop=0;setAtlasSelection("alpineRidge");});
  await page.locator("#atlasMobileLaunch").click();
  await page.waitForFunction(()=>!SIM.boardState().visible&&document.body.classList.contains("cockpit-view"));
  const launched=await page.evaluate(()=>({board:SIM.boardState().visible,camera:SIM.camInfo().mode,cockpit:document.body.classList.contains("cockpit-view"),level:activeLevel.id,mission:MISSION.storyId,weather:sceneOperationsReadout(),phase:S.phase}));

  const checks={
    compactRank:initial.career.height<=58&&initial.intro==="none",
    mapFirst:initial.stage.top<initial.viewportHeight*.42&&initial.stage.bottom<initial.viewportHeight*.62,
    persistentBrief:initial.briefDisplay==="grid"&&initial.brief.left>=initial.stage.left&&initial.brief.right<=initial.stage.right&&initial.brief.top>=initial.stage.top&&initial.brief.bottom<=initial.stage.bottom,
    initialState:initial.labels.name==="Academy Airfield"&&initial.labels.state.includes("LEVEL 01")&&initial.actions.travel.includes("Academy Airfield")&&!initial.actions.disabled,
    markerSelection:markerSelection.selected==="breakwater"&&markerSelection.name==="Breakwater Bay",
    alpineBriefing:selected.selected==="alpineRidge"&&selected.name==="Alpine Rescue Ridge"&&selected.state.includes("LEVEL 03")&&selected.route.includes("SNOW")&&!selected.launchDisabled,
    mobileProgressiveDisclosure:selected.focusHidden&&selected.focusDisplay==="none"&&selected.focusAriaHidden==="true"&&selected.route.includes("CLR")&&!overlaps(selected.focus,selected.brief),
    landmarkGating:landmark.name==="Silver Lake"&&landmark.state.includes("FREE FLIGHT")&&landmark.launchDisabled&&landmark.travelLabel.includes("Silver Lake")&&landmark.launchLabel.includes("No scored lesson"),
    keyboardBriefing:details.focused&&details.card.top>=details.sheet.top&&details.card.bottom<=details.sheet.bottom,
    launchContinuity:!launched.board&&launched.cockpit&&launched.camera==="COCKPIT"&&launched.level==="alpine"&&launched.mission==="alpine-shelter"&&launched.weather.includes("FLURRIES")&&launched.phase==="parked",
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,markerSelection,selected,landmark,details,launched,errors};
  fs.writeFileSync(path.join(artifacts,"mobile-flight-planner-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
