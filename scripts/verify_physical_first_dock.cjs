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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=false;SIM.setCam(1);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded,null,{timeout:30000});
  await page.waitForTimeout(300);

  const readLayout=()=>page.evaluate(()=>{
    const projectBox=object=>{object.updateMatrixWorld(true);camera.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object),corners=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera));const rect=sceneCanvas.getBoundingClientRect(),left=rect.left+(Math.min(...corners.map(point=>point.x))+1)*rect.width/2,top=rect.top+(1-Math.max(...corners.map(point=>point.y)))*rect.height/2,right=rect.left+(Math.max(...corners.map(point=>point.x))+1)*rect.width/2,bottom=rect.top+(1-Math.min(...corners.map(point=>point.y)))*rect.height/2;return{left,right,top,bottom,cx:(left+right)/2,cy:(top+bottom)/2};};
    const dock=cockpitDockEl.getBoundingClientRect(),cueRect=cue.getBoundingClientRect();
    return{state:SIM.cockpitDock(),panel:SIM.cockpitPanel(),title:cockpitDockTitle.textContent,toggle:cockpitDockToggle.getAttribute("aria-label"),body:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-body")).display,brief:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-brief")).display,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,width:dock.width,height:dock.height},cue:{top:cueRect.top,bottom:cueRect.bottom},controls:{systems:projectBox(cockpitSystemsConsole),engine:projectBox(cockpitEngineQuadrant),flight:projectBox(cockpitFlightControls),yoke:projectBox(cockpitYoke)},overflow:document.documentElement.scrollWidth-innerWidth};
  });
  const initial=await readLayout();
  await page.evaluate(()=>{const transient=document.getElementById("banner");if(transient)transient.style.display="none";});
  await page.screenshot({path:path.join(artifacts,"cockpit-physical-first-desktop.png")});

  const batteryPoint=await page.evaluate(()=>{const center=new THREE.Box3().setFromObject(COCKPIT_SYSTEMS_GROUPS.battery).getCenter(new THREE.Vector3()).project(camera),rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2};});
  await page.mouse.click(batteryPoint.x,batteryPoint.y);
  await page.waitForFunction(()=>!SIM.electrical().masterOn);
  const physicalControl=await page.evaluate(()=>({dock:SIM.cockpitDock(),electrical:SIM.electrical(),systems:SIM.cockpitSystems(),realtime:SIM.realtimeFlightState().cockpit.controls,events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&(event.type==="cockpit_control"||event.type==="electrical_switch")).map(event=>({type:event.type,data:event.data}))}));
  await page.evaluate(()=>{SIM.setBatteryMaster(true);SIM.setAlternatorSwitch(true);updateCockpitDock();syncGraphics(.016);});

  await page.click("#cockpitDockToggle");
  await page.waitForFunction(()=>SIM.cockpitDock().expanded);
  const accessible=await readLayout();
  await page.screenshot({path:path.join(artifacts,"cockpit-physical-first-controls-desktop.png")});
  await page.click("#cockpitDockToggle");
  await page.waitForFunction(()=>!SIM.cockpitDock().expanded);

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{COCKPIT_SYSTEMS_FOCUS.hover="";COCKPIT_SYSTEMS_FOCUS.locked="";COCKPIT_DOCK.focus="";document.body.classList.remove("instrument-inspecting");updateCamera(.016);syncGraphics(.016);updateCockpitDock();renderCockpitInstrumentInspect();});
  await page.waitForTimeout(300);
  const mobile=await readLayout();
  await page.screenshot({path:path.join(artifacts,"cockpit-physical-first-mobile.png")});

  const inViewport=(box,width,height)=>box.cx>=0&&box.cx<=width&&box.cy>=0&&box.cy<=height;
  const checks={
    physicalFirstDefault:initial.state.physical_controls_ready&&!initial.state.expanded&&initial.state.physical_first_collapsed&&initial.state.presentation==="physical-first"&&initial.title==="SYSTEMS READY"&&initial.toggle==="Open accessible cockpit controls",
    compactStatusOnly:initial.body==="none"&&initial.brief==="none"&&initial.dock.height<=31&&initial.dock.width<=561&&initial.cue.bottom<=initial.dock.top,
    physicalAssetsPrimary:Object.values(initial.panel.physical_assets).every(status=>status==="loaded")&&Object.values(initial.panel.external_overlays).every(display=>display==="none")&&Object.values(initial.controls).every(box=>inViewport(box,1440,900)),
    physicalControlOperable:!physicalControl.electrical.masterOn&&!physicalControl.systems.battery_master_on&&!physicalControl.realtime.battery_master_on&&physicalControl.events.some(event=>event.data?.control==="battery_master"||event.data?.switch==="battery_master"),
    accessibleFallback:accessible.state.expanded&&accessible.state.presentation==="full-controls"&&accessible.title==="ACCESSIBLE CONTROLS"&&accessible.body==="block"&&accessible.brief==="grid"&&accessible.toggle==="Collapse cockpit controls"&&accessible.cue.bottom<=accessible.dock.top,
    mobileFit:mobile.overflow<=0&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.dock.height<=31&&mobile.cue.bottom<=mobile.dock.top,
    mobilePhysicalControls:mobile.state.presentation==="physical-first"&&Object.values(mobile.controls).every(box=>inViewport(box,390,844)),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,batteryPoint,physicalControl,accessible,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-physical-first-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial,batteryPoint,physicalControl,accessible,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
