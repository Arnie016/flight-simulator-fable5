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
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],assets={};
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  page.on("response",response=>{const name=response.url().split("/").at(-1);if(name?.endsWith(".glb"))assets[name]={status:response.status(),type:response.headers()["content-type"]||""};});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}document.getElementById("boot").style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.setCam(1);setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>COCKPIT_INSTRUMENT_ASSET.status==="loaded",null,{timeout:30000});
  await page.waitForTimeout(450);

  const baseline=await page.evaluate(()=>{
    const nodes=COCKPIT_INSTRUMENT_ASSET.nodes;
    return{state:SIM.cockpitInstruments(),canvasFallbackVisible:cockpitPanelFace.visible,pivots:{airspeed:nodes.Airspeed_NeedlePivot.rotation.z,roll:nodes.Attitude_RollPivot.rotation.z,pitch:nodes.Attitude_PitchSlide.position.y,altimeter:nodes.Altimeter_NeedlePivot.rotation.z,vsi:nodes.VSI_NeedlePivot.rotation.z,heading:nodes.Heading_CardPivot.rotation.z}};
  });
  const driven=await page.evaluate(()=>{
    S.ias=82/KT;S.pitotIce=0;S.vsi=6.7;S.pos.y=CFG.restY+438;S.quat.setFromEuler(new THREE.Euler(.16,.72,-.24,"YXZ"));syncGraphics(.016);updateCamera(.016);
    const nodes=COCKPIT_INSTRUMENT_ASSET.nodes,rootBox=new THREE.Box3().setFromObject(cockpitInstrumentPack),corners=[];
    for(const x of[rootBox.min.x,rootBox.max.x])for(const y of[rootBox.min.y,rootBox.max.y])for(const z of[rootBox.min.z,rootBox.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera));
    const sceneRect=sceneCanvas.getBoundingClientRect(),screen={left:(Math.min(...corners.map(point=>point.x))+1)*sceneRect.width/2,top:(1-Math.max(...corners.map(point=>point.y)))*sceneRect.height/2,right:(Math.max(...corners.map(point=>point.x))+1)*sceneRect.width/2,bottom:(1-Math.min(...corners.map(point=>point.y)))*sceneRect.height/2};
    renderer.render(scene,camera);const gl=renderer.getContext(),sx=renderer.domElement.width/sceneRect.width,sy=renderer.domElement.height/sceneRect.height,x=Math.max(0,Math.floor(screen.left*sx)),y=Math.max(0,Math.floor((sceneRect.height-screen.bottom)*sy)),width=Math.min(renderer.domElement.width-x,Math.max(1,Math.floor((screen.right-screen.left)*sx))),height=Math.min(renderer.domElement.height-y,Math.max(1,Math.floor((screen.bottom-screen.top)*sy))),pixels=new Uint8Array(width*height*4);gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let dark=0,bright=0,samples=0;const bins=new Set();for(let index=0;index<pixels.length;index+=16){const r=pixels[index],g=pixels[index+1],b=pixels[index+2],lum=(r+g+b)/3;samples++;if(lum<48)dark++;if(lum>150)bright++;bins.add((r>>4)+","+(g>>4)+","+(b>>4));}const pixelStats={samples,darkRatio:dark/samples,brightRatio:bright/samples,colorBins:bins.size};
    const airspeedBox=new THREE.Box3().setFromObject(COCKPIT_INSTRUMENT_GROUPS.airspeed),center=airspeedBox.getCenter(new THREE.Vector3()).project(camera),point={x:sceneRect.left+(center.x+1)*sceneRect.width/2,y:sceneRect.top+(1-center.y)*sceneRect.height/2};
    return{state:SIM.cockpitInstruments(),screen,pixelStats,point,pivots:{airspeed:nodes.Airspeed_NeedlePivot.rotation.z,roll:nodes.Attitude_RollPivot.rotation.z,pitch:nodes.Attitude_PitchSlide.position.y,altimeter:nodes.Altimeter_NeedlePivot.rotation.z,vsi:nodes.VSI_NeedlePivot.rotation.z,heading:nodes.Heading_CardPivot.rotation.z}};
  });
  await page.screenshot({path:path.join(artifacts,"cockpit-primary-instruments-desktop.png")});
  await page.mouse.move(driven.point.x,driven.point.y);await page.waitForTimeout(160);
  const hover=await page.evaluate(()=>({state:SIM.cockpitInstruments(),overlay:{hidden:instrumentInspectEl.getAttribute("aria-hidden"),display:getComputedStyle(instrumentInspectEl).display,name:instrumentInspectName.textContent,value:instrumentInspectValue.textContent,range:instrumentInspectRange.textContent}}));
  await page.mouse.click(driven.point.x,driven.point.y);await page.evaluate(()=>{S.pitotIce=.4;syncGraphics(.016);renderCockpitInstrumentInspect();});await page.waitForTimeout(100);
  const locked=await page.evaluate(()=>({state:SIM.cockpitInstruments(),realtime:SIM.realtimeFlightState().cockpit.primary_instruments,overlay:{hidden:instrumentInspectEl.getAttribute("aria-hidden"),state:instrumentInspectEl.dataset.state,name:instrumentInspectName.textContent,value:instrumentInspectValue.textContent,range:instrumentInspectRange.textContent},extrusion:COCKPIT_INSTRUMENT_GROUPS.airspeed.position.z-COCKPIT_INSTRUMENT_GROUPS.airspeed.userData.basePosition.z}));
  await page.screenshot({path:path.join(artifacts,"cockpit-primary-instrument-inspect-desktop.png")});

  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setCockpitDockExpanded(false,true);updateCamera(.016);syncGraphics(.016);renderCockpitInstrumentInspect();});await page.waitForTimeout(280);
  const mobile=await page.evaluate(()=>{const overlay=instrumentInspectEl.getBoundingClientRect(),scene=sceneCanvas.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,overlay:{left:overlay.left,right:overlay.right,top:overlay.top,bottom:overlay.bottom,display:getComputedStyle(instrumentInspectEl).display},scene:{width:scene.width,height:scene.height},state:SIM.cockpitInstruments()};});
  await page.screenshot({path:path.join(artifacts,"cockpit-primary-instruments-mobile.png")});

  const pivotDelta=Object.fromEntries(Object.keys(driven.pivots).map(key=>[key,Math.abs(driven.pivots[key]-baseline.pivots[key])]));
  const exactPivots=["Airspeed_NeedlePivot","Attitude_RollPivot","Attitude_PitchSlide","Altimeter_NeedlePivot","VSI_NeedlePivot","Heading_CardPivot"];
  const checks={
    assetServed:assets["primary_instrument_pack.glb"]?.status===200,
    physicalPackLoaded:baseline.state.asset==="loaded"&&!baseline.state.canvas_fallback&&!baseline.canvasFallbackVisible&&baseline.state.physical_meshes>=80,
    namedPivots:exactPivots.every(name=>baseline.state.named_pivots.includes(name)),
    telemetryDrivesAllPivots:Object.values(pivotDelta).every(delta=>delta>.01),
    panelFramed:driven.screen.left>=0&&driven.screen.right<=1440&&driven.screen.top>=0&&driven.screen.bottom<=900&&driven.screen.right-driven.screen.left>650&&driven.screen.bottom-driven.screen.top>110,
    renderedPanelPixels:driven.pixelStats.samples>10000&&driven.pixelStats.darkRatio>.25&&driven.pixelStats.brightRatio>.01&&driven.pixelStats.colorBins>25,
    pointerHoverWorks:hover.state.hovered==="airspeed"&&hover.overlay.hidden==="false"&&hover.overlay.display==="grid"&&hover.overlay.name==="AIRSPEED"&&hover.overlay.value.includes("82 KT"),
    pointerLockAndExtrusion:locked.state.locked==="airspeed"&&locked.extrusion>.02,
    failureBoundaryGrounded:locked.state.focused?.boundary==="limit"&&locked.overlay.state==="limit"&&locked.overlay.range.includes("PITOT ICE")&&locked.overlay.value.includes("56 KT"),
    realtimeParity:JSON.stringify(locked.realtime)===JSON.stringify(locked.state),
    mobileFit:mobile.overflow<=0&&mobile.overlay.display==="grid"&&mobile.overlay.left>=0&&mobile.overlay.right<=390&&mobile.overlay.top>=0&&mobile.overlay.bottom<=844,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,assets,baseline,driven:{...driven,pivotDelta},hover,locked,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-primary-instruments-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,pivotDelta,screen:driven.screen,hover:hover.state,locked:locked.state,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
