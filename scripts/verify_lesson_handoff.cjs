#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function clickRange(page,selector,ratio){const box=await page.locator(selector).boundingBox();await page.mouse.click(box.x+box.width*Math.max(.02,Math.min(.98,ratio)),box.y+box.height*.5);}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(0);updateCamera(.016);SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().hits.length===10,null,{timeout:30000});

  const pin=await page.evaluate(()=>SIM.liveAtlas().hits.find(hit=>hit.id==="alpineRidge")),map=await page.locator("#islandMapCanvas").boundingBox();
  await page.mouse.click(map.x+pin.x,map.y+pin.y);await page.locator(".ground-mission").nth(1).click();
  const briefing=await page.evaluate(()=>({selected:SIM.liveAtlas().selectedId,lesson:document.querySelector(".ground-mission.selected strong")?.textContent||"",objective:document.querySelector(".destination-copy p")?.textContent||"",route:document.querySelector(".destination-route")?.innerText||"",launch:destinationLaunch.textContent.trim(),camera:SIM.camInfo().mode}));
  await page.locator("#destinationLaunch").click();
  await page.waitForFunction(()=>!SIM.boardState().visible&&SIM.camInfo().mode==="COCKPIT"&&SIM.cockpitDock().mission_id==="ridge-mail");
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded,null,{timeout:30000});
  const launched=await page.evaluate(()=>({camera:SIM.camInfo().mode,board:SIM.boardState().visible,dock:SIM.cockpitDock(),dockMission:cockpitDockMission.textContent,dockPlan:cockpitDockPlan.textContent,dockDisplay:getComputedStyle(cockpitDockEl).display,hud:missionHud.innerText,realtime:SIM.realtimeFlightState().cockpit.controls,selected:SIM.storyMissions().selected.alpine,handoff:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="lesson_handoff").at(-1)?.data||null}));

  await page.locator("#cockpitDockToggle").click();
  await page.waitForFunction(()=>SIM.cockpitDock().expanded);
  await page.locator('[data-cockpit-flap="0.5"]').click();await page.locator('[data-cockpit-flap="0"]').click();
  await page.locator("#cockpitAlternator").click();await page.locator("#cockpitAlternator").click();
  await clickRange(page,"#cockpitThrottle",.18);await clickRange(page,"#cockpitThrottle",.02);
  await page.waitForFunction(()=>SIM.snap().flapLeft<.02&&SIM.snap().flaps===0,null,{timeout:5000});
  if(!(await page.evaluate(()=>SIM.cockpitDock().expanded)))await page.locator("#cockpitDockToggle").click();
  await page.locator("#cockpitDepartureCheck").click();
  const cleared=await page.evaluate(()=>({preflight:SIM.preflight(),dock:SIM.cockpitDock(),button:cockpitDepartureCheck.textContent,pressed:cockpitDepartureCheck.getAttribute("aria-pressed"),controls:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data.control)}));
  const startZ=await page.evaluate(()=>SIM.snap().z);await clickRange(page,"#cockpitThrottle",.72);await page.evaluate(()=>SIM.warp(2.4));
  const flown=await page.evaluate(originZ=>({snap:SIM.snap(),dock:SIM.cockpitDock(),startZ:originZ,moved:Math.abs(SIM.snap().z-originZ),realtime:SIM.realtimeFlightState().cockpit.controls}),startZ);
  await page.screenshot({path:path.join(artifacts,"lesson-handoff-cockpit-desktop.png")});

  await page.evaluate(()=>{
    REPLAY.history.length=0;for(let i=0;i<40;i++)REPLAY.history.push({t:i*.2,x:7-i*.1,y:28-i*.45,z:410-i*7,qx:0,qy:0,qz:0,qw:1});
    S.pos.set(3,CFG.restY,12);S.touchSink=1.5;SCORE.value=78;SCORE.grade="B";SCORE.tdSink=1.5;SCORE.tdOff=5;MISSION.idx=1;MISSION.done=false;showDebrief(78);
  });
  await page.waitForTimeout(180);
  const debrief=await page.evaluate(()=>({visible:SIM.debriefState().visible,title:debriefTitle.textContent,metrics:debriefMetrics.textContent.replace(/\s+/g," ").trim(),imageBytes:debriefMomentImage.src.length,actions:[...document.querySelectorAll("#debrief .actions button")].map(button=>button.textContent.trim())}));
  await page.screenshot({path:path.join(artifacts,"lesson-handoff-debrief-desktop.png")});
  await page.locator("#debriefLevels").click();await page.waitForFunction(()=>SIM.boardState().visible);
  const returned=await page.evaluate(()=>({selected:SIM.liveAtlas().selectedId,lesson:document.querySelector(".ground-mission.selected strong")?.textContent||"",status:document.querySelector(".destination-level b")?.textContent||""}));

  await page.setViewportSize({width:390,height:844});await page.locator("#destinationLaunch").click();await page.waitForFunction(()=>SIM.camInfo().mode==="COCKPIT"&&!SIM.boardState().visible&&SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded);await page.waitForTimeout(240);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),brief=document.querySelector(".cockpit-dock-brief"),hud=missionHud.getBoundingClientRect(),cueRect=cue.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,camera:SIM.camInfo().mode,state:SIM.cockpitDock(),dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,height:dock.height},briefDisplay:getComputedStyle(brief).display,hud:{left:hud.left,right:hud.right,top:hud.top,bottom:hud.bottom},cue:{left:cueRect.left,right:cueRect.right,top:cueRect.top,bottom:cueRect.bottom},title:cockpitDockTitle.textContent,toggle:cockpitDockToggle.getAttribute("aria-label"),mission:cockpitDockMission.textContent,plan:cockpitDockPlan.textContent};});
  await page.screenshot({path:path.join(artifacts,"lesson-handoff-cockpit-mobile.png")});

  const checks={
    briefingIsComplete:briefing.selected==="alpineRidge"&&briefing.lesson==="Ridge Mail"&&briefing.objective.includes("high valley")&&briefing.route.includes("KM")&&briefing.route.includes("SNOW")&&briefing.camera==="CHASE",
    automaticCockpitHandoff:launched.camera==="COCKPIT"&&!launched.board&&launched.dock.visible&&launched.dockDisplay==="block"&&launched.dock.physical_controls_ready&&!launched.dock.expanded&&launched.dock.presentation==="physical-first",
    lessonContextPersists:launched.selected==="ridge-mail"&&launched.dock.mission_id==="ridge-mail"&&launched.dockMission==="RIDGE MAIL"&&launched.dockPlan.includes("FLURRIES")&&launched.hud.includes("RIDGE MAIL"),
    realtimeGrounded:launched.realtime.mission_id==="ridge-mail"&&launched.realtime.mission_title==="Ridge Mail"&&launched.realtime.phase==="parked",
    handoffRecorded:launched.handoff?.mission_id==="ridge-mail"&&launched.handoff?.camera==="COCKPIT"&&launched.handoff?.departure_runway==="36",
    dockControlsOperable:cleared.controls.includes("flaps")&&cleared.controls.includes("alternator")&&cleared.controls.includes("throttle"),
    dockChecklistOperable:cleared.preflight.armed&&cleared.dock.departure_cleared&&cleared.button==="CLEARED"&&cleared.pressed==="true",
    simulationAdvanced:flown.moved>1&&flown.snap.speed>0&&flown.dock.throttle_command_percent>60&&flown.realtime.throttle_command_percent===flown.dock.throttle_command_percent&&Math.abs(startZ-520)<12,
    visualDebrief:debrief.visible&&debrief.title.includes("Ridge Mail")&&debrief.metrics.includes("1.5 m/s")&&debrief.metrics.includes("5 m")&&debrief.imageBytes>1000&&debrief.actions.includes("TRAINING MAP"),
    returnContinuity:returned.selected==="alpineRidge"&&returned.lesson==="Ridge Mail",
    mobileFit:mobile.overflow<=0&&mobile.camera==="COCKPIT"&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.dock.height<=31&&mobile.briefDisplay==="none"&&mobile.hud.bottom<mobile.dock.top&&mobile.cue.bottom<=mobile.dock.top,
    mobilePhysicalFirst:mobile.state.physical_controls_ready&&!mobile.state.expanded&&mobile.state.presentation==="physical-first"&&mobile.title==="SYSTEMS READY"&&mobile.toggle==="Open accessible cockpit controls",
    mobileContext:mobile.mission==="RIDGE MAIL"&&mobile.plan.includes("FLURRIES"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,briefing,launched,cleared,flown,debrief,returned,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"lesson-handoff-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,briefing,launched,cleared,flown,debrief,returned,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
