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
  const config=await import(path.join(project,"server/aviator-session.mjs")),session=config.aviatorSessionConfig(),systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1600,height:950},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.worldLocations().locations.length===10,null,{timeout:30000});

  const ids=await page.evaluate(()=>{const locations=SIM.worldLocations().locations;return{academy:locations.find(location=>location.level==="circuit"&&defaultWorldLocation(location.level)===location.id).id,storm:locations.find(location=>location.level==="storm"&&defaultWorldLocation(location.level)===location.id).id};});
  const readRelease=()=>page.evaluate(()=>{const release=document.querySelector(".destination-release"),card=document.querySelector(".destination-card"),map=document.getElementById("atlasMapStage"),sheet=document.querySelector("#missionBoard .sheet"),cells=[...release.children].map(node=>({text:node.innerText,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth})),rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{model:SIM.trainingRelease(),ui:{state:release.dataset.state,text:release.innerText,cells,rect:rect(release),card:rect(card),map:rect(map),sheet:rect(sheet)}};});

  await page.evaluate(id=>setAtlasSelection(id),ids.academy);const standard=await readRelease();
  await page.evaluate(id=>{setAtlasSelection(id);frameAtlasRoute();},ids.storm);await page.waitForTimeout(120);const storm=await readRelease();
  await page.screenshot({path:path.join(artifacts,"training-release-atlas-desktop.png"),fullPage:false});

  const cockpit=await page.evaluate(()=>{startAviatorFromFlightGesture=()=>false;launchMission("storm",selectedStoryMissionId("storm"));S.paused=true;updateCamera(.016);syncGraphics(.016);updateCockpitDock();const handoff=[...BLACK_BOX.events].reverse().find(event=>event.run===BLACK_BOX.runId&&event.type==="lesson_handoff");return{release:SIM.trainingRelease("storm"),realtime:SIM.realtimeFlightState().mission.training_release,dock:{mission:cockpitDockMission.textContent,plan:cockpitDockPlan.textContent,aria:cockpitDockPlan.getAttribute("aria-label")},camera:SIM.camInfo().mode,handoff:handoff?.data||null};});
  await page.screenshot({path:path.join(artifacts,"training-release-cockpit-desktop.png"),fullPage:false});

  const checks={
    selectionRecalculates:standard.model.status==="STANDARD"&&standard.model.score===0&&storm.model.status==="INSTRUCTOR"&&storm.model.score>=6,
    measuredStormInputs:storm.model.visibility_percent===52&&storm.model.crosswind_mps===10&&storm.model.surface==="WET"&&storm.model.brake_factor===.66&&storm.model.route_clearance_m>=160,
    conciseOperationalStrip:storm.ui.state==="warning"&&storm.ui.cells.length===5&&storm.ui.text.includes("TRAINING RELEASE")&&storm.ui.text.includes("INSTRUCTOR")&&storm.ui.text.includes("INSTRUMENT SCAN")&&storm.ui.cells.every(cell=>cell.scrollWidth<=cell.clientWidth+1),
    balancedDesktopLayout:Math.abs(storm.ui.card.height-storm.ui.map.height)<=3&&storm.ui.card.bottom<=storm.ui.sheet.bottom-12&&storm.ui.card.left>=storm.ui.map.right,
    cockpitContinuity:cockpit.camera==="COCKPIT"&&cockpit.dock.plan.includes("INSTRUCTOR")&&cockpit.dock.plan.includes("V52")&&cockpit.dock.plan.includes("RAIN")&&cockpit.dock.plan.includes("PREFLIGHT")&&cockpit.dock.aria.includes("instrument scan"),
    realtimeGrounded:cockpit.realtime.status==="INSTRUCTOR"&&cockpit.realtime.primary_action==="INSTRUMENT SCAN"&&cockpit.realtime.visibility_percent===52&&cockpit.realtime.crosswind_mps===10,
    blackBoxHandoff:cockpit.handoff?.training_release?.status==="INSTRUCTOR"&&cockpit.handoff.training_release.primary_action==="INSTRUMENT SCAN"&&cockpit.handoff.training_release.visibility_percent===52,
    nonRegulatoryGuardrail:session.instructions.includes("mission.training_release")&&session.instructions.includes("never present it as legal dispatch approval"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,standard,storm,cockpit,session:{model:session.model,voice:session.audio.output.voice},errors};
  fs.writeFileSync(path.join(artifacts,"training-release-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,standard:standard.model,storm:storm.model,cockpit,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
