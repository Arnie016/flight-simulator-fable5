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
  await page.evaluate(()=>{localStorage.removeItem("ff_systems_lab_progress_v1");if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.openMissionBoard();});

  await page.locator('[data-discipline="systems"]').click();
  const atlasBefore=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="pitot-icing-recovery"]'),rect=row.getBoundingClientRect(),card=document.querySelector(".destination-card").getBoundingClientRect();return{board:SIM.boardState(),row:{display:getComputedStyle(row).display,text:row.textContent.trim(),pressed:row.getAttribute("aria-pressed"),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},card:{left:card.left,right:card.right,top:card.top,bottom:card.bottom},preview:destinationLessonPreview.textContent,launch:destinationLaunch.textContent,tab:document.querySelector('[data-discipline="systems"] small').textContent};});
  await page.screenshot({path:path.join(artifacts,"systems-lab-atlas-desktop.png")});

  await page.locator("#destinationLaunch").click();
  await page.waitForFunction(()=>SIM.cockpitTutor().scenario?.id==="pitot_icing",null,{timeout:15000});
  await page.waitForFunction(()=>COCKPIT_INSTRUMENT_ASSET.status==="loaded"&&COCKPIT_SYSTEMS_ASSET.status==="loaded",null,{timeout:30000});
  const handoff=await page.evaluate(()=>({board:SIM.boardState(),scene:activeLevel.id,world:WORLD_STATE.currentId,camera:SIM.camInfo().mode,lab:SIM.systemsLabState(),pitot:SIM.pitot(),tutor:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState(),events:BLACK_BOX.events.filter(event=>event.type==="systems_lab_handoff").map(event=>event.data)}));

  await page.click("#cockpitTutorNext");
  const action=await page.evaluate(()=>({lab:SIM.systemsLabState(),pitot:SIM.pitot(),tutor:SIM.cockpitTutor(),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},physicalLock:COCKPIT_SYSTEMS_FOCUS.locked}));
  const pitotPoint=await page.evaluate(()=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const node=cockpitSystemsConsole.getObjectByName("Pitot_Rocker"),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height};});
  await page.mouse.click(pitotPoint.x,pitotPoint.y);await page.waitForTimeout(180);
  const clearing=await page.evaluate(()=>({pitot:SIM.pitot(),tutor:SIM.cockpitTutor(),lab:SIM.systemsLabState(),events:BLACK_BOX.events.filter(event=>["pitot_heat","cockpit_scenario"].includes(event.type)).map(event=>({type:event.type,data:event.data}))}));
  await page.evaluate(()=>SIM.warp(2.5));await page.waitForTimeout(180);
  const complete=await page.evaluate(()=>({pitot:SIM.pitot(),tutor:SIM.cockpitTutor(),lab:SIM.systemsLabState(),next:{text:cockpitTutorNext.textContent,disabled:cockpitTutorNext.disabled},progress:SIM.systemsLabs()[0].progress,events:BLACK_BOX.events.filter(event=>event.type==="systems_lab_outcome").map(event=>event.data),facts:SIM.blackBox().facts.map(fact=>fact.text)}));
  await page.screenshot({path:path.join(artifacts,"systems-lab-recovery-complete-desktop.png")});

  await page.click("#cockpitTutorNext");await page.waitForTimeout(220);
  const returned=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="pitot-icing-recovery"]');return{board:SIM.boardState(),lab:SIM.systemsLabState(),row:{text:row?.textContent.trim()||"",pressed:row?.getAttribute("aria-pressed")||"",mastered:row?.classList.contains("mastered")||false},preview:destinationLessonPreview.textContent,progress:SIM.systemsLabs()[0].progress,events:BLACK_BOX.events.filter(event=>["systems_lab_handoff","systems_lab_outcome","systems_lab_return"].includes(event.type)).map(event=>({type:event.type,data:event.data}))};});
  await page.screenshot({path:path.join(artifacts,"systems-lab-mastered-atlas-desktop.png")});

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
  const compact=await page.evaluate(()=>{const row=document.querySelector('[data-system-lab="pitot-icing-recovery"]');return{display:getComputedStyle(row).display,overflow:document.documentElement.scrollWidth-innerWidth,launch:atlasMobileLaunch.textContent.trim()};});

  const checks={
    atlasExposesAuthoredModule:atlasBefore.board.discipline==="systems"&&atlasBefore.board.selectedId==="stormhaven"&&atlasBefore.board.systemsLabId==="pitot-icing-recovery"&&atlasBefore.row.display==="grid"&&atlasBefore.row.text.includes("Pitot-Icing Recovery")&&atlasBefore.preview.includes("physical PITOT heat rocker")&&atlasBefore.launch==="START SYSTEMS LAB"&&atlasBefore.row.left>=atlasBefore.card.left&&atlasBefore.row.right<=atlasBefore.card.right,
    handoffStagesMeasuredFailure:!handoff.board.visible&&handoff.scene==="storm"&&handoff.world==="stormhaven"&&handoff.camera==="COCKPIT"&&handoff.lab.active&&handoff.lab.id==="pitot-icing-recovery"&&handoff.tutor.scenario.stage==="detect"&&handoff.pitot.ice_percent>=40&&handoff.pitot.actual_indicated_knots-handoff.pitot.sensed_knots>=20,
    physicalControlNotPreselected:handoff.pitot.heat_selected===false&&handoff.events.some(event=>event.physical_control_required&&event.pitot_heat_selected===false),
    realtimeReceivesExactLabState:handoff.realtime.training_lab.id==="pitot-icing-recovery"&&handoff.realtime.training_lab.scenario.stage==="detect"&&handoff.realtime.screen_context.systems_lab==="pitot-icing-recovery"&&handoff.realtime.cockpit.learning.scenario.observed.ice_percent===handoff.pitot.ice_percent,
    actionRequiresPhysicalRocker:action.tutor.scenario.stage==="act"&&action.next.disabled&&action.next.text.includes("PHYSICAL")&&action.physicalLock==="pitot"&&!action.pitot.heat_selected,
    rockerAdvancesMeasuredRecovery:clearing.pitot.heat_selected&&clearing.pitot.heat_effective&&clearing.tutor.scenario.stage==="clearing"&&clearing.events.some(event=>event.type==="pitot_heat"&&event.data.selected===true)&&clearing.events.some(event=>event.type==="cockpit_scenario"&&event.data.action==="heat_selected"),
    completionPersistsMeasuredMastery:complete.tutor.scenario.verified&&complete.pitot.reliable&&complete.lab.completed&&complete.next.text==="RETURN TO ATLAS"&&!complete.next.disabled&&complete.progress.mastered&&complete.progress.best_recovery_s>0&&complete.events.some(event=>event.mastered&&event.recovery_s===complete.progress.last_recovery_s)&&complete.facts.some(text=>text.includes("Pitot-Icing Recovery mastered")),
    returnRestoresSameSyllabus:returned.board.visible&&returned.board.discipline==="systems"&&returned.board.selectedId==="stormhaven"&&returned.board.systemsLabId==="pitot-icing-recovery"&&!returned.lab.active&&returned.row.mastered&&returned.row.pressed==="true"&&returned.row.text.includes("BEST")&&returned.preview.includes("physical PITOT heat rocker")&&returned.events.some(event=>event.type==="systems_lab_return"),
    noNewCompactModuleUi:compact.display==="none"&&compact.overflow<=0,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),url:baseUrl,checks,atlasBefore,handoff,action,pitotPoint,clearing,complete,returned,compact,errors};
  fs.writeFileSync(path.join(artifacts,"systems-lab-handoff-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,atlasBefore,handoff:{board:handoff.board,scene:handoff.scene,world:handoff.world,camera:handoff.camera,lab:handoff.lab,pitot:handoff.pitot,tutor:handoff.tutor},action,clearing,complete,returned,compact,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
