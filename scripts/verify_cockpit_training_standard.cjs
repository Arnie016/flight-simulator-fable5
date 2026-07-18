#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8644";

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.setCam(1);updateCamera(.016);syncGraphics(.016);updateCockpitDock();});
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded,null,{timeout:30000});
  await page.waitForTimeout(300);

  const read=()=>page.evaluate(()=>{
    const box=node=>{const rect=node.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};};
    return{standard:SIM.trainingStandard(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.controls.training_standard,ui:{label:cockpitStandardLabel.textContent,value:cockpitStandardValue.textContent,status:cockpitStandardStatus.textContent,state:cockpitStandard.dataset.state,aria:cockpitStandard.getAttribute("aria-label"),standard:box(cockpitStandard),labelBox:box(cockpitStandardLabel),valueBox:box(cockpitStandardValue),statusBox:box(cockpitStandardStatus),dock:box(cockpitDockEl)},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="training_standard").map(event=>event.data)};
  });

  const preflight=await read();
  await page.evaluate(()=>{PREFLIGHT.armed=true;S.phase="takeoff-roll";S.onGround=true;S.ias=48/KT;updateCockpitDock();});
  const buildSpeed=await read();
  await page.evaluate(()=>{S.ias=57/KT;updateCockpitDock();});
  const rotate=await read();
  await page.evaluate(()=>{document.getElementById("banner").style.display="none";document.getElementById("cue").style.display="none";});
  await page.screenshot({path:path.join(artifacts,"cockpit-training-standard-desktop.png")});

  await page.evaluate(()=>{S.phase="climb";S.onGround=false;S.wasAirborne=true;S.ias=80/KT;S.vsi=2.1;updateCockpitDock();});
  const climb=await read();
  await page.evaluate(()=>{S.phase="approach";S.onGround=false;S.flapSet=.5;S.flapPos=.5;S.ias=80/KT;S.vsi=-2;APPROACH.active=true;APPROACH.awarded=false;updateCockpitDock();});
  const fastFinal=await read();
  await page.evaluate(()=>{S.ias=65/KT;updateCockpitDock();});
  const stableFinal=await read();
  await page.evaluate(()=>{S.phase="flare";S.vsi=-1;updateCockpitDock();});
  const flare=await read();
  await page.evaluate(()=>{S.phase="rollout";S.onGround=true;S.wasAirborne=true;S.vel.set(0,0,-18);updateCockpitDock();});
  const rollout=await read();

  const fit=rotate.ui.standard.left>=rotate.ui.dock.left&&rotate.ui.standard.right<=rotate.ui.dock.right&&rotate.ui.dock.width<=561&&[rotate.ui.labelBox,rotate.ui.valueBox,rotate.ui.statusBox].every(field=>field.scrollWidth<=field.clientWidth+1);
  const checks={
    preflightMeasured:preflight.standard.id==="preflight"&&preflight.standard.value==="8 / 8"&&preflight.standard.status==="VERIFY"&&preflight.ui.state==="caution",
    takeoffCorrection:buildSpeed.standard.id==="rotate"&&buildSpeed.standard.state==="caution"&&buildSpeed.standard.status==="BUILD SPEED"&&buildSpeed.standard.value==="48 KT",
    rotateBand:rotate.standard.id==="rotate"&&rotate.standard.state==="normal"&&rotate.standard.status==="ROTATE"&&rotate.standard.measured===57,
    climbBand:climb.standard.id==="climb-ias"&&climb.standard.state==="normal"&&climb.standard.normal_min===75&&climb.standard.normal_max===85,
    finalCorrection:fastFinal.standard.id==="final-ias"&&fastFinal.standard.state==="caution"&&fastFinal.standard.status==="REDUCE SPEED",
    stabilizedFinal:stableFinal.standard.id==="final-stable"&&stableFinal.standard.state==="normal"&&stableFinal.standard.value==="65 KT",
    touchdownEnvelope:flare.standard.id==="touchdown"&&flare.standard.state==="normal"&&flare.standard.status==="GREASER RANGE",
    rolloutUsesStoppingModel:rollout.standard.id==="stop-margin"&&rollout.standard.value.includes(" / ")&&Number.isFinite(rollout.standard.measured),
    realtimeGrounded:stableFinal.realtime.id===stableFinal.standard.id&&stableFinal.realtime.measured===stableFinal.standard.measured&&stableFinal.realtime.normal_min===stableFinal.standard.normal_min,
    blackBoxTransitions:rollout.events.some(event=>event.id==="rotate"&&event.state==="normal")&&rollout.events.some(event=>event.id==="climb-ias")&&rollout.events.some(event=>event.id==="final-ias")&&rollout.events.some(event=>event.id==="touchdown"),
    desktopInstrumentFit:fit&&rotate.ui.aria.includes("normal range 55 to 62"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,preflight,buildSpeed,rotate,climb,fastFinal,stableFinal,flare,rollout,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-training-standard-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,states:{preflight:preflight.standard,buildSpeed:buildSpeed.standard,rotate:rotate.standard,climb:climb.standard,fastFinal:fastFinal.standard,stableFinal:stableFinal.standard,flare:flare.standard,rollout:rollout.standard},errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
