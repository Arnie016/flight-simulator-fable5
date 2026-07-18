#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setLevel("storm");SIM.setCam(1);camMode=1;setCockpitDockExpanded(true,true);updateCamera(.016);updateCockpitDock();});
  await page.waitForTimeout(250);

  const initial=await page.evaluate(()=>({pitot:SIM.pitot(),dock:SIM.cockpitDock(),preflight:SIM.preflight(),button:{text:cockpitPitot.textContent,pressed:cockpitPitot.getAttribute("aria-pressed"),state:cockpitPitot.dataset.state},load:SIM.electrical().load}));
  await page.hover("#cockpitPitot");
  await page.waitForTimeout(180);
  const hover=await page.evaluate(()=>({status:cockpitDockStatus.textContent,transform:getComputedStyle(cockpitPitot).transform,shadow:getComputedStyle(cockpitPitot).boxShadow}));
  await page.click("#cockpitPitot");
  await page.mouse.move(720,450);
  const off=await page.evaluate(()=>({pitot:SIM.pitot(),dock:SIM.cockpitDock(),preflight:SIM.preflight(),button:{text:cockpitPitot.textContent,pressed:cockpitPitot.getAttribute("aria-pressed"),state:cockpitPitot.dataset.state},load:SIM.electrical().load,facts:SIM.blackBox().facts.map(f=>f.text)}));

  const iced=await page.evaluate(()=>{
    SIM.teleport(0,180,0);SIM.setVel(0,0,-42);SIM.set({throttle:.58,pitch:0,roll:0,yaw:0});SIM.warp(5.2);COCKPIT_DOCK.noticeUntil=0;updateCockpitDock();updateFlightAlert();
    const pitot=SIM.pitot(),alert=flightAlertState(),realtime=SIM.realtimeFlightState(),facts=SIM.blackBox().facts.map(f=>f.text),lastFrame=REPLAY.history.at(-1);
    return{snap:SIM.snap(),pitot,alert,realtime:realtime.aircraft_systems.pitot,dock:SIM.cockpitDock(),facts,replay:{pitotHeatOn:lastFrame?.pitotHeatOn,pitotIce:lastFrame?.pitotIce,frames:REPLAY.history.length}};
  });
  await page.screenshot({path:path.join(artifacts,"pitot-heat-icing-desktop.png")});

  await page.click("#cockpitPitot");
  const recovered=await page.evaluate(()=>{SIM.warp(2.5);COCKPIT_DOCK.noticeUntil=0;updateCockpitDock();updateFlightAlert();return{pitot:SIM.pitot(),alert:flightAlertState(),dock:SIM.cockpitDock(),facts:SIM.blackBox().facts.map(f=>f.text),realtime:SIM.realtimeFlightState().aircraft_systems.pitot};});
  const reset=await page.evaluate(()=>{SIM.reset();SIM.setLevel("storm");SIM.setCam(1);camMode=1;setCockpitDockExpanded(true,true);updateCamera(.016);updateCockpitDock();return{pitot:SIM.pitot(),preflight:SIM.preflight(),dock:SIM.cockpitDock()};});

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),pitot=cockpitPitot.getBoundingClientRect(),cueBox=cue.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},pitot:{left:pitot.left,right:pitot.right,top:pitot.top,bottom:pitot.bottom,text:cockpitPitot.textContent},cue:{top:cueBox.top,bottom:cueBox.bottom},switches:[...document.querySelectorAll(".cockpit-switches button")].map(button=>button.textContent)};});
  await page.screenshot({path:path.join(artifacts,"pitot-heat-mobile.png")});

  const checks={
    stormDefaultReady:initial.pitot.heat_selected&&initial.pitot.heat_effective&&initial.pitot.reliable&&initial.preflight.checks.filter(check=>!check.note).every(check=>check.pass)&&initial.button.text.includes("PITOT · ON"),
    electricalLoad:initial.load-off.load>=.17,
    weatherPreflightBoundary:!off.pitot.heat_selected&&!off.preflight.checks.find(check=>check.id==="vacuum").pass&&off.preflight.checks.find(check=>check.id==="vacuum").label==="PITOT HEAT REQUIRED",
    dockTelemetry:off.dock.pitot_heat_selected===false&&off.dock.pitot_heat_effective===false&&off.button.pressed==="false"&&off.button.state==="off",
    hoverFeedback:hover.status.includes("ICE 0%")&&hover.status.includes("ASI RELIABLE")&&hover.transform.includes("-2")&&hover.shadow!=="none"&&hover.shadow!=="rgba(0, 0, 0, 0) 0px 0px 0px 0px",
    measuredIcing:iced.pitot.ice_percent>=30&&!iced.pitot.reliable&&iced.pitot.actual_indicated_knots-iced.pitot.sensed_knots>=15,
    warningIsSpecific:iced.alert.active&&iced.alert.code==="PITOT ICE"&&iced.alert.action.includes("PITCH / POWER"),
    realtimeGrounded:iced.realtime.heat_selected===false&&!iced.realtime.reliable&&iced.realtime.ice_percent===iced.pitot.ice_percent&&iced.realtime.sensed_knots===iced.pitot.sensed_knots,
    blackBoxIcing:iced.facts.some(text=>text.includes("Pitot icing reached")),
    replayState:iced.replay.frames>20&&iced.replay.pitotHeatOn===false&&iced.replay.pitotIce>=.3,
    measuredRecovery:recovered.pitot.heat_effective&&recovered.pitot.reliable&&recovered.pitot.ice_percent<=6&&recovered.pitot.recoveries===1&&!recovered.alert.active&&recovered.facts.some(text=>text.includes("blockage cleared"))&&recovered.realtime.reliable,
    resetRestoresReadiness:reset.pitot.heat_selected&&reset.pitot.ice_percent===0&&reset.preflight.checks.filter(check=>!check.note).every(check=>check.pass),
    mobileFit:mobile.overflow<=0&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.pitot.left>=mobile.dock.left&&mobile.pitot.right<=mobile.dock.right&&mobile.cue.bottom<=mobile.dock.top&&mobile.switches.length===4,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,hover,off,iced,recovered,reset,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"pitot-heat-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
