#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function hudState(page){
  return page.evaluate(()=>{const toggle=missionHud.querySelector(".checks-toggle"),groups=[...missionHud.querySelectorAll(".check-group")].map(row=>({className:row.className,text:row.innerText})),box=missionHud.getBoundingClientRect();return{presentation:SIM.preflightPresentation(),text:missionHud.innerText,classes:missionHud.querySelector(".checks")?.className||"",expanded:toggle?.getAttribute("aria-expanded")||null,groups,groupDisplay:getComputedStyle(missionHud.querySelector(".check-groups")).display,dockStatus:cockpitDockStatus.textContent,box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom}};});
}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");reset();SIM.setCam(1);updateCamera(.016);updateMissionHud();updateCockpitDock();});

  const initial=await hudState(page);
  const fullInitial=await page.evaluate(()=>({checks:SIM.preflight().checks,realtime:SIM.realtimeFlightState().departure_checks}));
  await page.locator(".checks-toggle").dispatchEvent("click");
  const disclosed=await hudState(page);
  await page.locator(".checks-toggle").dispatchEvent("click");

  await page.evaluate(()=>{SIM.setFlaps(.5);SIM.setTrim(.2);SIM.setMixture(.3);SIM.setBatteryMaster(false);SIM.warp(.12);updateMissionHud();updateCockpitDock();});
  await page.click(".check-action");
  const blocked=await hudState(page);
  const blockedState=await page.evaluate(()=>({preflight:SIM.preflight(),realtime:SIM.realtimeFlightState()}));
  await page.screenshot({path:path.join(artifacts,"preflight-progressive-desktop.png")});

  await page.click('[data-cockpit-flap="0"]');
  await page.locator("#cockpitTrim").evaluate(input=>{input.value="0";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.locator("#cockpitMixture").evaluate(input=>{input.value="100";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.click("#cockpitBattery");
  await page.evaluate(()=>{SIM.warp(1.2);updateMissionHud();updateCockpitDock();});
  const corrected=await hudState(page);
  await page.click(".check-action");
  const cleared=await hudState(page);
  const clearedState=await page.evaluate(()=>({preflight:SIM.preflight(),realtime:SIM.realtimeFlightState()}));

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{reset();SIM.setCam(1);SIM.setTrim(.2);SIM.setBatteryMaster(false);updateCamera(.016);updateMissionHud();updateCockpitDock();});
  await page.click("#cockpitDepartureCheck");
  const mobile=await page.evaluate(()=>{const hud=missionHud.getBoundingClientRect(),dock=cockpitDockEl.getBoundingClientRect(),groups=missionHud.querySelector(".check-groups").getBoundingClientRect(),clip=document.getElementById("clipControls").getBoundingClientRect(),bannerBox=bannerEl.getBoundingClientRect(),alertBox=flightAlertEl.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,hud:{left:hud.left,right:hud.right,top:hud.top,bottom:hud.bottom},dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},groups:{top:groups.top,bottom:groups.bottom,height:groups.height,scrollHeight:missionHud.querySelector(".check-groups").scrollHeight},clip:{left:clip.left,right:clip.right,top:clip.top,bottom:clip.bottom},banner:{display:getComputedStyle(bannerEl).display,top:bannerBox.top,bottom:bannerBox.bottom},alert:{display:getComputedStyle(flightAlertEl).display,top:alertBox.top,bottom:alertBox.bottom},expanded:missionHud.querySelector(".checks-toggle").getAttribute("aria-expanded"),text:missionHud.innerText,dockStatus:cockpitDockStatus.textContent};});
  await page.screenshot({path:path.join(artifacts,"preflight-progressive-mobile.png")});

  const blockedGroups=Object.fromEntries(blocked.presentation.groups.map(group=>[group.id,group]));
  const realtimeChecks=clearedState.realtime.departure_checks||[],fullChecks=clearedState.preflight.checks;
  const checks={
    collapsedByDefault:initial.expanded==="false"&&initial.groupDisplay==="none"&&!initial.text.includes("FLAPS · TRIM · DRIVE")&&!initial.text.includes("ITEMS")&&initial.text.includes("8/8 READY"),
    fullContractPreserved:initial.presentation.required_total===8&&initial.presentation.note_count===3&&fullInitial.checks.length===11&&fullInitial.realtime.length===11,
    progressiveDisclosure:disclosed.expanded==="true"&&disclosed.groupDisplay==="grid"&&disclosed.groups.length===4&&["CONFIG","POWER","SYSTEMS","CONDITIONS"].every(label=>disclosed.text.includes(label)),
    blockersGrouped:blocked.presentation.required_ready===4&&blocked.presentation.blocker_count===4&&!blockedGroups.configuration.pass&&!blockedGroups.power.pass&&!blockedGroups.systems.pass&&blocked.text.includes("FIX 4")&&blocked.text.includes("FLAPS RESET")&&blocked.text.includes("MIXTURE TOO LEAN")&&blocked.text.includes("BAT MASTER OFF"),
    blockerFirstDock:blocked.dockStatus==="FIX CONFIG"&&blockedState.realtime.cockpit.controls.focused_effect==="FIX CONFIG"&&blocked.expanded==="true"&&blockedState.preflight.lastIssues.includes("FLAPS RESET")&&blockedState.preflight.lastIssues.includes("BAT MASTER OFF"),
    liveCorrection:corrected.presentation.required_ready===8&&corrected.presentation.blocker_count===0&&corrected.text.includes("8/8 READY")&&corrected.text.includes("CHECK")&&corrected.groups.filter(group=>group.className.includes("bad")).length===0,
    clearanceCollapses:clearedState.preflight.armed&&clearedState.preflight.lastIssues===""&&cleared.expanded==="false"&&cleared.classes.includes("clear")&&cleared.text.includes("CLEAR")&&!cleared.text.includes("VERIFY CONFIG"),
    realtimeParity:realtimeChecks.length===fullChecks.length&&realtimeChecks.every((check,index)=>check.label===fullChecks[index].label&&check.pass===fullChecks[index].pass)&&clearedState.realtime.cockpit.controls.departure_cleared,
    conciseConditions:blocked.presentation.conditions.length<=24&&blocked.presentation.conditions.includes("V100")&&blocked.presentation.conditions.includes("DRY"),
    mobileFit:mobile.overflow<=0&&mobile.expanded==="true"&&mobile.hud.left>=0&&mobile.hud.right<=390&&mobile.hud.top>=0&&mobile.hud.bottom<mobile.dock.top&&mobile.groups.height<=116&&mobile.groups.scrollHeight<=116&&mobile.clip.left>=mobile.hud.right,
    mobileNoOverlayCollision:mobile.banner.display!=="none"&&mobile.alert.display!=="none"&&mobile.banner.top>=mobile.hud.bottom+8&&mobile.alert.top>=mobile.banner.bottom+8&&mobile.alert.bottom<mobile.dock.top,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,disclosed,blocked,blockedState,corrected,cleared,clearedState,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"preflight-progressive-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial,disclosed,blocked,corrected,cleared,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
