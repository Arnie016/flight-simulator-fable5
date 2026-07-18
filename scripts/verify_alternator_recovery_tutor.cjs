#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8644";
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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");reset();SIM.setCam(1);camMode=1;SIM.setBatteryMaster(true);SIM.failAlternator(false);SIM.setBatteryCharge(.4);SIM.setAlternatorSwitch(false);S.paused=true;setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>COCKPIT_SYSTEMS_ASSET.status==="loaded",null,{timeout:30000});
  await page.waitForTimeout(180);

  const alternatorPoint=async()=>page.evaluate(()=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const node=cockpitSystemsConsole.getObjectByName("Alternator_Rocker"),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height,viewport:{width:innerWidth,height:innerHeight}};});
  const voiceStart=await page.evaluate(()=>{const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_control_lesson",arguments:JSON.stringify({action:"scenario",scenario:"alternator_bus"}),call_id:"alternator-drill-1"});const item=sent.find(event=>event.item?.type==="function_call_output");return{sent,output:item?JSON.parse(item.item.output):null,state:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState(),systems:SIM.electrical(),lock:COCKPIT_SYSTEMS_FOCUS.locked,panel:{title:cockpitTutorTitle.textContent,copy:cockpitTutorCopy.textContent,band:cockpitTutorBand.textContent}};});
  await page.click("#cockpitTutorNext");await page.waitForTimeout(100);
  const action=await page.evaluate(()=>{const group=COCKPIT_SYSTEMS_GROUPS.alternator;return{state:SIM.cockpitTutor(),lock:COCKPIT_SYSTEMS_FOCUS.locked,lift:+(group.position.z-group.userData.basePosition.z).toFixed(3),shadePointer:getComputedStyle(cockpitTutorShade).pointerEvents,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},electrical:SIM.electrical(),copy:cockpitTutorCopy.textContent};});
  const desktopPoint=await alternatorPoint();
  await page.screenshot({path:path.join(artifacts,"alternator-recovery-tutor-action-desktop.png"),timeout:60000});

  await page.mouse.click(desktopPoint.x,desktopPoint.y);await page.waitForTimeout(220);
  const complete=await page.evaluate(()=>({state:SIM.cockpitTutor(),electrical:SIM.electrical(),lock:COCKPIT_SYSTEMS_FOCUS.locked,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&["electrical_switch","cockpit_scenario"].includes(event.type)).map(event=>({type:event.type,data:event.data})),facts:SIM.blackBox().facts.map(fact=>fact.text),copy:cockpitTutorCopy.textContent}));
  await page.screenshot({path:path.join(artifacts,"alternator-recovery-tutor-complete-desktop.png"),timeout:60000});

  const rejectedFault=await page.evaluate(()=>{SIM.closeCockpitTutor("test");SIM.setAlternatorSwitch(false);SIM.failAlternator(true);updateElectrical(0);return SIM.startCockpitScenario("alternator_bus","test");});
  const rejectedHealthy=await page.evaluate(()=>{SIM.failAlternator(false);SIM.setAlternatorSwitch(true);updateElectrical(0);return SIM.startCockpitScenario("alternator_bus","test");});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{reset();SIM.setCam(1);camMode=1;SIM.setBatteryMaster(true);SIM.failAlternator(false);SIM.setBatteryCharge(.4);SIM.setAlternatorSwitch(false);S.paused=true;SIM.startCockpitScenario("alternator_bus","test");SIM.stepCockpitTutor(1,"test");updateCamera(.016);syncGraphics(.016);renderCockpitTutor();});await page.waitForTimeout(180);
  const mobilePoint=await alternatorPoint();
  const mobile=await page.evaluate(()=>{const panel=cockpitTutorPanel.getBoundingClientRect(),dock=cockpitDockEl.getBoundingClientRect(),label=cockpitTutorButtons.alternator.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.cockpitTutor(),panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom,display:getComputedStyle(cockpitTutorButtons.alternator).display,text:cockpitTutorButtons.alternator.textContent.trim()},shadePointer:getComputedStyle(cockpitTutorShade).pointerEvents};});
  await page.screenshot({path:path.join(artifacts,"alternator-recovery-tutor-mobile.png"),timeout:60000});
  await page.mouse.click(mobilePoint.x,mobilePoint.y);await page.waitForTimeout(220);
  const mobileAction=await page.evaluate(()=>({state:SIM.cockpitTutor(),electrical:SIM.electrical(),systems:SIM.cockpitSystems()}));

  const health=await fetch(baseUrl+"/api/realtime/health").then(response=>response.json());
  const serverSource=fs.readFileSync(path.join(project,"server/aviator-session.mjs"),"utf8");
  const checks={
    realtimeStartsMeasuredScenario:voiceStart.output?.ok&&voiceStart.state.mode==="scenario"&&voiceStart.state.scenario?.id==="alternator_bus"&&voiceStart.state.scenario.stage==="detect"&&voiceStart.state.scenario.observed.electrical_source==="BATT"&&voiceStart.sent.some(event=>event.type==="response.create"),
    diagnosisUsesLiveBus:voiceStart.lock==="alternator"&&voiceStart.systems.source==="BATT"&&voiceStart.systems.volts<12&&voiceStart.panel.copy.includes("bus is on the battery")&&voiceStart.panel.band.includes("BATTERY DISCHARGING"),
    physicalActionIsRequired:action.state.scenario.stage==="act"&&action.lock==="alternator"&&action.lift>=.069&&action.shadePointer==="none"&&action.next.disabled&&action.next.text.includes("PHYSICAL")&&!action.electrical.alternatorOn,
    completionIsMeasured:complete.state.scenario.stage==="complete"&&complete.state.scenario.verified&&complete.electrical.source==="ALT"&&complete.electrical.volts>=13.5&&complete.lock==="alternator"&&complete.next.text==="DONE"&&!complete.next.disabled,
    physicalSwitchRecorded:complete.events.some(event=>event.type==="electrical_switch"&&event.data.control==="alternator_switch"&&event.data.on===true)&&complete.events.some(event=>event.type==="cockpit_scenario"&&event.data.action==="alternator_selected"&&event.data.electrical_source==="ALT"),
    blackBoxSupportsDebrief:complete.events.some(event=>event.type==="cockpit_scenario"&&event.data.action==="complete"&&event.data.volts>=13.5)&&complete.facts.some(text=>text.includes("Alternator-bus drill restored ALT source")),
    hardwareFaultRejectedTruthfully:rejectedFault.ok===false&&rejectedFault.error.includes("hardware fault")&&rejectedFault.error.includes("cannot restore")&&rejectedFault.observed.alternator_fault===true,
    healthyBusRejected:rejectedHealthy.ok===false&&rejectedHealthy.error.includes("already carrying the bus")&&rejectedHealthy.observed.electrical_source==="ALT",
    mobilePhysicalActionWorks:mobile.overflow<=0&&inside(mobile.panel,390,844)&&inside(mobile.label,390,844)&&mobile.panel.bottom<=mobile.label.top&&mobile.label.bottom<=mobile.dock.top&&mobile.label.display==="grid"&&mobile.label.text.includes("ALTERNATOR")&&mobile.state.scenario.stage==="act"&&mobile.shadePointer==="none"&&mobilePoint.x>=0&&mobilePoint.x<=390&&mobilePoint.y>=0&&mobilePoint.y<=844&&mobileAction.electrical.source==="ALT"&&mobileAction.state.scenario.stage==="complete",
    realtimeToolConfigured:health.model==="gpt-realtime-2"&&health.configured===true&&serverSource.includes('"alternator_bus"')&&serverSource.includes("The pilot must operate the physical control; never stage or claim recovery early"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,voiceStart,action,desktopPoint,complete,rejectedFault,rejectedHealthy,mobilePoint,mobile,mobileAction,health,errors};
  fs.writeFileSync(path.join(artifacts,"alternator-recovery-tutor-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,voiceStart:{state:voiceStart.state,systems:voiceStart.systems,panel:voiceStart.panel},action,complete,rejectedFault,rejectedHealthy,mobile,mobileAction,health,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
