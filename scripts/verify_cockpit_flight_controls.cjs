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
  await page.waitForFunction(()=>COCKPIT_FLIGHT_ASSET.status==="loaded",null,{timeout:30000});

  const asset=await page.request.get(baseUrl+"/assets/cockpit/flight_controls_pedestal.glb"),assetBytes=(await asset.body()).length;
  const point=async id=>page.evaluate(control=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const names={flaps:"Flaps_LeverKnob",trim:"Trim_Wheel",brakes:"Brakes_Paddle"},node=cockpitFlightControls.getObjectByName(names[control]),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height,viewport:{width:innerWidth,height:innerHeight},world:world.toArray()};},id);
  const points={};for(const id of["flaps","trim","brakes"])points[id]=await point(id);

  await page.mouse.move(points.trim.x,points.trim.y);await page.waitForTimeout(160);
  const hover=await page.evaluate(()=>{const state=SIM.cockpitFlightControls(),group=COCKPIT_FLIGHT_GROUPS.trim;return{state,inspect:{name:instrumentInspectName.textContent,source:instrumentInspectSource.textContent,value:instrumentInspectValue.textContent,range:instrumentInspectRange.textContent,boundary:instrumentInspectEl.dataset.state,hidden:instrumentInspectEl.getAttribute("aria-hidden")},lift:+(group.position.z-group.userData.basePosition.z).toFixed(3)};});
  await page.screenshot({path:path.join(artifacts,"cockpit-flight-controls-hover-desktop.png")});

  await page.mouse.click(points.flaps.x,points.flaps.y);await page.evaluate(()=>SIM.warp(1.8));
  const flaps50=await page.evaluate(()=>({state:SIM.cockpitFlightControls(),dock:SIM.cockpitDock(),surfaces:SIM.surfaces(),realtime:SIM.realtimeFlightState().cockpit.flight_controls,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));

  const trimPoint=await point("trim");await page.mouse.move(trimPoint.x,trimPoint.y);await page.mouse.down();await page.mouse.move(trimPoint.x,Math.max(20,trimPoint.y-260),{steps:10});await page.mouse.up();await page.waitForTimeout(120);
  const trimLimit=await page.evaluate(()=>({state:SIM.cockpitFlightControls(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.flight_controls,inspect:{name:instrumentInspectName.textContent,value:instrumentInspectValue.textContent,boundary:instrumentInspectEl.dataset.state},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));
  await page.screenshot({path:path.join(artifacts,"cockpit-flight-controls-trim-limit-desktop.png")});

  await page.evaluate(()=>{SIM.setLevel("alpine");SIM.setCam(1);camMode=1;updateCamera(.016);syncGraphics(.016);});
  const brakePoint=await point("brakes");await page.mouse.move(brakePoint.x,brakePoint.y);await page.mouse.down();await page.waitForTimeout(120);
  const brakeHeld=await page.evaluate(()=>({state:SIM.cockpitFlightControls(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.flight_controls,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));
  await page.mouse.up();await page.waitForTimeout(100);
  const brakeReleased=await page.evaluate(()=>({state:SIM.cockpitFlightControls(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.flight_controls,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));

  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{SIM.reset();SIM.setCam(1);camMode=1;setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});await page.waitForTimeout(250);
  const mobilePoints={};for(const id of["flaps","trim","brakes"])mobilePoints[id]=await point(id);
  await page.mouse.click(mobilePoints.flaps.x,mobilePoints.flaps.y);await page.mouse.move(mobilePoints.trim.x,mobilePoints.trim.y);await page.mouse.down();await page.mouse.move(mobilePoints.trim.x,Math.max(20,mobilePoints.trim.y-110),{steps:8});await page.mouse.up();await page.waitForTimeout(120);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),inspect=instrumentInspectEl.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.cockpitFlightControls(),dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},inspect:{left:inspect.left,right:inspect.right,top:inspect.top,bottom:inspect.bottom,hidden:instrumentInspectEl.getAttribute("aria-hidden")}};});
  await page.screenshot({path:path.join(artifacts,"cockpit-flight-controls-mobile.png")});

  const inViewport=entry=>entry.x>=0&&entry.x<=entry.viewport.width&&entry.y>=0&&entry.y<=entry.viewport.height;
  const checks={
    assetServed:asset.status()===200&&assetBytes===2444360,
    namedPhysicalAsset:hover.state.asset==="loaded"&&hover.state.physical_meshes>=30&&["flaps","trim","brakes"].every(id=>hover.state.named_pivots.includes(id)),
    controlsVisible:Object.values(points).every(inViewport),
    hoverInspection:hover.state.hovered==="trim"&&hover.inspect.name==="ELEVATOR TRIM"&&hover.inspect.source.includes("PHYSICAL")&&hover.inspect.range.includes("+25")&&hover.inspect.hidden==="false"&&hover.lift>=.064,
    directFlapDetent:flaps50.state.flaps_command_percent===50&&flaps50.state.flaps_actual_percent>=45&&flaps50.dock.flaps_command_percent===50&&flaps50.surfaces.flap>0&&flaps50.realtime.flaps_command_percent===50&&flaps50.events.some(event=>event.control==="flaps"&&event.value===50),
    directTrimLimit:trimLimit.state.trim_percent>=24&&trimLimit.state.readouts.trim.boundary==="limit"&&trimLimit.dock.trim_percent===trimLimit.state.trim_percent&&trimLimit.realtime.trim_percent===trimLimit.state.trim_percent&&trimLimit.inspect.boundary==="limit"&&trimLimit.events.some(event=>event.control==="trim"&&event.value>=24),
    brakeIsMomentary:brakeHeld.state.brakes_commanded&&brakeHeld.dock.brakes_commanded&&brakeHeld.realtime.brakes_commanded&&!brakeReleased.state.brakes_commanded&&!brakeReleased.dock.brakes_commanded&&!brakeReleased.realtime.brakes_commanded&&brakeReleased.events.some(event=>event.control==="brakes"&&event.value==="held")&&brakeReleased.events.some(event=>event.control==="brakes"&&event.value==="released"),
    realtimeGrounded:flaps50.realtime.asset==="loaded"&&trimLimit.realtime.readouts.trim.boundary==="limit"&&brakeHeld.realtime.surface.id==="snow",
    mobileOperable:Object.values(mobilePoints).every(inViewport)&&mobile.overflow<=0&&mobile.state.flaps_command_percent===50&&mobile.state.trim_percent>0&&mobile.inspect.hidden==="false"&&mobile.inspect.left>=0&&mobile.inspect.right<=390&&mobile.inspect.bottom<=mobile.dock.top,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,asset:{status:asset.status(),bytes:assetBytes},points,hover,flaps50,trimLimit,brakePoint,brakeHeld,brakeReleased,mobilePoints,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-flight-controls-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,asset:report.asset,points,hover,flaps50,trimLimit,brakeHeld,brakeReleased,mobilePoints,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
