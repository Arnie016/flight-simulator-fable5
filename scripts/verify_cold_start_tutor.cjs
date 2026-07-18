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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");reset();SIM.setCam(1);camMode=1;S.ignition="off";S.engineIgnited=false;S.electrical.masterOn=false;S.electrical.alternatorOn=true;S.mixture=.05;S.thrT=.6;S.thrA=0;updateElectrical(0);S.paused=true;setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>COCKPIT_SYSTEMS_ASSET.status==="loaded"&&COCKPIT_ENGINE_ASSET.status==="loaded",null,{timeout:30000});
  await page.waitForTimeout(160);

  const point=async id=>page.evaluate(control=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const names={battery:"Battery_Rocker",ignition:"Ignition_Knob",mixture:"Mixture_Knob",throttle:"Throttle_Knob"},root=["battery","ignition"].includes(control)?cockpitSystemsConsole:cockpitEngineQuadrant,node=root.getObjectByName(names[control]),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height,viewport:{width:innerWidth,height:innerHeight}};},id);
  const voiceStart=await page.evaluate(()=>{const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_control_lesson",arguments:JSON.stringify({action:"scenario",scenario:"cold_start"}),call_id:"cold-start-1"});const item=sent.find(event=>event.item?.type==="function_call_output");return{sent,output:item?JSON.parse(item.item.output):null,state:SIM.cockpitTutor(),ignition:SIM.ignition(),engine:SIM.engineManagement(),panel:{title:cockpitTutorTitle.textContent,band:cockpitTutorBand.textContent,copy:cockpitTutorCopy.textContent}};});
  await page.click("#cockpitTutorNext");await page.waitForTimeout(100);
  const batteryStage=await page.evaluate(()=>({state:SIM.cockpitTutor(),lock:COCKPIT_SYSTEMS_FOCUS.locked,shade:getComputedStyle(cockpitTutorShade).pointerEvents,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled}}));
  const batteryPoint=await point("battery");await page.mouse.click(batteryPoint.x,batteryPoint.y);await page.waitForTimeout(150);
  const mixtureStage=await page.evaluate(()=>({state:SIM.cockpitTutor(),lock:COCKPIT_ENGINE_FOCUS.locked,electrical:SIM.electrical(),copy:cockpitTutorCopy.textContent}));

  const mixturePoint=await point("mixture");await page.mouse.move(mixturePoint.x,mixturePoint.y);await page.mouse.down();await page.mouse.move(mixturePoint.x,mixturePoint.y-210,{steps:12});await page.mouse.up();await page.waitForTimeout(160);
  const throttleStage=await page.evaluate(()=>({state:SIM.cockpitTutor(),lock:COCKPIT_ENGINE_FOCUS.locked,engine:SIM.engineManagement(),throttle:Math.round(S.thrT*100),mixture:Math.round(S.mixture*100),copy:cockpitTutorCopy.textContent}));

  const throttlePoint=await point("throttle");await page.mouse.move(throttlePoint.x,throttlePoint.y);await page.mouse.down();await page.mouse.move(throttlePoint.x,throttlePoint.y+150,{steps:10});await page.mouse.up();await page.waitForTimeout(160);
  const startStage=await page.evaluate(()=>({state:SIM.cockpitTutor(),lock:COCKPIT_SYSTEMS_FOCUS.locked,ignition:SIM.ignition(),engine:SIM.engineManagement(),throttle:Math.round(S.thrT*100),mixture:Math.round(S.mixture*100),shade:getComputedStyle(cockpitTutorShade).pointerEvents,copy:cockpitTutorCopy.textContent}));
  await page.screenshot({path:path.join(artifacts,"cold-start-tutor-action-desktop.png"),timeout:60000});

  const ignitionPoint=await point("ignition");await page.mouse.move(ignitionPoint.x,ignitionPoint.y);await page.mouse.down();await page.mouse.move(ignitionPoint.x+185,ignitionPoint.y,{steps:12});await page.mouse.up();await page.waitForTimeout(520);
  const complete=await page.evaluate(()=>({state:SIM.cockpitTutor(),ignition:SIM.ignition(),engine:SIM.engineManagement(),snap:SIM.snap(),lock:COCKPIT_SYSTEMS_FOCUS.locked,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&["cockpit_scenario","cockpit_control","electrical_switch","ignition_switch"].includes(event.type)).map(event=>({type:event.type,data:event.data})),facts:SIM.blackBox().facts.map(fact=>fact.text),copy:cockpitTutorCopy.textContent}));
  await page.screenshot({path:path.join(artifacts,"cold-start-tutor-complete-desktop.png"),timeout:60000});

  const rejectedRunning=await page.evaluate(()=>{SIM.closeCockpitTutor("test");return SIM.startCockpitScenario("cold_start","test");});
  const rejectedFault=await page.evaluate(()=>{S.ignition="off";S.engineIgnited=false;SIM.failEngine(true);return SIM.startCockpitScenario("cold_start","test");});
  const rejectedDead=await page.evaluate(()=>{SIM.failEngine(false);SIM.setBatteryCharge(.05);return SIM.startCockpitScenario("cold_start","test");});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{reset();SIM.setCam(1);camMode=1;S.ignition="off";S.engineIgnited=false;S.electrical.masterOn=true;S.mixture=1;S.thrT=0;updateElectrical(0);S.paused=true;SIM.startCockpitScenario("cold_start","test");SIM.stepCockpitTutor(1,"test");updateCamera(.016);syncGraphics(.016);renderCockpitTutor();});await page.waitForTimeout(180);
  const mobilePoint=await point("ignition");
  const mobile=await page.evaluate(()=>{const panel=cockpitTutorPanel.getBoundingClientRect(),dock=cockpitDockEl.getBoundingClientRect(),label=cockpitTutorButtons.ignition.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.cockpitTutor(),panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},label:{left:label.left,right:label.right,top:label.top,bottom:label.bottom,display:getComputedStyle(cockpitTutorButtons.ignition).display,text:cockpitTutorButtons.ignition.textContent.trim()},shade:getComputedStyle(cockpitTutorShade).pointerEvents};});
  await page.screenshot({path:path.join(artifacts,"cold-start-tutor-mobile.png"),timeout:60000});
  await page.mouse.move(mobilePoint.x,mobilePoint.y);await page.mouse.down();await page.mouse.move(mobilePoint.x+125,mobilePoint.y,{steps:10});await page.mouse.up();await page.waitForTimeout(520);
  const mobileComplete=await page.evaluate(()=>({state:SIM.cockpitTutor(),ignition:SIM.ignition(),engine:SIM.engineManagement(),systems:SIM.cockpitSystems()}));

  const health=await fetch(baseUrl+"/api/realtime/health").then(response=>response.json());
  const serverSource=fs.readFileSync(path.join(project,"server/fable-flight-server.mjs"),"utf8");
  const checks={
    realtimeStartsGroundedLesson:voiceStart.output?.ok&&voiceStart.state.scenario?.id==="cold_start"&&voiceStart.state.scenario.stage==="diagnose"&&voiceStart.state.scenario.observed.start_blockers.includes("BATTERY")&&voiceStart.state.scenario.observed.start_blockers.includes("MIXTURE")&&voiceStart.state.scenario.observed.start_blockers.includes("THROTTLE")&&voiceStart.sent.some(event=>event.type==="response.create"),
    batteryIsPhysical:batteryStage.state.scenario.stage==="battery"&&batteryStage.lock==="battery"&&batteryStage.shade==="none"&&batteryStage.next.disabled&&mixtureStage.electrical.masterOn&&mixtureStage.state.scenario.stage==="mixture"&&mixtureStage.lock==="mixture",
    mixtureThresholdIsMeasured:throttleStage.mixture>=65&&throttleStage.state.scenario.stage==="throttle"&&throttleStage.lock==="throttle"&&throttleStage.copy.includes("25 percent"),
    throttleThresholdIsMeasured:startStage.throttle<=25&&startStage.mixture>=65&&startStage.state.scenario.stage==="start"&&startStage.lock==="ignition"&&startStage.shade==="none"&&startStage.copy.includes("cannot crank"),
    physicalStartCompletes:complete.state.scenario.stage==="complete"&&complete.state.scenario.verified&&complete.ignition.selector==="both"&&complete.ignition.engine_ignited&&complete.engine.running&&complete.snap.rpm>=400&&complete.lock==="ignition"&&complete.next.text==="DONE"&&!complete.next.disabled,
    blackBoxSupportsDebrief:complete.events.some(event=>event.type==="electrical_switch"&&event.data.control==="battery_master"&&event.data.on===true)&&complete.events.some(event=>event.type==="cockpit_control"&&event.data.control==="mixture")&&complete.events.some(event=>event.type==="cockpit_control"&&event.data.control==="throttle")&&complete.events.some(event=>event.type==="ignition_switch"&&event.data.selector==="start"&&event.data.success===true)&&complete.events.some(event=>event.type==="cockpit_scenario"&&event.data.action==="complete"&&event.data.engine_running===true)&&complete.facts.some(text=>text.includes("Cold-start drill verified engine running")),
    impossibleStatesRejected:rejectedRunning.ok===false&&rejectedRunning.error.includes("already running")&&rejectedFault.ok===false&&rejectedFault.error.includes("hardware fault")&&rejectedDead.ok===false&&rejectedDead.error.includes("depleted"),
    mobilePhysicalStartWorks:mobile.overflow<=0&&inside(mobile.panel,390,844)&&inside(mobile.label,390,844)&&mobile.panel.bottom<=mobile.label.top&&mobile.label.bottom<=mobile.dock.top&&mobile.label.display==="grid"&&mobile.label.text.includes("MAGNETO")&&mobile.state.scenario.stage==="start"&&mobile.shade==="none"&&mobilePoint.x>=0&&mobilePoint.x<=390&&mobilePoint.y>=0&&mobilePoint.y<=844&&mobileComplete.state.scenario.stage==="complete"&&mobileComplete.ignition.selector==="both"&&mobileComplete.engine.running,
    realtimeToolConfigured:health.model==="gpt-realtime-2"&&health.configured===true&&serverSource.includes('"cold_start"')&&serverSource.includes("never claim start succeeded"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,voiceStart,batteryStage,batteryPoint,mixtureStage,mixturePoint,throttleStage,throttlePoint,startStage,ignitionPoint,complete,rejectedRunning,rejectedFault,rejectedDead,mobilePoint,mobile,mobileComplete,health,errors};
  fs.writeFileSync(path.join(artifacts,"cold-start-tutor-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,voiceStart:{state:voiceStart.state,panel:voiceStart.panel},batteryStage,mixtureStage,throttleStage,startStage,complete,rejectedRunning,rejectedFault,rejectedDead,mobile,mobileComplete,health,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
