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
  await page.goto(baseUrl,{waitUntil:"commit"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=false;SIM.setCam(1);setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>Object.values(SIM.cockpitPanel().physical_assets).every(status=>status==="loaded"),null,{timeout:30000});
  await page.waitForTimeout(500);

  const layout=()=>page.evaluate(()=>{
    const projectBox=object=>{object.updateMatrixWorld(true);camera.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(object),corners=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera));const rect=sceneCanvas.getBoundingClientRect(),left=(Math.min(...corners.map(point=>point.x))+1)*rect.width/2,top=(1-Math.max(...corners.map(point=>point.y)))*rect.height/2,right=(Math.max(...corners.map(point=>point.x))+1)*rect.width/2,bottom=(1-Math.min(...corners.map(point=>point.y)))*rect.height/2;return{left,right,top,bottom,width:right-left,height:bottom-top,cx:(left+right)/2,cy:(top+bottom)/2};};
    return{panel:SIM.cockpitPanel(),shell:projectBox(cockpitPanelShell),gauges:projectBox(cockpitInstrumentPack),yoke:projectBox(cockpitYoke),systems:projectBox(cockpitSystemsConsole),engine:projectBox(cockpitEngineQuadrant),flight:projectBox(cockpitFlightControls),dock:(()=>{const rect=cockpitDockEl.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,height:rect.height};})(),overflow:document.documentElement.scrollWidth-innerWidth};
  });
  const initial=await layout();
  const batteryPoint=await page.evaluate(()=>{const center=new THREE.Box3().setFromObject(COCKPIT_SYSTEMS_GROUPS.battery).getCenter(new THREE.Vector3()).project(camera),rect=sceneCanvas.getBoundingClientRect();return{x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2};});
  await page.mouse.click(batteryPoint.x,batteryPoint.y);await page.waitForFunction(()=>SIM.cockpitPanel().lamps.bus.state==="off");
  const batteryOff=await page.evaluate(()=>({panel:SIM.cockpitPanel(),electrical:SIM.electrical(),systems:SIM.cockpitSystems()}));
  await page.evaluate(()=>{SIM.setBatteryMaster(true);SIM.setAlternatorSwitch(true);SIM.setPitotHeat(true);SIM.setIgnition("both");acknowledgeDeparture();syncGraphics(.016);updateCamera(.016);});
  await page.waitForFunction(()=>SIM.cockpitPanel().lamps.bus.state==="on"&&SIM.cockpitPanel().lamps.check.state==="on");
  const restored=await page.evaluate(()=>({panel:SIM.cockpitPanel(),realtime:SIM.realtimeFlightState().cockpit.panel,preflight:SIM.preflight()}));
  await page.evaluate(()=>{const transient=document.getElementById("banner");if(transient)transient.style.display="none";});
  await page.screenshot({path:path.join(artifacts,"cockpit-integrated-panel-desktop.png")});

  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});await page.waitForTimeout(300);
  const mobile=await layout();
  await page.screenshot({path:path.join(artifacts,"cockpit-integrated-panel-mobile.png")});

  const centerInside=(box,width,height)=>box.cx>=0&&box.cx<=width&&box.cy>=0&&box.cy<=height;
  const checks={
    integratedPhysicalPanel:initial.panel.integrated&&initial.panel.layout==="desktop"&&initial.panel.shell_visible&&Object.values(initial.panel.physical_assets).every(status=>status==="loaded"),
    legacyOverlaysRemoved:Object.values(initial.panel.external_overlays).every(display=>display==="none"),
    groundedAnnunciators:initial.panel.lamps.bus.state==="on"&&initial.panel.lamps.engine.state==="on"&&initial.panel.lamps.pitot.state==="on"&&initial.panel.lamps.check.state==="warn",
    physicalBatteryInteraction:batteryPoint.x>=0&&batteryPoint.x<=1440&&batteryPoint.y>=0&&batteryPoint.y<=900&&!batteryOff.electrical.masterOn&&batteryOff.panel.lamps.bus.state==="off"&&!batteryOff.systems.battery_master_on,
    restoredCheckLamp:restored.preflight.armed&&restored.panel.lamps.bus.state==="on"&&restored.panel.lamps.check.state==="on"&&restored.panel.lamps.check.value==="CLEAR",
    realtimeParity:JSON.stringify(restored.panel)===JSON.stringify(restored.realtime),
    desktopComposition:[initial.gauges,initial.yoke,initial.systems,initial.engine,initial.flight].every(box=>centerInside(box,1440,900))&&initial.gauges.width>650&&initial.yoke.cy>initial.gauges.cy,
    mobileComposition:mobile.overflow<=0&&mobile.panel.layout==="compact"&&[mobile.gauges,mobile.yoke,mobile.systems,mobile.engine,mobile.flight].every(box=>centerInside(box,390,844))&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,batteryPoint,batteryOff,restored,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-integrated-panel-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial,batteryPoint,batteryOff,restored,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
