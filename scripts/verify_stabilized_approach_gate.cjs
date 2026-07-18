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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.setCam(1);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded,null,{timeout:30000});

  const stage=options=>page.evaluate(options=>{
    const speed=options.speed??65,flaps=options.flaps??.5,sink=options.sink??2,z=options.z??1160,x=options.x??0;
    S.paused=true;MISSION.idx=Math.max(0,MISSION.legs.length-1);MISSION.done=false;INS.mode=0;PREFLIGHT.departureBlocked=false;GO_AROUND.active=false;APPROACH.active=true;APPROACH.awarded=false;S.phase="approach";S.onGround=false;S.wasAirborne=true;S.crashed=false;S.quat.identity();S.ias=speed/KT;S.vsi=-sink;S.flapSet=flaps;S.flapPos=flaps;S.vel.set(0,-sink,-speed/KT);
    const probe=runwayApproachCoordinates(activeArrivalRunway(),x,z),desired=APPROACH_SYSTEM.flareAgl+Math.max(0,probe.along)*Math.tan(APPROACH_SYSTEM.slopeRad),agl=options.agl??desired;
    S.pos.set(x,CFG.restY+terrainH(x,z)+agl,z);updateCamera(.016);syncGraphics(.016);updateCockpitDock();return SIM.approachGate();
  },options);
  const read=()=>page.evaluate(()=>{
    const rect=node=>{const box=node.getBoundingClientRect();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};};
    return{gate:SIM.approachGate(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().safe_landing.approach_gate,ui:{display:getComputedStyle(approachGateEl).display,state:approachGateEl.dataset.state,status:approachGateStatus.textContent,agl:approachGateAgl.value,aria:approachGateEl.getAttribute("aria-label"),gate:rect(approachGateEl),dock:rect(cockpitDockEl),items:[...approachGateEl.querySelectorAll("[data-gate]")].map(item=>({id:item.dataset.gate,pass:item.dataset.pass,value:item.querySelector("output").value,aria:item.getAttribute("aria-label"),box:rect(item)}))},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="approach_gate").map(event=>event.data),sent:window.__gateEvents||[],approach:SIM.approach()};
  });

  await stage({speed:80,flaps:.5,sink:2,z:1160});await page.evaluate(()=>{S.simTime+=1;updateCockpitDock();});
  const correctable=await read();
  await stage({speed:65,flaps:.5,sink:2,z:1160});await page.evaluate(()=>{S.simTime+=1;updateCockpitDock();monitorStabilizedFinal(65);});
  const stable=await read();
  const dry=stable.gate.landing_distance;

  await page.evaluate(()=>setLevel("storm",false));
  await stage({speed:65,flaps:.5,sink:2,z:1160});
  const wet=await read();

  await page.evaluate(()=>{window.__gateEvents=[];AVIATOR.status="LIVE";AVIATOR.eventAt={};AVIATOR.dc={readyState:"open",send(payload){window.__gateEvents.push(JSON.parse(payload));}};APPROACH_GATE.pendingKey="";APPROACH_GATE.voiceKey="";APPROACH_GATE.voiceAt=-999;});
  await stage({speed:82,flaps:0,sink:7,z:910,agl:25});await page.evaluate(()=>{S.simTime+=1;updateCockpitDock();monitorStabilizedFinal(82);});
  const goAround=await read();
  await page.evaluate(()=>{bannerEl.style.display="none";missionHud.style.display="none";cue.style.display="none";updateCamera(.016);syncGraphics(.016);});
  await page.screenshot({path:path.join(artifacts,"cockpit-approach-gate-desktop.png")});

  const serverSource=fs.readFileSync(path.join(project,"server/aviator-session.mjs"),"utf8");
  const voicePrompt=goAround.sent.find(event=>event.type==="conversation.item.create")?.item?.content?.[0]?.text||"";
  const voiceResponse=goAround.sent.find(event=>event.type==="response.create")?.response||{};
  const ids=["speed","configuration","alignment","glide","descent","runway"];
  const layout=goAround.ui.display==="grid"&&goAround.ui.gate.left>=goAround.ui.dock.left&&goAround.ui.gate.right<=goAround.ui.dock.right&&goAround.ui.items.length===6&&goAround.ui.items.every(item=>item.box.scrollWidth<=item.box.clientWidth+1);
  const checks={
    sixFactorContract:correctable.gate.criteria.map(item=>item.id).join(",")===ids.join(",")&&correctable.gate.training_reference_only,
    correctableHighFinal:correctable.gate.state==="correct"&&correctable.gate.failed.length===1&&correctable.gate.failed[0]==="speed"&&correctable.gate.agl_m>30&&correctable.ui.status==="CORRECT 1",
    fullyStabilized:stable.gate.state==="stable"&&stable.gate.criteria.every(item=>item.pass)&&stable.ui.state==="stable"&&stable.approach.stableSeconds>0,
    sharedRealtimeState:stable.realtime.state===stable.gate.state&&stable.realtime.criteria.every((item,index)=>item.pass===stable.gate.criteria[index].pass)&&stable.realtime.training_reference_only,
    surfaceAdjustedDistance:dry.surface==="dry"&&wet.gate.landing_distance.surface==="wet"&&wet.gate.landing_distance.estimated_m>dry.estimated_m,
    decisionHeightGoAround:goAround.gate.state==="go-around"&&goAround.gate.at_decision_height&&goAround.gate.failed.includes("speed")&&goAround.gate.failed.includes("configuration")&&goAround.gate.failed.includes("descent")&&goAround.ui.status==="GO AROUND"&&goAround.dock.training_standard.id==="go-around-gate"&&goAround.dock.training_standard.status==="GO AROUND",
    scoringUsesSameGate:goAround.approach.status.startsWith("GO AROUND -")&&goAround.approach.status.includes(goAround.gate.primary_action),
    groundedRealtimeCommand:voicePrompt.includes("25 metres AGL")&&voicePrompt.includes("Stabilized approach gate failed")&&voiceResponse.max_output_tokens===80&&/one stern, calm command/i.test(voiceResponse.instructions||""),
    blackBoxEvidence:goAround.events.some(event=>event.state==="go-around"&&event.agl_m===25&&event.failed.includes("configuration")&&event.criteria.runway&&Number.isFinite(event.landing_distance.margin_m)),
    desktopCockpitFit:layout&&goAround.ui.aria.includes("Training reference only"),
    explicitNonRegulatoryGuardrail:serverSource.includes("Never call this regulatory approval"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,correctable,stable,dry,wet,goAround,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-approach-gate-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,correctable:correctable.gate,stable:stable.gate,wet:wet.gate.landing_distance,goAround:{gate:goAround.gate,approach:goAround.approach,voicePrompt,voiceResponse,events:goAround.events},errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
