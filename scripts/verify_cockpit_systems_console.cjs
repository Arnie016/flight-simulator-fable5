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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.reset();SIM.setCam(1);camMode=1;setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>COCKPIT_SYSTEMS_ASSET.status==="loaded",null,{timeout:30000});

  const asset=await page.request.get(baseUrl+"/assets/cockpit/flight_systems_console.glb"),assetBytes=(await asset.body()).length;
  const point=async id=>page.evaluate(control=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const names={ignition:"Ignition_Knob",battery:"Battery_Rocker",alternator:"Alternator_Rocker",pitot:"Pitot_Rocker"},node=cockpitSystemsConsole.getObjectByName(names[control]),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height,viewport:{width:innerWidth,height:innerHeight},world:world.toArray()};},id);
  const points={};for(const id of["ignition","battery","alternator","pitot"])points[id]=await point(id);

  await page.mouse.move(points.battery.x,points.battery.y);await page.waitForTimeout(160);
  const hover=await page.evaluate(()=>{const state=SIM.cockpitSystems(),group=COCKPIT_SYSTEMS_GROUPS.battery;return{state,inspect:{name:instrumentInspectName.textContent,source:instrumentInspectSource.textContent,value:instrumentInspectValue.textContent,range:instrumentInspectRange.textContent,boundary:instrumentInspectEl.dataset.state,hidden:instrumentInspectEl.getAttribute("aria-hidden")},lift:+(group.position.z-group.userData.basePosition.z).toFixed(3)};});
  await page.screenshot({path:path.join(artifacts,"cockpit-systems-console-hover-desktop.png")});

  await page.mouse.click(points.battery.x,points.battery.y);await page.waitForTimeout(120);
  const batteryOff=await page.evaluate(()=>({console:SIM.cockpitSystems(),dock:SIM.cockpitDock(),electrical:SIM.electrical(),engine:SIM.engineManagement(),realtime:SIM.realtimeFlightState().cockpit.systems_console,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="electrical_switch").map(event=>event.data),facts:blackBoxSnapshot().facts.map(fact=>fact.text)}));
  await page.mouse.click(points.battery.x,points.battery.y);await page.waitForTimeout(120);

  await page.mouse.move(points.ignition.x,points.ignition.y);await page.mouse.down();await page.mouse.move(Math.max(18,points.ignition.x-260),points.ignition.y,{steps:8});await page.mouse.up();await page.evaluate(()=>SIM.warp(2.2));
  const ignitionOff=await page.evaluate(()=>({console:SIM.cockpitSystems(),ignition:SIM.ignition(),engine:SIM.engineManagement(),snap:SIM.snap(),realtime:SIM.realtimeFlightState().cockpit.systems_console,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="ignition_switch").map(event=>event.data)}));
  await page.screenshot({path:path.join(artifacts,"cockpit-systems-console-ignition-off-desktop.png")});

  const ignitionPoint=await point("ignition");await page.mouse.move(ignitionPoint.x,ignitionPoint.y);await page.mouse.down();await page.mouse.move(ignitionPoint.x+126,ignitionPoint.y,{steps:8});await page.mouse.up();await page.waitForTimeout(80);
  const bothStopped=await page.evaluate(()=>({ignition:SIM.ignition(),engine:SIM.engineManagement(),console:SIM.cockpitSystems()}));
  await page.mouse.click(ignitionPoint.x,ignitionPoint.y);await page.waitForTimeout(440);await page.evaluate(()=>SIM.warp(1.4));
  const restarted=await page.evaluate(()=>({ignition:SIM.ignition(),engine:SIM.engineManagement(),snap:SIM.snap(),console:SIM.cockpitSystems(),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="ignition_switch").map(event=>event.data)}));

  await page.mouse.click(points.alternator.x,points.alternator.y);await page.evaluate(()=>{SIM.setBatteryCharge(.32);SIM.warp(14);});
  const alternatorOff=await page.evaluate(()=>({console:SIM.cockpitSystems(),electrical:SIM.electrical(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.systems_console}));
  await page.mouse.click(points.alternator.x,points.alternator.y);

  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{SIM.reset();SIM.setLevel("storm");SIM.setCam(1);camMode=1;setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});await page.waitForTimeout(250);
  const mobilePoints={};for(const id of["ignition","battery","alternator","pitot"])mobilePoints[id]=await point(id);
  await page.mouse.click(mobilePoints.pitot.x,mobilePoints.pitot.y);await page.evaluate(()=>{SIM.setPitotIce(.35);syncGraphics(.016);});await page.mouse.move(mobilePoints.pitot.x,mobilePoints.pitot.y);await page.waitForTimeout(120);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),inspect=instrumentInspectEl.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.cockpitSystems(),pitot:SIM.pitot(),dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},inspect:{left:inspect.left,right:inspect.right,top:inspect.top,bottom:inspect.bottom,hidden:instrumentInspectEl.getAttribute("aria-hidden")}};});
  await page.screenshot({path:path.join(artifacts,"cockpit-systems-console-mobile.png")});

  const inViewport=entry=>entry.x>=0&&entry.x<=entry.viewport.width&&entry.y>=0&&entry.y<=entry.viewport.height;
  const checks={
    assetServed:asset.status()===200&&assetBytes===1722396,
    namedPhysicalAsset:hover.state.asset==="loaded"&&hover.state.physical_meshes>=30&&["ignition","battery","alternator","pitot"].every(id=>hover.state.named_pivots.includes(id)),
    controlsVisible:Object.values(points).every(inViewport),
    hoverInspection:hover.state.hovered==="battery"&&hover.inspect.name==="BATTERY MASTER"&&hover.inspect.source.includes("PHYSICAL")&&hover.inspect.range.includes("MAGNETOS")&&hover.inspect.hidden==="false"&&hover.lift>=.069,
    physicalBatteryConsequence:!batteryOff.console.battery_master_on&&!batteryOff.dock.battery_master_on&&batteryOff.electrical.volts===0&&batteryOff.engine.running&&batteryOff.realtime.battery_master_on===false&&batteryOff.events.some(event=>event.control==="battery_master"&&!event.on),
    physicalIgnitionOff:ignitionOff.ignition.selector==="off"&&!ignitionOff.ignition.engine_ignited&&!ignitionOff.engine.running&&ignitionOff.snap.rpm<500&&ignitionOff.console.readouts.ignition.boundary==="limit"&&ignitionOff.realtime.ignition_selector==="off",
    startIsTruthful:bothStopped.ignition.selector==="both"&&!bothStopped.engine.running&&restarted.ignition.selector==="both"&&restarted.engine.running&&restarted.snap.rpm>=650&&restarted.events.some(event=>event.selector==="start"&&event.success===true),
    alternatorHasMeasuredCost:!alternatorOff.console.alternator_switch_on&&!alternatorOff.dock.alternator_switch_on&&alternatorOff.electrical.source==="BATT"&&alternatorOff.electrical.battery<.32&&alternatorOff.realtime.readouts.alternator.boundary==="caution",
    mobileOperable:Object.values(mobilePoints).every(inViewport)&&mobile.overflow<=0&&!mobile.state.pitot_heat_selected&&!mobile.pitot.reliable&&mobile.state.hovered==="pitot"&&mobile.inspect.hidden==="false"&&mobile.inspect.left>=0&&mobile.inspect.right<=390&&mobile.inspect.bottom<=mobile.dock.top,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,asset:{status:asset.status(),bytes:assetBytes},points,hover,batteryOff,ignitionOff,bothStopped,restarted,alternatorOff,mobilePoints,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-systems-console-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,asset:report.asset,points,hover,batteryOff:{console:batteryOff.console,electrical:batteryOff.electrical,engine:batteryOff.engine,events:batteryOff.events},ignitionOff,bothStopped,restarted,alternatorOff,mobilePoints,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
