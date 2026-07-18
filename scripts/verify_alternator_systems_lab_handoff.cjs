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
    localStorage.setItem(SYSTEMS_LAB_PROGRESS_KEY,JSON.stringify({version:1,modules:{"pitot-icing-recovery":{attempts:1,completions:1,best_recovery_s:2.4,last_recovery_s:2.4,last_completed_at:Date.now()}}}));
    localStorage.setItem(PILOT_PROFILE_KEY,JSON.stringify({xp:2100,runs:3,deliveries:0,recoveries:0,deadSticks:0,bestSkill:0,lastScene:"storm"}));
    if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.openMissionBoard();
  });

  await page.locator('[data-discipline="systems"]').click();
  await page.waitForFunction(()=>SIM.boardState().systemsLabId==="alternator-bus-recovery");
  const atlasBefore=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="alternator-bus-recovery"]'),rect=row.getBoundingClientRect(),card=document.querySelector(".destination-card").getBoundingClientRect();return{board:SIM.boardState(),row:{display:getComputedStyle(row).display,text:row.textContent.trim(),pressed:row.getAttribute("aria-pressed"),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},card:{left:card.left,right:card.right,top:card.top,bottom:card.bottom},preview:destinationLessonPreview.textContent,launch:destinationLaunch.textContent,tab:document.querySelector('[data-discipline="systems"] small').textContent,pilot:SIM.pilotProfile()};});
  await page.screenshot({path:path.join(artifacts,"alternator-systems-lab-atlas-desktop.png")});

  await page.locator("#destinationLaunch").click();
  await page.waitForFunction(()=>SIM.cockpitTutor().scenario?.id==="alternator_bus",null,{timeout:15000});
  await page.waitForFunction(()=>COCKPIT_SYSTEMS_ASSET.status==="loaded",null,{timeout:30000});
  const handoff=await page.evaluate(()=>({board:SIM.boardState(),scene:activeLevel.id,world:WORLD_STATE.currentId,camera:SIM.camInfo().mode,lab:SIM.systemsLabState(),electrical:SIM.electrical(),tutor:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState(),events:BLACK_BOX.events.filter(event=>event.type==="systems_lab_handoff").map(event=>event.data)}));

  await page.click("#cockpitTutorNext");await page.waitForTimeout(120);
  const action=await page.evaluate(()=>({lab:SIM.systemsLabState(),electrical:SIM.electrical(),tutor:SIM.cockpitTutor(),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},physicalLock:COCKPIT_SYSTEMS_FOCUS.locked,copy:cockpitTutorCopy.textContent}));
  const alternatorPoint=await page.evaluate(()=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const node=cockpitSystemsConsole.getObjectByName("Alternator_Rocker"),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height};});
  await page.screenshot({path:path.join(artifacts,"alternator-systems-lab-action-desktop.png")});

  await page.mouse.click(alternatorPoint.x,alternatorPoint.y);await page.waitForTimeout(260);
  const complete=await page.evaluate(()=>{const lab=SIM.systemsLabs().find(module=>module.id==="alternator-bus-recovery");return{electrical:SIM.electrical(),tutor:SIM.cockpitTutor(),lab:SIM.systemsLabState(),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},progress:lab.progress,pilot:SIM.pilotProfile(),events:BLACK_BOX.events.filter(event=>event.type==="systems_lab_outcome").map(event=>event.data),facts:SIM.blackBox().facts.map(fact=>fact.text)};});
  await page.screenshot({path:path.join(artifacts,"alternator-systems-lab-recovery-complete-desktop.png")});

  await page.click("#cockpitTutorNext");await page.waitForTimeout(220);
  const returned=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="alternator-bus-recovery"]'),lab=SIM.systemsLabs().find(module=>module.id==="alternator-bus-recovery");return{board:SIM.boardState(),lab:SIM.systemsLabState(),row:{text:row?.textContent.trim()||"",pressed:row?.getAttribute("aria-pressed")||"",mastered:row?.classList.contains("mastered")||false},preview:destinationLessonPreview.textContent,progress:lab.progress,pilot:SIM.pilotProfile(),events:BLACK_BOX.events.filter(event=>["systems_lab_handoff","systems_lab_outcome","systems_lab_return"].includes(event.type)).map(event=>({type:event.type,data:event.data}))};});
  await page.screenshot({path:path.join(artifacts,"alternator-systems-lab-mastered-atlas-desktop.png")});

  const checks={
    atlasExposesSecondSystemsModule:atlasBefore.board.discipline==="systems"&&atlasBefore.board.selectedId==="frontierField"&&atlasBefore.board.systemsLabId==="alternator-bus-recovery"&&atlasBefore.row.display==="grid"&&atlasBefore.row.text.includes("Alternator-Bus Recovery")&&atlasBefore.preview.includes("physical ALT rocker")&&atlasBefore.launch==="START SYSTEMS LAB"&&atlasBefore.row.left>=atlasBefore.card.left&&atlasBefore.row.right<=atlasBefore.card.right,
    handoffStagesMeasuredBatteryBus:!handoff.board.visible&&handoff.scene==="frontier"&&handoff.world==="frontierField"&&handoff.camera==="COCKPIT"&&handoff.lab.active&&handoff.lab.id==="alternator-bus-recovery"&&handoff.tutor.scenario.stage==="detect"&&handoff.electrical.source==="BATT"&&handoff.electrical.volts===12.8&&handoff.electrical.alternatorOn===false&&handoff.electrical.alternatorFault===false,
    physicalControlNotPreselected:handoff.events.some(event=>event.physical_control_required&&event.electrical_source==="BATT"&&event.alternator_switch_on===false&&event.volts===12.8),
    realtimeReceivesExactLabState:handoff.realtime.training_lab.id==="alternator-bus-recovery"&&handoff.realtime.training_lab.scenario.stage==="detect"&&handoff.realtime.screen_context.systems_lab==="alternator-bus-recovery"&&handoff.realtime.cockpit.learning.scenario.observed.electrical_source==="BATT"&&handoff.realtime.cockpit.learning.scenario.observed.volts===12.8,
    actionRequiresPhysicalRocker:action.tutor.scenario.stage==="act"&&action.next.disabled&&action.next.text.includes("PHYSICAL")&&action.physicalLock==="alternator"&&!action.electrical.alternatorOn&&action.copy.includes("physical ALT rocker"),
    rockerRestoresMeasuredCharging:complete.tutor.scenario.verified&&complete.electrical.source==="ALT"&&complete.electrical.volts===14.2&&complete.electrical.alternatorOn&&complete.lab.completed&&complete.next.text==="RETURN TO ATLAS"&&!complete.next.disabled,
    masteryAwardsRankXpOnce:complete.progress.mastered&&complete.progress.best_recovery_s>0&&complete.pilot.xp===2270&&complete.pilot.rank==="CROSSWIND PILOT"&&complete.events.some(event=>event.mastered&&event.xp_awarded===170&&event.rank_before==="FLIGHT STUDENT"&&event.rank_after==="CROSSWIND PILOT"&&event.rank_up===true),
    blackBoxSupportsMeasuredDebrief:complete.events.some(event=>event.observed.electrical_source==="ALT"&&event.observed.volts===14.2)&&complete.facts.some(text=>text.includes("Alternator-Bus Recovery mastered")),
    returnRestoresFrontierSyllabus:returned.board.visible&&returned.board.discipline==="systems"&&returned.board.selectedId==="frontierField"&&returned.board.systemsLabId==="alternator-bus-recovery"&&!returned.lab.active&&returned.row.mastered&&returned.row.pressed==="true"&&returned.row.text.includes("BEST")&&returned.preview.includes("physical ALT rocker")&&returned.events.some(event=>event.type==="systems_lab_return"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),url:baseUrl,checks,atlasBefore,handoff,action,alternatorPoint,complete,returned,errors};
  fs.writeFileSync(path.join(artifacts,"alternator-systems-lab-handoff-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,atlasBefore,handoff:{board:handoff.board,scene:handoff.scene,world:handoff.world,camera:handoff.camera,lab:handoff.lab,electrical:handoff.electrical,tutor:handoff.tutor},action,complete,returned,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
