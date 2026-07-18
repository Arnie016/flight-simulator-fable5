#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8644";

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1.5}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{
    localStorage.setItem(SYSTEMS_LAB_PROGRESS_KEY,JSON.stringify({version:1,modules:{"pitot-icing-recovery":{attempts:1,completions:1,best_recovery_s:2.4,last_recovery_s:2.4,last_completed_at:Date.now()},"alternator-bus-recovery":{attempts:1,completions:1,best_recovery_s:1.7,last_recovery_s:1.7,last_completed_at:Date.now()}}}));
    localStorage.setItem(PILOT_PROFILE_KEY,JSON.stringify({xp:2100,runs:3,deliveries:0,recoveries:0,deadSticks:0,bestSkill:0,lastScene:"frontier"}));
    if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.openMissionBoard();
  });

  await page.locator('[data-discipline="systems"]').click();
  await page.waitForFunction(()=>SIM.boardState().systemsLabId==="academy-cold-start");
  const atlasBefore=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="academy-cold-start"]'),rect=row.getBoundingClientRect(),card=document.querySelector(".destination-card").getBoundingClientRect();return{board:SIM.boardState(),row:{display:getComputedStyle(row).display,text:row.textContent.trim(),pressed:row.getAttribute("aria-pressed"),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},card:{left:card.left,right:card.right,top:card.top,bottom:card.bottom},preview:destinationLessonPreview.textContent,launch:destinationLaunch.textContent,tab:document.querySelector('[data-discipline="systems"] small').textContent,pilot:SIM.pilotProfile()};});
  await page.screenshot({path:path.join(artifacts,"cold-start-systems-lab-atlas-desktop.png")});

  await page.locator("#destinationLaunch").click();
  await page.waitForFunction(()=>SIM.cockpitTutor().scenario?.id==="cold_start",null,{timeout:15000});
  await page.waitForFunction(()=>COCKPIT_SYSTEMS_ASSET.status==="loaded"&&COCKPIT_ENGINE_ASSET.status==="loaded",null,{timeout:30000});
  const handoff=await page.evaluate(()=>({board:SIM.boardState(),scene:activeLevel.id,world:WORLD_STATE.currentId,camera:SIM.camInfo().mode,lab:SIM.systemsLabState(),ignition:SIM.ignition(),engine:SIM.engineManagement(),electrical:SIM.electrical(),tutor:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState(),events:BLACK_BOX.events.filter(event=>event.type==="systems_lab_handoff").map(event=>event.data)}));

  const point=async id=>page.evaluate(control=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const names={battery:"Battery_Rocker",ignition:"Ignition_Knob",mixture:"Mixture_Knob",throttle:"Throttle_Knob"},root=["battery","ignition"].includes(control)?cockpitSystemsConsole:cockpitEngineQuadrant,node=root.getObjectByName(names[control]),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height};},id);

  await page.click("#cockpitTutorNext");await page.waitForTimeout(100);
  const batteryStage=await page.evaluate(()=>({tutor:SIM.cockpitTutor(),lock:COCKPIT_SYSTEMS_FOCUS.locked,next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled}}));
  const batteryPoint=await point("battery");await page.mouse.click(batteryPoint.x,batteryPoint.y);await page.waitForTimeout(150);
  const mixtureStage=await page.evaluate(()=>({tutor:SIM.cockpitTutor(),lock:COCKPIT_ENGINE_FOCUS.locked,electrical:SIM.electrical()}));

  const mixturePoint=await point("mixture");await page.mouse.move(mixturePoint.x,mixturePoint.y);await page.mouse.down();await page.mouse.move(mixturePoint.x,mixturePoint.y-210,{steps:12});await page.mouse.up();await page.waitForTimeout(160);
  const throttleStage=await page.evaluate(()=>({tutor:SIM.cockpitTutor(),lock:COCKPIT_ENGINE_FOCUS.locked,mixture:Math.round(S.mixture*100),throttle:Math.round(S.thrT*100)}));

  const throttlePoint=await point("throttle");await page.mouse.move(throttlePoint.x,throttlePoint.y);await page.mouse.down();await page.mouse.move(throttlePoint.x,throttlePoint.y+150,{steps:10});await page.mouse.up();await page.waitForTimeout(160);
  const startStage=await page.evaluate(()=>({tutor:SIM.cockpitTutor(),lock:COCKPIT_SYSTEMS_FOCUS.locked,mixture:Math.round(S.mixture*100),throttle:Math.round(S.thrT*100),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},copy:cockpitTutorCopy.textContent}));
  await page.screenshot({path:path.join(artifacts,"cold-start-systems-lab-action-desktop.png")});

  const ignitionPoint=await point("ignition");await page.mouse.move(ignitionPoint.x,ignitionPoint.y);await page.mouse.down();await page.mouse.move(ignitionPoint.x+185,ignitionPoint.y,{steps:12});await page.mouse.up();await page.waitForTimeout(620);
  const complete=await page.evaluate(()=>{const module=SIM.systemsLabs().find(item=>item.id==="academy-cold-start");return{tutor:SIM.cockpitTutor(),lab:SIM.systemsLabState(),ignition:SIM.ignition(),engine:SIM.engineManagement(),progress:module.progress,pilot:SIM.pilotProfile(),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},events:BLACK_BOX.events.filter(event=>["electrical_switch","cockpit_control","ignition_switch","systems_lab_outcome"].includes(event.type)).map(event=>({type:event.type,data:event.data})),facts:SIM.blackBox().facts.map(fact=>fact.text)};});
  await page.screenshot({path:path.join(artifacts,"cold-start-systems-lab-complete-desktop.png")});

  await page.click("#cockpitTutorNext");await page.waitForTimeout(240);
  const returned=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="academy-cold-start"]'),module=SIM.systemsLabs().find(item=>item.id==="academy-cold-start");return{board:SIM.boardState(),lab:SIM.systemsLabState(),row:{text:row?.textContent.trim()||"",pressed:row?.getAttribute("aria-pressed")||"",mastered:row?.classList.contains("mastered")||false},preview:destinationLessonPreview.textContent,progress:module.progress,pilot:SIM.pilotProfile(),tab:document.querySelector('[data-discipline="systems"] small').textContent,events:BLACK_BOX.events.filter(event=>["systems_lab_handoff","systems_lab_outcome","systems_lab_return"].includes(event.type)).map(event=>({type:event.type,data:event.data}))};});
  await page.screenshot({path:path.join(artifacts,"cold-start-systems-lab-mastered-atlas-desktop.png")});

  const outcome=complete.events.find(event=>event.type==="systems_lab_outcome")?.data;
  const checks={
    academyExposesFoundationModule:atlasBefore.board.discipline==="systems"&&atlasBefore.board.selectedId==="academy"&&atlasBefore.board.systemsLabId==="academy-cold-start"&&atlasBefore.row.display==="grid"&&atlasBefore.row.text.includes("Cold-Start Sequence")&&atlasBefore.preview.includes("BAT, mixture, throttle")&&atlasBefore.launch==="START SYSTEMS LAB"&&atlasBefore.row.left>=atlasBefore.card.left&&atlasBefore.row.right<=atlasBefore.card.right,
    handoffStagesMeasuredColdCockpit:!handoff.board.visible&&handoff.scene==="circuit"&&handoff.world==="academy"&&handoff.camera==="COCKPIT"&&handoff.lab.active&&handoff.lab.id==="academy-cold-start"&&handoff.tutor.scenario.stage==="diagnose"&&!handoff.engine.running&&!handoff.electrical.masterOn&&handoff.tutor.scenario.observed.mixture_percent===5&&handoff.tutor.scenario.observed.throttle_percent===60&&handoff.ignition.selector==="off",
    realtimeReceivesExactStarterBlockers:handoff.realtime.training_lab.id==="academy-cold-start"&&handoff.realtime.screen_context.systems_lab==="academy-cold-start"&&handoff.realtime.cockpit.learning.scenario.observed.start_blockers.includes("BATTERY")&&handoff.realtime.cockpit.learning.scenario.observed.start_blockers.includes("MIXTURE")&&handoff.realtime.cockpit.learning.scenario.observed.start_blockers.includes("THROTTLE")&&handoff.events.some(event=>event.physical_control_required&&!event.engine_running&&event.ignition_selector==="off"),
    batteryRockerClearsFirstBlocker:batteryStage.tutor.scenario.stage==="battery"&&batteryStage.lock==="battery"&&batteryStage.next.disabled&&mixtureStage.electrical.masterOn&&mixtureStage.tutor.scenario.stage==="mixture"&&mixtureStage.lock==="mixture",
    engineLeversClearMeasuredLimits:throttleStage.mixture>=65&&throttleStage.tutor.scenario.stage==="throttle"&&throttleStage.lock==="throttle"&&startStage.throttle<=25&&startStage.mixture>=65&&startStage.tutor.scenario.stage==="start"&&startStage.lock==="ignition"&&startStage.next.disabled&&startStage.copy.includes("cannot crank"),
    physicalKeyStartsAndVerifies:complete.tutor.scenario.stage==="complete"&&complete.tutor.scenario.verified&&complete.ignition.selector==="both"&&complete.ignition.engine_ignited&&complete.engine.running&&complete.lab.scenario.observed.rpm>=400&&complete.lab.completed&&complete.next.text==="RETURN TO ATLAS"&&!complete.next.disabled,
    masteryAwardsRankXpOnce:complete.progress.mastered&&complete.progress.best_recovery_s>0&&complete.pilot.xp===2250&&complete.pilot.rank==="CROSSWIND PILOT"&&outcome?.xp_awarded===150&&outcome?.rank_before==="FLIGHT STUDENT"&&outcome?.rank_after==="CROSSWIND PILOT"&&outcome?.rank_up===true,
    blackBoxSupportsMeasuredDebrief:complete.events.some(event=>event.type==="electrical_switch"&&event.data.control==="battery_master"&&event.data.on===true)&&complete.events.some(event=>event.type==="cockpit_control"&&event.data.control==="mixture")&&complete.events.some(event=>event.type==="cockpit_control"&&event.data.control==="throttle")&&complete.events.some(event=>event.type==="ignition_switch"&&event.data.selector==="start"&&event.data.success===true)&&outcome?.observed.engine_running===true&&outcome?.observed.rpm>=400&&complete.facts.some(text=>text.includes("Cold-Start Sequence mastered")),
    returnRestoresAcademySyllabus:returned.board.visible&&returned.board.discipline==="systems"&&returned.board.selectedId==="academy"&&returned.board.systemsLabId==="academy-cold-start"&&!returned.lab.active&&returned.row.mastered&&returned.row.pressed==="true"&&returned.row.text.includes("BEST")&&returned.preview.includes("BAT, mixture, throttle")&&returned.tab==="3/6"&&returned.events.some(event=>event.type==="systems_lab_return"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),url:baseUrl,checks,atlasBefore,handoff,batteryStage,mixtureStage,throttleStage,startStage,complete,returned,points:{batteryPoint,mixturePoint,throttlePoint,ignitionPoint},errors};
  fs.writeFileSync(path.join(artifacts,"cold-start-systems-lab-handoff-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,atlasBefore,handoff:{board:handoff.board,scene:handoff.scene,world:handoff.world,camera:handoff.camera,lab:handoff.lab,ignition:handoff.ignition,engine:handoff.engine,electrical:handoff.electrical,tutor:handoff.tutor},batteryStage,mixtureStage,throttleStage,startStage,complete,returned,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
