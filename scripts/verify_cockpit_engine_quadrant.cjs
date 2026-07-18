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
  const asset=await page.request.get(baseUrl+"/assets/cockpit/engine_control_quadrant.glb"),assetBytes=(await asset.body()).length;
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.reset();SIM.setCam(1);camMode=1;setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>SIM.realtimeFlightState().cockpit.engine_quadrant.asset==="loaded"&&SIM.realtimeFlightState().cockpit.engine_quadrant.named_pivots.length===2,null,{timeout:30000});
  const point=async id=>page.evaluate(control=>{updateCamera(.016);syncGraphics(.016);camera.updateMatrixWorld(true);const name=control[0].toUpperCase()+control.slice(1)+"_Knob",node=cockpitEngineQuadrant.getObjectByName(name),world=new THREE.Vector3();node.getWorldPosition(world);world.project(camera);const rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(world.x*.5+.5)*rect.width,y:rect.top+(-world.y*.5+.5)*rect.height,viewport:{width:innerWidth,height:innerHeight},world:world.toArray()};},id);

  const initial=await page.evaluate(()=>({quadrant:SIM.realtimeFlightState().cockpit.engine_quadrant,dock:SIM.cockpitDock(),body:[...document.body.classList],rect:cockpitDockEl.getBoundingClientRect().toJSON()}));
  const throttlePoint=await point("throttle"),mixturePoint=await point("mixture");
  await page.screenshot({path:path.join(artifacts,"cockpit-engine-quadrant-desktop.png")});
  await page.mouse.move(throttlePoint.x,throttlePoint.y);await page.waitForFunction(()=>SIM.realtimeFlightState().cockpit.engine_quadrant.hovered==="throttle");
  const hover=await page.evaluate(()=>({quadrant:SIM.realtimeFlightState().cockpit.engine_quadrant,inspect:{name:instrumentInspectName.textContent,source:instrumentInspectSource.textContent,value:instrumentInspectValue.textContent,range:instrumentInspectRange.textContent,state:instrumentInspectEl.dataset.state,hidden:instrumentInspectEl.getAttribute("aria-hidden")},lift:COCKPIT_ENGINE_GROUPS.throttle.position.z-COCKPIT_ENGINE_GROUPS.throttle.userData.basePosition.z}));
  await page.screenshot({path:path.join(artifacts,"cockpit-engine-quadrant-hover-desktop.png")});
  await page.mouse.move(throttlePoint.x,throttlePoint.y);await page.mouse.down();await page.mouse.move(throttlePoint.x,throttlePoint.y-220,{steps:10});await page.mouse.up();await page.waitForTimeout(150);
  const powered=await page.evaluate(()=>({quadrant:SIM.realtimeFlightState().cockpit.engine_quadrant,dock:SIM.cockpitDock(),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));

  await page.evaluate(()=>{S.mixture=.42;syncCockpitEngineQuadrant();updateCockpitDock();});
  const leanPoint=await point("mixture");await page.mouse.move(leanPoint.x,leanPoint.y);await page.mouse.down();await page.mouse.move(leanPoint.x,leanPoint.y+190,{steps:10});await page.mouse.up();await page.waitForTimeout(180);
  const cutoff=await page.evaluate(()=>({quadrant:SIM.realtimeFlightState().cockpit.engine_quadrant,dock:SIM.cockpitDock(),engine:SIM.engineManagement(),inspect:{name:instrumentInspectName.textContent,value:instrumentInspectValue.textContent,range:instrumentInspectRange.textContent,state:instrumentInspectEl.dataset.state},facts:SIM.blackBox().facts.map(fact=>fact.text),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));
  await page.screenshot({path:path.join(artifacts,"cockpit-engine-quadrant-cutoff-desktop.png")});

  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{SIM.reset();SIM.setCam(1);camMode=1;COCKPIT_ENGINE_FOCUS.hover="";COCKPIT_ENGINE_FOCUS.locked="";COCKPIT_ENGINE_FOCUS.dragging="";COCKPIT_DOCK.lastPhase="parked";updateCamera(.016);syncGraphics(.016);setCockpitDockExpanded(false,true);syncCockpitEngineQuadrant();renderCockpitInstrumentInspect();});await page.waitForTimeout(250);
  const mobileThrottle=await point("throttle"),mobileMixture=await point("mixture");await page.mouse.move(mobileThrottle.x,mobileThrottle.y);await page.mouse.down();await page.mouse.move(mobileThrottle.x,mobileThrottle.y-90,{steps:8});await page.mouse.up();await page.waitForTimeout(120);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),inspect=instrumentInspectEl.getBoundingClientRect(),state=SIM.realtimeFlightState().cockpit.engine_quadrant;return{overflow:document.documentElement.scrollWidth-innerWidth,state,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom},inspect:{left:inspect.left,right:inspect.right,top:inspect.top,bottom:inspect.bottom,hidden:instrumentInspectEl.getAttribute("aria-hidden")}};});
  await page.screenshot({path:path.join(artifacts,"cockpit-engine-quadrant-mobile.png")});

  const inViewport=point=>point.x>=0&&point.x<=point.viewport.width&&point.y>=0&&point.y<=point.viewport.height;
  const checks={
    assetServed:asset.status()===200&&assetBytes>800000,
    namedPhysicalAsset:initial.quadrant.asset==="loaded"&&initial.quadrant.physical_meshes>=20&&initial.quadrant.named_pivots.includes("throttle")&&initial.quadrant.named_pivots.includes("mixture"),
    controlsVisible:inViewport(throttlePoint)&&inViewport(mixturePoint),
    hoverInspection:hover.quadrant.hovered==="throttle"&&hover.inspect.name==="THROTTLE"&&hover.inspect.source.includes("PHYSICAL")&&hover.inspect.range.includes("TAKEOFF 100")&&hover.inspect.hidden==="false"&&hover.lift>.05,
    directThrottle:powered.quadrant.throttle_percent>=65&&powered.dock.throttle_command_percent===powered.quadrant.throttle_percent&&powered.events.some(event=>event.control==="throttle"&&event.value===powered.quadrant.throttle_percent),
    directMixtureLimit:cutoff.quadrant.mixture_percent<=8&&cutoff.dock.mixture_setting_percent===cutoff.quadrant.mixture_percent&&cutoff.engine.band==="cutoff"&&!cutoff.engine.running&&cutoff.inspect.name==="MIXTURE"&&cutoff.inspect.state==="limit"&&cutoff.events.some(event=>event.control==="mixture"&&event.value===cutoff.quadrant.mixture_percent),
    realtimeGrounded:cutoff.quadrant.readouts.mixture.boundary==="limit"&&cutoff.quadrant.readouts.mixture.value.includes("CUTOFF")&&cutoff.dock.focused_control==="mixture",
    compactDockPreserved:!initial.dock.expanded&&initial.body.includes("cockpit-dock-compact"),
    mobileOperable:mobile.overflow<=0&&inViewport(mobileThrottle)&&inViewport(mobileMixture)&&mobile.state.throttle_percent>0&&mobile.inspect.left>=0&&mobile.inspect.right<=390&&mobile.inspect.bottom<=mobile.dock.top,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,asset:{status:asset.status(),bytes:assetBytes},initial,points:{throttle:throttlePoint,mixture:mixturePoint},hover,powered,cutoff,mobileThrottle,mobileMixture,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-engine-quadrant-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,asset:report.asset,points:report.points,hover,powered,cutoff,mobileThrottle,mobileMixture,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
