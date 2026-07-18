#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function readStrip(page){
  return page.evaluate(()=>{
    const hud=missionHud.getBoundingClientRect(),director=missionHud.querySelector(".lesson-director"),target=missionHud.querySelector(".lesson-target b"),range=missionHud.querySelector(".lesson-range"),eta=missionHud.querySelector(".lesson-range small"),objective=missionHud.querySelector(".obj"),clip=clipControls.getBoundingClientRect(),rail=missionHud.querySelector(".lesson-phase-rail"),realtimeState=SIM.realtimeFlightState();
    const steps=[...missionHud.querySelectorAll(".lesson-phase-step")].map(step=>({id:step.dataset.stage,status:step.classList.contains("done")?"done":step.classList.contains("current")?"current":"upcoming",label:step.querySelector("small")?.textContent||"",ariaCurrent:step.getAttribute("aria-current")}));
    return{phase:missionHud.dataset.phase,leg:missionHud.dataset.leg,checkState:missionHud.dataset.checkState,flightStage:missionHud.dataset.flightStage,flightStageIndex:+missionHud.dataset.flightStageIndex,title:missionHud.querySelector(".title")?.textContent||"",objective:objective?.textContent||"",objectiveHeight:objective?.getBoundingClientRect().height||0,directorDisplay:getComputedStyle(director).display,target:target?.textContent||"",range:range?.childNodes[0]?.textContent||"",eta:eta?.textContent||"",hud:{left:hud.left,right:hud.right,top:hud.top,bottom:hud.bottom,width:hud.width,height:hud.height},clip:{left:clip.left,right:clip.right,top:clip.top,bottom:clip.bottom},navDisplay:getComputedStyle(navDirector).display,phaseRailDisplay:getComputedStyle(rail).display,phaseRailClass:rail.className,phaseRailAria:rail.getAttribute("aria-label"),phaseSteps:steps,activeStage:steps.find(step=>step.status==="current")?.id||"",metaDisplay:getComputedStyle(missionHud.querySelector(".meta")).display,barDisplay:getComputedStyle(missionHud.querySelector(".bar")).display,realtime:realtimeState.cockpit.controls,realtimePlan:realtimeState.mission.flight_plan};
  });
}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setLevel("alpine");SIM.setCam(1);updateCamera(.016);updateMissionHud();updateCockpitDock();});
  await page.waitForFunction(()=>getComputedStyle(missionHud).display==="block"&&missionHud.querySelector(".lesson-director"));
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded,null,{timeout:30000});
  const parked=await readStrip(page);
  await page.screenshot({path:path.join(artifacts,"cockpit-lesson-strip-desktop.png")});

  await page.locator("#missionHud .checks-toggle").dispatchEvent("click");
  const opened=await page.evaluate(()=>({expanded:missionHud.querySelector(".checks-toggle")?.getAttribute("aria-expanded"),groups:getComputedStyle(missionHud.querySelector(".check-groups")).display,body:document.body.classList.contains("cockpit-checks-open"),groupCount:missionHud.querySelectorAll(".check-group").length}));
  await page.locator("#missionHud .checks-toggle").dispatchEvent("click");
  const closed=await page.evaluate(()=>({expanded:missionHud.querySelector(".checks-toggle")?.getAttribute("aria-expanded"),groups:getComputedStyle(missionHud.querySelector(".check-groups")).display,body:document.body.classList.contains("cockpit-checks-open")}));

  await page.click("#cockpitDockToggle");await page.waitForFunction(()=>SIM.cockpitDock().expanded);await page.click("#cockpitDepartureCheck");
  await page.evaluate(()=>{COCKPIT_DOCK.manualExpanded=false;COCKPIT_DOCK.physicalReadyCollapsed=false;});
  await page.locator("#cockpitThrottle").evaluate(input=>{input.value="75";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.evaluate(()=>{SIM.warp(2.5);updateMissionHud();updateCockpitDock();});
  const active=await readStrip(page);
  await page.screenshot({path:path.join(artifacts,"cockpit-flight-plan-active-desktop.png")});

  await page.evaluate(()=>{S.paused=true;S.crashed=false;S.fail.engine=false;GO_AROUND.active=false;S.onGround=false;S.wasAirborne=true;S.phase="approach";updateMissionHud();});
  const approach=await readStrip(page);
  await page.evaluate(()=>{S.crashed=true;S.phase="crashed";updateMissionHud();});
  const recovery=await readStrip(page);
  await page.evaluate(()=>{S.crashed=false;S.reason="";S.fail.engine=false;GO_AROUND.active=false;S.onGround=true;S.wasAirborne=false;S.phase="takeoff-roll";S.paused=false;updateMissionHud();});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{updateCamera(.016);updateMissionHud();updateCockpitDock();});
  await page.waitForTimeout(180);
  const mobile=await page.evaluate(()=>{const state=(()=>{const hud=missionHud.getBoundingClientRect(),director=missionHud.querySelector(".lesson-director"),clip=clipControls.getBoundingClientRect(),rail=missionHud.querySelector(".lesson-phase-rail"),railRect=rail.getBoundingClientRect(),steps=[...rail.querySelectorAll(".lesson-phase-step")];return{overflow:document.documentElement.scrollWidth-innerWidth,hud:{left:hud.left,right:hud.right,top:hud.top,bottom:hud.bottom,width:hud.width,height:hud.height},clip:{left:clip.left,right:clip.right,top:clip.top,bottom:clip.bottom},rail:{left:railRect.left,right:railRect.right,width:railRect.width,scrollWidth:rail.scrollWidth,clientWidth:rail.clientWidth},director:getComputedStyle(director).display,target:missionHud.querySelector(".lesson-target b")?.textContent||"",range:missionHud.querySelector(".lesson-range")?.childNodes[0]?.textContent||"",nav:getComputedStyle(navDirector).display,activeStage:rail.querySelector(".lesson-phase-step.current")?.dataset.stage||"",labelsHidden:steps.every(step=>getComputedStyle(step.querySelector("small")).display==="none")};})();return state;});
  await page.screenshot({path:path.join(artifacts,"cockpit-lesson-strip-mobile.png")});

  const checks={
    compactHierarchy:parked.phase==="parked"&&parked.leg==="1"&&parked.title.length>0&&parked.objective.length>0&&parked.objectiveHeight<30,
    liveDirector:parked.directorDisplay==="grid"&&parked.target.length>0&&parked.range.length>0&&parked.eta.startsWith("ETA"),
    progressiveChecklist:opened.expanded==="true"&&opened.groups==="grid"&&opened.body&&opened.groupCount===4&&closed.expanded==="false"&&closed.groups==="none"&&!closed.body,
    phaseAware:active.phase!=="parked"&&active.leg===parked.leg&&active.title!==parked.title&&active.objective!==parked.objective&&active.directorDisplay==="grid"&&active.realtime.throttle_command_percent===75,
    realtimeContext:parked.realtime.mission_id===active.realtime.mission_id&&parked.realtime.mission_title===active.realtime.mission_title,
    parkedFlightPlan:parked.phaseRailDisplay==="block"&&parked.flightStage==="check"&&parked.flightStageIndex===0&&parked.activeStage==="check"&&parked.phaseSteps.length===6&&parked.phaseRailAria.includes("stage 1 of 6")&&parked.realtimePlan.active_stage==="check"&&parked.realtimePlan.active_label==="CHECKS"&&parked.metaDisplay==="none"&&parked.barDisplay==="none",
    takeoffFlightPlan:active.flightStage==="roll"&&active.flightStageIndex===1&&active.activeStage==="roll"&&active.phaseSteps[0].status==="done"&&active.phaseSteps[1].ariaCurrent==="step"&&active.realtimePlan.active_stage==="roll"&&active.realtimePlan.stage_number===2,
    approachFlightPlan:approach.flightStage==="final"&&approach.flightStageIndex===4&&approach.activeStage==="final"&&approach.phaseSteps.slice(0,4).every(step=>step.status==="done")&&approach.realtimePlan.active_label==="FINAL",
    recoveryFlightPlan:recovery.flightStage==="final"&&recovery.activeStage==="final"&&recovery.phaseRailClass.includes("warning")&&recovery.realtimePlan.active_label==="RECOVER"&&recovery.realtimePlan.state==="warning",
    desktopFit:parked.hud.left>=0&&parked.hud.right<=1440&&parked.hud.top>=0&&parked.hud.height<190,
    mobileFit:mobile.overflow<=0&&mobile.hud.left>=0&&mobile.hud.right<=mobile.clip.left&&mobile.hud.bottom<260&&mobile.rail.left>=mobile.hud.left&&mobile.rail.right<=mobile.hud.right&&mobile.rail.scrollWidth<=mobile.rail.clientWidth,
    mobileKeepsGuidance:mobile.nav==="none"&&mobile.director==="grid"&&mobile.target.length>0&&mobile.range.length>0&&mobile.activeStage==="roll"&&mobile.labelsHidden,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,parked,opened,closed,active,approach,recovery,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-lesson-strip-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
