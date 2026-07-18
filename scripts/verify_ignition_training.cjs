#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";
async function openAccessibleDock(page){await page.evaluate(()=>{setCockpitDockExpanded(true,true);updateCockpitDock();});await page.waitForFunction(()=>{const button=document.querySelector('[data-cockpit-ignition="off"]');return button&&getComputedStyle(button).visibility!=="hidden"&&button.getBoundingClientRect().height>0;});}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");reset();SIM.setCam(1);updateCamera(.016);updateCockpitDock();});
  await page.waitForFunction(()=>getComputedStyle(cockpitDockEl).display==="block");
  await openAccessibleDock(page);

  const initial=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),preflight:SIM.preflightPresentation(),engine:SIM.engineManagement(),active:[...document.querySelectorAll("[data-cockpit-ignition].active")].map(button=>button.dataset.cockpitIgnition)}));

  await page.click('[data-cockpit-ignition="off"]');
  await page.evaluate(()=>SIM.warp(2.4));
  const off=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),snap:SIM.snap(),preflight:SIM.preflight(),presentation:SIM.preflightPresentation(),alert:SIM.alerts(),cue:SIM.cue(),realtime:SIM.realtimeFlightState().aircraft_systems.ignition,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="ignition_switch")}));

  await page.click('[data-cockpit-ignition="both"]');
  const bothStopped=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),alert:SIM.alerts(),cue:SIM.cue()}));
  await page.click("#cockpitBattery");
  await page.click('[data-cockpit-ignition="start"]');
  await page.waitForTimeout(430);
  const blocked=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),preflight:SIM.preflight(),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="ignition_switch").map(event=>event.data),facts:SIM.realtimeFlightState().black_box.recent_facts}));

  await page.click("#cockpitBattery");
  await page.click('[data-cockpit-ignition="start"]');
  await page.waitForTimeout(430);
  await page.evaluate(()=>{SIM.warp(2.4);SIM.set({throttle:.72});SIM.warp(4);});
  const bothRunning=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),snap:SIM.snap(),preflight:SIM.preflight(),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="ignition_switch").map(event=>event.data)}));

  await page.click('[data-cockpit-ignition="left"]');
  await page.evaluate(()=>SIM.warp(4));
  const single=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),snap:SIM.snap(),preflight:SIM.preflight(),alert:SIM.alerts(),realtime:SIM.realtimeFlightState(),replay:[...new Set(REPLAY.history.map(frame=>frame.ignition))],engineStates:[...new Set(REPLAY.history.map(frame=>frame.engineIgnited))]}));
  await page.hover('.cockpit-dock-row:has([data-cockpit-ignition])');
  const hover=await page.evaluate(()=>cockpitDockStatus.textContent);
  await page.mouse.move(700,400);
  await page.click('[data-cockpit-ignition="both"]');
  await page.evaluate(()=>{SIM.clear();SIM.warp(.3);updateCockpitDock();});
  const history=await page.evaluate(()=>({events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="ignition_switch").map(event=>event.data),facts:blackBoxSnapshot().facts}));
  await page.evaluate(()=>{reset();SIM.setCam(1);updateCamera(.016);updateCockpitDock();updateMissionHud();});
  await openAccessibleDock(page);
  await page.click('[data-cockpit-ignition="left"]');
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(artifacts,"ignition-training-desktop.png")});
  await page.click('[data-cockpit-ignition="both"]');
  const restored=await page.evaluate(()=>({ignition:SIM.ignition(),dock:SIM.cockpitDock(),preflight:SIM.preflight(),presentation:SIM.preflightPresentation(),alert:SIM.alerts()}));

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{updateCamera(.016);updateCockpitDock();updateMissionHud();});
  await openAccessibleDock(page);
  await page.waitForTimeout(160);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),hud=missionHud.getBoundingClientRect(),cueBox=cue.getBoundingClientRect(),row=document.querySelector('.cockpit-dock-row:has([data-cockpit-ignition])').getBoundingClientRect(),buttons=[...document.querySelectorAll("[data-cockpit-ignition]")].map(button=>{const box=button.getBoundingClientRect();return{position:button.dataset.cockpitIgnition,left:box.left,right:box.right,top:box.top,bottom:box.bottom};});return{overflow:document.documentElement.scrollWidth-innerWidth,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,height:dock.height},hud:{top:hud.top,bottom:hud.bottom},cue:{display:getComputedStyle(cue).display,left:cueBox.left,right:cueBox.right,top:cueBox.top,bottom:cueBox.bottom},row:{left:row.left,right:row.right,top:row.top,bottom:row.bottom},buttons,active:document.querySelector("[data-cockpit-ignition].active")?.dataset.cockpitIgnition};});
  await page.screenshot({path:path.join(artifacts,"ignition-training-mobile.png")});

  const engineCheck=state=>state.preflight.checks.find(check=>check.id==="engine");
  const checks={
    defaultIsRegressionSafe:initial.ignition.selector==="both"&&initial.ignition.engine_ignited&&initial.dock.engine_running&&initial.active.length===1&&initial.active[0]==="both"&&initial.preflight.required_total===8&&initial.preflight.required_ready===8,
    offStopsEngine:off.ignition.selector==="off"&&!off.ignition.engine_ignited&&!off.dock.engine_running&&!off.snap.engineRunning&&off.snap.rpm<450&&engineCheck(off)?.pass===false,
    offGuidance:off.alert.code==="IGNITION OFF"&&off.alert.action.includes("START")&&off.cue.text.includes("select both")&&off.realtime.selector==="off"&&!off.realtime.engine_running,
    bothDoesNotFakeRestart:bothStopped.ignition.selector==="both"&&!bothStopped.ignition.engine_ignited&&!bothStopped.dock.engine_running&&bothStopped.alert.code==="ENGINE STOPPED"&&bothStopped.cue.text.includes("select start"),
    starterPrerequisites:blockingEvent(blocked.events)?.success===false&&blockingEvent(blocked.events)?.blockers.includes("BATTERY")&&!blocked.dock.engine_running&&blocked.preflight.checks.some(check=>check.id==="battery"&&!check.pass),
    successfulRestart:bothRunning.ignition.selector==="both"&&bothRunning.ignition.engine_ignited&&bothRunning.dock.engine_running&&bothRunning.snap.rpm>1700&&bothRunning.events.some(event=>event.selector==="start"&&event.success===true),
    singleMagnetoIsMeasured:single.ignition.selector==="left"&&single.ignition.single_magneto&&single.dock.engine_running&&single.snap.rpm<bothRunning.snap.rpm-25&&single.dock.mixture_power_factor<bothRunning.dock.mixture_power_factor&&engineCheck(single)?.pass===false&&single.alert.code==="SINGLE MAGNETO",
    realtimeGrounded:single.realtime.aircraft_systems.ignition.selector==="left"&&single.realtime.aircraft_systems.ignition.single_magneto&&single.realtime.cockpit.controls.ignition_selector==="left"&&single.realtime.cockpit.controls.engine_running,
    replayAndBlackBox:single.replay.includes("off")&&single.replay.includes("both")&&single.replay.includes("left")&&single.engineStates.includes(false)&&single.engineStates.includes(true)&&history.events.length>=6&&history.facts.some(fact=>fact.type==="ignition_switch"),
    restoredForDeparture:restored.ignition.selector==="both"&&restored.dock.engine_running&&engineCheck(restored)?.pass&&restored.presentation.required_total===8&&restored.presentation.required_ready===8&&!restored.alert.active,
    hoverInstruction:(hover.includes("RPM")&&hover.includes("ONE MAG"))||(hover.includes("LEFT MAG")&&hover.includes("ENGINE RUNNING")),
    mobileFit:mobile.overflow<=0&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.hud.bottom<mobile.dock.top&&mobile.cue.bottom<=mobile.dock.top&&mobile.row.left>=mobile.dock.left&&mobile.row.right<=mobile.dock.right&&mobile.buttons.every(button=>button.left>=mobile.row.left&&button.right<=mobile.row.right)&&mobile.active==="both",
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,off,bothStopped,blocked,bothRunning,single,hover,history,restored,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"ignition-training-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial,off:{ignition:off.ignition,dock:off.dock,snap:off.snap,alert:off.alert,cue:off.cue},blocked,bothRunning:{ignition:bothRunning.ignition,dock:bothRunning.dock,snap:bothRunning.snap},single:{ignition:single.ignition,dock:single.dock,snap:single.snap,alert:single.alert,replay:single.replay,engineStates:single.engineStates},restored,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

function blockingEvent(events){return [...events].reverse().find(event=>event.selector==="start"&&event.success===false);}
main().catch(error=>{console.error(error);process.exitCode=1;});
