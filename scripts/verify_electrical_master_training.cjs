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
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");reset();SIM.setCam(1);updateCamera(.016);updateCockpitDock();});

  const initial=await page.evaluate(()=>({dock:SIM.cockpitDock(),electrical:SIM.electrical(),checks:SIM.preflight().checks}));
  await page.evaluate(()=>setCockpitDockExpanded(true,true));
  await page.click("#cockpitBattery");
  await page.click("#cockpitDepartureCheck");
  const masterOff=await page.evaluate(()=>{syncGraphics(.016);return{dock:SIM.cockpitDock(),electrical:SIM.electrical(),preflight:SIM.preflight(),alert:SIM.alerts(),cue:SIM.cue(),lights:{left:navL.visible,right:navR.visible,strobe:strobe.visible},realtime:SIM.realtimeFlightState(),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="electrical_switch")};});

  await page.click("#cockpitBattery");
  await page.click("#cockpitAlternator");
  await page.click("#cockpitDepartureCheck");
  const alternatorOff=await page.evaluate(()=>({dock:SIM.cockpitDock(),electrical:SIM.electrical(),preflight:SIM.preflight(),alert:SIM.alerts()}));

  await page.click("#cockpitAlternator");
  await page.click("#cockpitDepartureCheck");
  const cleared=await page.evaluate(()=>({dock:SIM.cockpitDock(),electrical:SIM.electrical(),preflight:SIM.preflight()}));

  await page.evaluate(()=>{S.onGround=false;S.wasAirborne=true;S.phase="cruise";SIM.teleport(0,180,0);SIM.setVel(0,0,-32);SIM.set({throttle:.55});SIM.warp(1.2);setCockpitDockExpanded(true,true);});
  const poweredRpm=await page.evaluate(()=>S.rpm);
  await page.click("#cockpitBattery");
  await page.evaluate(()=>SIM.warp(.6));
  const airborneOff=await page.evaluate(()=>{syncGraphics(.016);return{snap:SIM.snap(),dock:SIM.cockpitDock(),electrical:SIM.electrical(),alert:SIM.alerts(),cue:SIM.cue(),lights:{left:navL.visible,right:navR.visible,strobe:strobe.visible},realtime:SIM.realtimeFlightState(),facts:SIM.realtimeFlightState().black_box.recent_facts,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="electrical_switch").map(event=>event.data)};});
  await page.screenshot({path:path.join(artifacts,"electrical-master-training-desktop.png")});

  await page.click("#cockpitBattery");
  await page.evaluate(()=>{SIM.clear();SIM.warp(.2);updateCockpitDock();});
  const restored=await page.evaluate(()=>({dock:SIM.cockpitDock(),electrical:SIM.electrical(),alert:SIM.alerts(),rpm:Math.round(S.rpm)}));

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{reset();SIM.setCam(1);setCockpitDockExpanded(true,true);updateCamera(.016);updateCockpitDock();});
  await page.waitForTimeout(200);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),buttons=[cockpitBattery,cockpitAlternator,cockpitBrake].map(button=>{const box=button.getBoundingClientRect();return{label:button.textContent,left:box.left,right:box.right,top:box.top,bottom:box.bottom};});return{overflow:document.documentElement.scrollWidth-innerWidth,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},buttons,status:cockpitDockStatus.textContent};});
  await page.screenshot({path:path.join(artifacts,"electrical-master-training-mobile.png")});

  const masterCheck=masterOff.preflight.checks.find(check=>check.id==="battery"),altCheck=alternatorOff.preflight.checks.find(check=>check.id==="alternator");
  const controls=airborneOff.realtime.cockpit.controls,systems=airborneOff.realtime.aircraft_systems;
  const checks={
    independentSwitches:initial.dock.battery_master_on&&initial.dock.alternator_switch_on&&!masterOff.dock.battery_master_on&&masterOff.dock.alternator_switch_on&&alternatorOff.dock.battery_master_on&&!alternatorOff.dock.alternator_switch_on,
    masterBlocksPreflight:masterCheck?.pass===false&&masterCheck.label==="BAT MASTER OFF"&&!masterOff.preflight.armed,
    alternatorBlocksPreflight:altCheck?.pass===false&&altCheck.label==="ALT SWITCH OFF"&&!alternatorOff.preflight.armed,
    correctedConfigurationClears:cleared.preflight.armed&&cleared.preflight.lastIssues===""&&cleared.dock.battery_master_on&&cleared.dock.alternator_switch_on&&cleared.electrical.state==="CHARGING",
    busPowerConsequence:masterOff.electrical.state==="MASTER OFF"&&masterOff.electrical.source==="OFF"&&masterOff.electrical.volts===0&&masterOff.electrical.power===0,
    magnetoEngineContinues:poweredRpm>1400&&airborneOff.snap.rpm>1200&&!airborneOff.snap.failEngine&&airborneOff.dock.engine_running,
    poweredLightsFollowBus:!masterOff.lights.left&&!masterOff.lights.right&&!airborneOff.lights.left&&!airborneOff.lights.right,
    airborneRecoveryCue:airborneOff.alert.code==="MASTER OFF"&&airborneOff.alert.action.includes("BAT ON")&&airborneOff.cue.text.includes("select BAT ON")&&restored.electrical.state==="CHARGING"&&restored.rpm>1200,
    realtimeGrounded:controls.battery_master_on===false&&controls.alternator_switch_on===true&&systems.battery_master_on===false&&systems.alternator_switch_on===true&&systems.electrical_state==="MASTER OFF"&&airborneOff.realtime.warning.code==="MASTER OFF",
    blackBoxMeasured:airborneOff.events.filter(event=>event.control==="battery_master").length>=3&&airborneOff.events.some(event=>event.control==="alternator_switch"&&!event.on)&&airborneOff.facts.some(fact=>fact.includes("Battery master selected off")&&fact.includes("engine continued running")),
    mobileFit:mobile.overflow<=0&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.buttons.length===3&&mobile.buttons.every((button,index)=>button.left>=0&&button.right<=390&&(!index||button.left>=mobile.buttons[index-1].right)),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,masterOff,alternatorOff,cleared,poweredRpm,airborneOff,restored,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"electrical-master-training-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial,masterOff:{dock:masterOff.dock,electrical:masterOff.electrical,preflight:masterOff.preflight,alert:masterOff.alert},alternatorOff,cleared,airborneOff:{snap:airborneOff.snap,dock:airborneOff.dock,electrical:airborneOff.electrical,alert:airborneOff.alert,cue:airborneOff.cue,realtime:{aircraft_systems:systems,controls,warning:airborneOff.realtime.warning},facts:airborneOff.facts},restored,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
