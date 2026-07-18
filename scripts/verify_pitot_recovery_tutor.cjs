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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setLevel("storm");SIM.setCam(1);camMode=1;S.paused=true;S.ias=82/KT;SIM.setPitotHeat(false);SIM.setPitotIce(.38);setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>COCKPIT_INSTRUMENT_ASSET.status==="loaded"&&COCKPIT_SYSTEMS_ASSET.status==="loaded",null,{timeout:30000});
  await page.waitForTimeout(250);

  const pitotPoint=async()=>page.evaluate(()=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const node=cockpitSystemsConsole.getObjectByName("Pitot_Rocker"),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height,viewport:{width:innerWidth,height:innerHeight}};});
  const voiceStart=await page.evaluate(()=>{const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_control_lesson",arguments:JSON.stringify({action:"scenario",scenario:"pitot_icing"}),call_id:"pitot-drill-1"});const item=sent.find(event=>event.item?.type==="function_call_output");return{sent,output:item?JSON.parse(item.item.output):null,state:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState().cockpit.learning,lock:COCKPIT_INSTRUMENT_FOCUS.locked,panel:{title:cockpitTutorTitle.textContent,copy:cockpitTutorCopy.textContent,band:cockpitTutorBand.textContent}};});
  await page.screenshot({path:path.join(artifacts,"pitot-recovery-tutor-detect-desktop.png"),timeout:60000});

  await page.click("#cockpitTutorNext");await page.waitForTimeout(120);
  const action=await page.evaluate(()=>{const group=COCKPIT_SYSTEMS_GROUPS.pitot;return{state:SIM.cockpitTutor(),lock:COCKPIT_SYSTEMS_FOCUS.locked,lift:+(group.position.z-group.userData.basePosition.z).toFixed(3),shadePointer:getComputedStyle(cockpitTutorShade).pointerEvents,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},pitot:SIM.pitot(),copy:cockpitTutorCopy.textContent};});
  const desktopPoint=await pitotPoint();
  await page.screenshot({path:path.join(artifacts,"pitot-recovery-tutor-action-desktop.png"),timeout:60000});

  await page.mouse.click(desktopPoint.x,desktopPoint.y);await page.waitForTimeout(180);
  const clearing=await page.evaluate(()=>({state:SIM.cockpitTutor(),pitot:SIM.pitot(),instrumentLock:COCKPIT_INSTRUMENT_FOCUS.locked,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&["pitot_heat","cockpit_scenario"].includes(event.type)).map(event=>({type:event.type,data:event.data})),copy:cockpitTutorCopy.textContent,shadePointer:getComputedStyle(cockpitTutorShade).pointerEvents}));
  await page.screenshot({path:path.join(artifacts,"pitot-recovery-tutor-clearing-desktop.png"),timeout:60000});

  await page.evaluate(()=>SIM.warp(2.3));await page.waitForTimeout(180);
  const complete=await page.evaluate(()=>({state:SIM.cockpitTutor(),pitot:SIM.pitot(),instrumentLock:COCKPIT_INSTRUMENT_FOCUS.locked,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_scenario").map(event=>event.data),facts:SIM.blackBox().facts.map(fact=>fact.text),copy:cockpitTutorCopy.textContent}));
  await page.screenshot({path:path.join(artifacts,"pitot-recovery-tutor-complete-desktop.png"),timeout:60000});
  await page.click("#cockpitTutorNext");

  const rejected=await page.evaluate(()=>{SIM.setLevel("circuit");SIM.setPitotHeat(true);SIM.setPitotIce(0);return SIM.startCockpitScenario("pitot_icing","test");});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{SIM.setLevel("storm");SIM.setCam(1);camMode=1;SIM.setPitotHeat(false);SIM.setPitotIce(.36);SIM.startCockpitScenario("pitot_icing","test");SIM.stepCockpitTutor(1,"test");updateCamera(.016);syncGraphics(.016);renderCockpitTutor();});await page.waitForTimeout(180);
  const mobilePoint=await pitotPoint();
  const mobile=await page.evaluate(()=>{const panel=cockpitTutorPanel.getBoundingClientRect(),dock=cockpitDockEl.getBoundingClientRect(),label=cockpitTutorButtons.pitot.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.cockpitTutor(),panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom,display:getComputedStyle(cockpitTutorButtons.pitot).display,text:cockpitTutorButtons.pitot.textContent.trim()},shadePointer:getComputedStyle(cockpitTutorShade).pointerEvents};});
  await page.screenshot({path:path.join(artifacts,"pitot-recovery-tutor-mobile.png"),timeout:60000});
  await page.mouse.click(mobilePoint.x,mobilePoint.y);await page.waitForTimeout(160);
  const mobileAction=await page.evaluate(()=>({state:SIM.cockpitTutor(),pitot:SIM.pitot(),systems:SIM.cockpitSystems()}));

  const health=await fetch(baseUrl+"/api/realtime/health").then(response=>response.json());
  const serverSource=fs.readFileSync(path.join(project,"server/aviator-session.mjs"),"utf8");
  const checks={
    realtimeStartsMeasuredScenario:voiceStart.output?.ok&&voiceStart.state.mode==="scenario"&&voiceStart.state.scenario?.id==="pitot_icing"&&voiceStart.realtime.scenario?.stage==="detect"&&voiceStart.sent.some(event=>event.type==="response.create"),
    diagnosisUsesActualMismatch:voiceStart.lock==="airspeed"&&!voiceStart.state.scenario.observed.airspeed_reliable&&voiceStart.state.scenario.observed.actual_indicated_knots-voiceStart.state.scenario.observed.sensed_knots>=20&&voiceStart.panel.copy.includes("known pitch and power"),
    physicalActionIsRequired:action.state.scenario.stage==="act"&&action.lock==="pitot"&&action.lift>=.069&&action.shadePointer==="none"&&action.next.disabled&&action.next.text.includes("PHYSICAL")&&!action.pitot.heat_selected,
    physicalSwitchRemainsOperable:clearing.pitot.heat_selected&&clearing.pitot.heat_effective&&clearing.state.scenario.stage==="clearing"&&clearing.instrumentLock==="airspeed"&&clearing.events.some(event=>event.type==="pitot_heat"&&event.data.selected===true)&&clearing.events.some(event=>event.type==="cockpit_scenario"&&event.data.action==="heat_selected"),
    clearingUsesLiveTelemetry:clearing.state.scenario.observed.ice_percent===clearing.pitot.ice_percent&&clearing.state.scenario.required_action.includes("pitch and power")&&clearing.copy.includes("sensed airspeed converges"),
    completionIsMeasured:complete.state.scenario.stage==="complete"&&complete.state.scenario.verified&&complete.pitot.reliable&&complete.pitot.ice_percent<=6&&complete.instrumentLock==="airspeed"&&complete.next.text==="DONE"&&!complete.next.disabled,
    blackBoxSupportsDebrief:complete.events.some(event=>event.action==="complete"&&event.airspeed_reliable===true)&&complete.facts.some(text=>text.includes("Pitot-icing drill recovered")),
    inactiveConditionRejected:rejected.ok===false&&rejected.error.includes("requires visible moisture"),
    mobileFit:mobile.overflow<=0&&inside(mobile.panel,390,844)&&inside(mobile.label,390,844)&&mobile.panel.bottom<=mobile.label.top&&mobile.label.bottom<=mobile.dock.top&&mobile.label.display==="grid"&&mobile.label.text.includes("PITOT HEAT")&&mobile.state.scenario.stage==="act"&&mobile.shadePointer==="none"&&mobilePoint.x>=0&&mobilePoint.x<=390&&mobilePoint.y>=0&&mobilePoint.y<=844&&mobileAction.pitot.heat_effective&&mobileAction.state.scenario.stage==="clearing"&&mobileAction.state.selected_control==="airspeed",
    realtimeToolConfigured:health.model==="gpt-realtime-2"&&health.configured===true&&serverSource.includes('scenario: { type: "string"')&&serverSource.includes('pitot_icing')&&serverSource.includes("The pilot must operate the physical control"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,voiceStart,action,desktopPoint,clearing,complete,rejected,mobilePoint,mobile,mobileAction,health,errors};
  fs.writeFileSync(path.join(artifacts,"pitot-recovery-tutor-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,detect:voiceStart.state,action,clearing,complete,rejected,mobile,health,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
