#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";
const inside=(rect,width,height)=>rect.left>=0&&rect.right<=width&&rect.top>=0&&rect.bottom<=height;

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");reset();SIM.setCam(1);camMode=1;S.paused=true;S.thrT=.68;S.thrA=.68;S.rpm=2050;setCockpitDockExpanded(true,true);SIM.stageFuelStarvation();updateCamera(.016);syncGraphics(.016);updateCockpitDock();});
  await page.waitForFunction(()=>COCKPIT_ENGINE_ASSET.status==="loaded"&&COCKPIT_SYSTEMS_ASSET.status==="loaded",null,{timeout:30000});

  const voiceStart=await page.evaluate(()=>{const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_control_lesson",arguments:JSON.stringify({action:"scenario",scenario:"fuel_starvation"}),call_id:"fuel-1"});const item=sent.find(event=>event.item?.type==="function_call_output");return{sent,output:item?JSON.parse(item.item.output):null,state:SIM.cockpitTutor(),fuel:SIM.fuel(),engine:SIM.engineManagement(),panel:{title:cockpitTutorTitle.textContent,band:cockpitTutorBand.textContent,copy:cockpitTutorCopy.textContent},realtime:aviatorFlightState().aircraft_systems.fuel};});
  await page.click("#cockpitTutorNext");await page.waitForTimeout(100);
  const selectStage=await page.evaluate(()=>{const paused=S.paused;S.paused=false;const alert=flightAlertState();S.paused=paused;return{state:SIM.cockpitTutor(),dock:SIM.cockpitDock(),shade:getComputedStyle(cockpitTutorShade).pointerEvents,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},alert};});
  await page.click('[data-cockpit-fuel="right"]');await page.waitForTimeout(120);
  const pumpStage=await page.evaluate(()=>({state:SIM.cockpitTutor(),fuel:SIM.fuel(),dock:SIM.cockpitDock(),selected:document.querySelector('[data-cockpit-fuel="right"]').classList.contains("active"),shade:getComputedStyle(cockpitTutorShade).pointerEvents}));
  await page.click("#cockpitFuelPump");await page.waitForTimeout(120);
  const pressureStage=await page.evaluate(()=>({state:SIM.cockpitTutor(),fuel:SIM.fuel(),dock:SIM.cockpitDock(),pumpPressed:cockpitFuelPump.getAttribute("aria-pressed"),shade:getComputedStyle(cockpitTutorShade).pointerEvents}));
  await page.screenshot({path:path.join(artifacts,"fuel-feed-recovery-action-desktop.png"),timeout:60000});
  await page.evaluate(()=>{SIM.warp(1.5);updateCamera(.016);syncGraphics(.016);updateCockpitDock();renderCockpitTutor();});await page.waitForTimeout(180);
  const complete=await page.evaluate(()=>({state:SIM.cockpitTutor(),fuel:SIM.fuel(),engine:SIM.engineManagement(),snap:SIM.snap(),dock:SIM.cockpitDock(),realtime:aviatorFlightState().aircraft_systems.fuel,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&["fuel_selector","fuel_pump","fuel_recovery","cockpit_scenario"].includes(event.type)).map(event=>({type:event.type,data:event.data})),facts:SIM.blackBox().facts.map(fact=>fact.text),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled}}));
  await page.screenshot({path:path.join(artifacts,"fuel-feed-recovery-complete-desktop.png"),timeout:60000});

  const guards=await page.evaluate(()=>{SIM.closeCockpitTutor("test");reset();SIM.setCam(1);const healthy=SIM.startCockpitScenario("fuel_starvation","test");SIM.setFuelTanks(0,0);S.fuel.pressurePsi=0;S.fuel.engineFeed=false;const empty=SIM.startCockpitScenario("fuel_starvation","test");reset();const saved=replaySnapshot();SIM.setFuelTanks(2,31);SIM.setFuelSelector("right");SIM.setFuelPump(true);S.fuel.pressurePsi=3.4;S.fuel.engineFeed=true;restoreReplaySnapshot(saved);return{healthy,empty,replayRestored:SIM.fuel(),savedFuel:saved.fuel};});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{reset();SIM.setCam(1);camMode=1;S.paused=true;S.thrT=.65;S.thrA=.65;S.rpm=1950;SIM.stageFuelStarvation();SIM.startCockpitScenario("fuel_starvation","test");SIM.stepCockpitTutor(1,"test");updateCamera(.016);syncGraphics(.016);updateCockpitDock();renderCockpitTutor();});await page.waitForTimeout(160);
  const mobile=await page.evaluate(()=>{const box=element=>{const rect=element.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};},panel=box(cockpitTutorPanel),dock=box(cockpitDockEl),row=box(document.querySelector('[data-dock-control="fuel"]')),buttons=[...document.querySelectorAll(".cockpit-fuel-set button")].map(button=>({label:button.textContent.trim(),...box(button)}));return{overflow:document.documentElement.scrollWidth-innerWidth,panel,dock,row,buttons,state:SIM.cockpitTutor(),shade:getComputedStyle(cockpitTutorShade).pointerEvents};});
  await page.screenshot({path:path.join(artifacts,"fuel-feed-recovery-mobile.png"),timeout:60000});
  await page.click('[data-cockpit-fuel="right"]');await page.click("#cockpitFuelPump");await page.evaluate(()=>{SIM.warp(1.5);renderCockpitTutor();updateCockpitDock();});await page.waitForTimeout(140);
  const mobileComplete=await page.evaluate(()=>({state:SIM.cockpitTutor(),fuel:SIM.fuel(),engine:SIM.engineManagement()}));

  const health=await fetch(baseUrl+"/api/realtime/health").then(response=>response.json());
  const serverSource=fs.readFileSync(path.join(project,"server/fable-flight-server.mjs"),"utf8");
  const checks={
    realtimeStartsMeasuredDrill:voiceStart.output?.ok&&voiceStart.state.scenario?.id==="fuel_starvation"&&voiceStart.state.scenario.stage==="detect"&&voiceStart.state.scenario.observed.selector==="left"&&voiceStart.state.scenario.observed.left_l===0&&voiceStart.state.scenario.observed.right_l===38&&voiceStart.state.scenario.observed.engine_feed===false&&voiceStart.sent.some(event=>event.type==="response.create"),
    lowPressureChangesEngine:voiceStart.fuel.low_pressure&&voiceStart.fuel.engine_feed===false&&voiceStart.engine.running===false&&voiceStart.engine.power_factor===0&&selectStage.alert.code.startsWith("FUEL PRESS"),
    selectorRequiresPilotAction:selectStage.state.scenario.stage==="select"&&selectStage.shade==="none"&&selectStage.next.disabled&&pumpStage.selected&&pumpStage.fuel.selector==="right"&&pumpStage.fuel.right_l===38&&pumpStage.state.scenario.stage==="pump",
    pumpRequiresPilotAction:pressureStage.pumpPressed==="true"&&pressureStage.fuel.boost_pump_selected&&pressureStage.fuel.boost_pump_effective&&pressureStage.state.scenario.stage==="pressurizing"&&pressureStage.shade==="none",
    recoveryIsTelemetryVerified:complete.state.scenario.stage==="complete"&&complete.state.scenario.verified&&complete.fuel.engine_feed&&complete.fuel.pressure_psi>=4.5&&complete.engine.running&&complete.snap.rpm>=400&&complete.dock.fuel_selector==="right"&&complete.dock.fuel_boost_pump_selected&&complete.next.text==="DONE"&&!complete.next.disabled,
    realtimeStateMatches:complete.realtime.selector===complete.fuel.selector&&complete.realtime.pressure_psi===complete.fuel.pressure_psi&&complete.realtime.engine_feed===complete.fuel.engine_feed&&complete.realtime.boost_pump_selected===complete.fuel.boost_pump_selected,
    blackBoxSupportsDebrief:complete.events.some(event=>event.type==="fuel_selector"&&event.data.selector==="right")&&complete.events.some(event=>event.type==="fuel_pump"&&event.data.selected===true)&&complete.events.some(event=>event.type==="fuel_recovery")&&complete.events.some(event=>event.type==="cockpit_scenario"&&event.data.action==="complete"&&event.data.engine_feed===true)&&complete.facts.some(text=>text.includes("Fuel-starvation drill restored engine feed")),
    healthyAndEmptyStatesRejected:guards.healthy.ok===false&&guards.healthy.error.includes("healthy fuel state")&&guards.empty.ok===false&&guards.empty.error.includes("depleted"),
    replayRestoresFuelState:guards.savedFuel.selector==="both"&&guards.replayRestored.selector==="both"&&guards.replayRestored.left_l===46&&guards.replayRestored.right_l===46&&!guards.replayRestored.boost_pump_selected&&guards.replayRestored.pressure_psi===5.2,
    mobileControlPathFits:mobile.overflow<=0&&inside(mobile.panel,390,844)&&inside(mobile.dock,390,844)&&inside(mobile.row,390,844)&&mobile.panel.bottom<=mobile.dock.top&&mobile.buttons.length===5&&mobile.buttons.every(button=>inside(button,390,844)&&button.width>=44&&button.height>=32)&&mobile.shade==="none"&&mobileComplete.state.scenario.stage==="complete"&&mobileComplete.fuel.engine_feed&&mobileComplete.engine.running,
    realtimeToolConfigured:health.model==="gpt-realtime-2"&&health.configured===true&&serverSource.includes('"fuel_starvation"')&&serverSource.includes("Never stage a healthy failure"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,voiceStart,selectStage,pumpStage,pressureStage,complete,guards,mobile,mobileComplete,health,errors};
  fs.writeFileSync(path.join(artifacts,"fuel-feed-recovery-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,voiceStart:{state:voiceStart.state,fuel:voiceStart.fuel,engine:voiceStart.engine,panel:voiceStart.panel},selectStage,pumpStage,pressureStage,complete,guards,mobile,mobileComplete,health,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
