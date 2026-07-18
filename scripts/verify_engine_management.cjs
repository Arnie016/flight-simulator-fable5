#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function setRange(page,selector,value){
  await page.locator(selector).evaluate((input,next)=>{input.value=String(next);input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));},value);
}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setLevel("alpine",false);SIM.setCam(1);setCockpitDockExpanded(true,true);updateCamera(.016);updateCockpitDock();});
  await page.waitForFunction(()=>getComputedStyle(cockpitDockEl).display==="block");
  await page.locator("#cockpitDepartureCheck").click();

  await page.locator("#cockpitBrake").dispatchEvent("pointerdown");
  await setRange(page,"#cockpitThrottle",100);
  await page.evaluate(()=>SIM.warp(2.5));
  const rich=await page.evaluate(()=>({snap:SIM.snap(),engine:SIM.engineManagement(),dock:SIM.cockpitDock()}));

  const recommended=rich.engine.recommended_percent;
  await setRange(page,"#cockpitMixture",recommended);
  await page.evaluate(()=>SIM.warp(2.5));
  const best=await page.evaluate(()=>({snap:SIM.snap(),engine:SIM.engineManagement(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().aircraft_systems.engine_management,output:cockpitMixtureValue.value}));

  await setRange(page,"#cockpitMixture",35);
  await page.evaluate(()=>SIM.warp(2.5));
  const lean=await page.evaluate(()=>({snap:SIM.snap(),engine:SIM.engineManagement(),alert:flightAlertState(),check:SIM.preflight().checks.find(check=>check.id==="mixture"),output:cockpitMixtureValue.value}));

  await setRange(page,"#cockpitMixture",0);
  await page.evaluate(()=>SIM.warp(3));
  const cutoff=await page.evaluate(()=>({snap:SIM.snap(),engine:SIM.engineManagement(),alert:flightAlertState(),electrical:SIM.electrical()}));

  await setRange(page,"#cockpitMixture",recommended);
  await page.evaluate(()=>SIM.warp(3));
  await page.evaluate(()=>setCockpitDockExpanded(true,true));
  await page.hover("#cockpitMixture");
  const recovered=await page.evaluate(()=>({snap:SIM.snap(),engine:SIM.engineManagement(),dock:SIM.cockpitDock(),check:SIM.preflight().checks.find(check=>check.id==="mixture"),status:cockpitDockStatus.textContent,realtime:SIM.realtimeFlightState().aircraft_systems.engine_management,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&["mixture_limit","mixture_recovery","cockpit_control"].includes(event.type)).map(event=>({type:event.type,data:event.data})),facts:blackBoxSnapshot().facts}));

  await page.evaluate(()=>{SIM.restartMission();SIM.setCam(1);updateCamera(.016);updateCockpitDock();});
  await setRange(page,"#cockpitMixture",recommended);
  await page.evaluate(()=>setCockpitDockExpanded(true,true));
  await page.locator("#cockpitDepartureCheck").click();
  await page.hover("#cockpitMixture");
  await page.screenshot({path:path.join(artifacts,"engine-management-cockpit-desktop.png")});

  await page.mouse.move(700,400);await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{updateCamera(.016);updateCockpitDock();});await page.waitForTimeout(150);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),cue=document.getElementById("cue").getBoundingClientRect(),mixture=document.querySelector("#cockpitMixture").getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,height:dock.height},cue:{top:cue.top,bottom:cue.bottom},mixture:{left:mixture.left,right:mixture.right,top:mixture.top,bottom:mixture.bottom},output:cockpitMixtureValue.value};});
  await page.screenshot({path:path.join(artifacts,"engine-management-cockpit-mobile.png")});

  const checks={
    densityRecommendation:recommended>=80&&recommended<=95&&rich.engine.band==="rich",
    bestPowerGain:best.engine.band==="best"&&best.engine.power_factor>.98&&best.snap.rpm>=rich.snap.rpm+80,
    leanBoundary:lean.engine.band==="lean"&&lean.engine.power_factor<.6&&!lean.check.pass&&lean.alert.code==="MIXTURE TOO LEAN",
    cutoffStopsEngine:cutoff.engine.band==="cutoff"&&!cutoff.engine.running&&cutoff.snap.rpm<650&&cutoff.alert.code==="MIXTURE CUTOFF",
    recoveryRestoresPower:recovered.engine.band==="best"&&recovered.engine.recoveries>=1&&recovered.snap.rpm>2500&&recovered.check.pass,
    blackBoxMeasured:recovered.events.some(event=>event.type==="mixture_limit"&&event.data.band==="cutoff")&&recovered.events.some(event=>event.type==="mixture_recovery"&&event.data.recovery_s>0)&&recovered.facts.some(fact=>fact.type==="mixture_recovery"),
    realtimeGrounded:best.realtime.setting_percent===recommended&&best.realtime.band==="best"&&best.realtime.power_factor>.98,
    cockpitControlRecorded:recovered.events.filter(event=>event.type==="cockpit_control"&&event.data.control==="mixture").length>=4,
    hoverInstruction:recovered.dock.focused_control==="mixture"&&recovered.status.includes("PWR")&&recovered.status.includes("REC"),
    mobileFit:mobile.overflow<=0&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.cue.bottom<=mobile.dock.top&&mobile.mixture.left>=mobile.dock.left&&mobile.mixture.right<=mobile.dock.right,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,rich,best,lean,cutoff,recovered,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"engine-management-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,rich,best,lean,cutoff,recovered:{snap:recovered.snap,engine:recovered.engine,dock:recovered.dock,check:recovered.check,status:recovered.status,realtime:recovered.realtime,events:recovered.events,facts:recovered.facts},mobile,errors},null,2));
  await browser.close();
  if(!report.ok)process.exitCode=1;
}

main().catch(error=>{console.error(error);process.exit(1);});
