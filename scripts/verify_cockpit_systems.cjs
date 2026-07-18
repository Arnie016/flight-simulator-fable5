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
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[],assets={};
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  page.on("response",response=>{const name=response.url().split("/").at(-1);if(name?.endsWith(".glb"))assets[name]={status:response.status(),type:response.headers()["content-type"]||""};});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}document.getElementById("boot").style.display="none";document.body.classList.remove("booting");SIM.setCam(1);SIM.setTurb(1.2);});
  await page.waitForFunction(()=>COCKPIT_YOKE_ASSET.status==="loaded"&&COCKPIT_COMPASS_ASSET.status==="loaded"&&COCKPIT_INSTRUMENT_ASSET.status==="loaded"&&COCKPIT_ENGINE_ASSET.status==="loaded"&&COCKPIT_SYSTEMS_ASSET.status==="loaded"&&COCKPIT_FLIGHT_ASSET.status==="loaded",null,{timeout:30000});
  await page.waitForTimeout(500);
  const motionA=await page.evaluate(()=>({camera:camera.position.toArray(),hands:cockpitHands.map(hand=>[hand.position.y,hand.rotation.x])}));
  await page.evaluate(()=>SIM.warp(.25));
  const motionB=await page.evaluate(()=>({camera:camera.position.toArray(),hands:cockpitHands.map(hand=>[hand.position.y,hand.rotation.x])}));
  await page.screenshot({path:path.join(artifacts,"cockpit-systems-v2.png")});

  const cockpit=await page.evaluate(()=>{
    const clip=document.getElementById("clipControls").getBoundingClientRect(),needleStart=cockpitCompassNeedle?.rotation.z||0,saved=S.quat.clone();
    S.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);syncGraphics(.016);const needleTurn=cockpitCompassNeedle?.rotation.z||0;S.quat.copy(saved);syncGraphics(.016);
    return{body:[...document.body.classList],assets:{yoke:COCKPIT_YOKE_ASSET.status,compass:COCKPIT_COMPASS_ASSET.status,instruments:COCKPIT_INSTRUMENT_ASSET.status,engineQuadrant:COCKPIT_ENGINE_ASSET.status,systemsConsole:COCKPIT_SYSTEMS_ASSET.status,flightControls:COCKPIT_FLIGHT_ASSET.status},hands:cockpitHands.length,physicalPanel:Boolean(cockpitInstrumentPack&&!cockpitPanelFace?.visible),needleDelta:Math.abs(needleTurn-needleStart),hidden:{panel:getComputedStyle(panel).display,bigSpeed:getComputedStyle(document.getElementById("bigSpd")).display,map:getComputedStyle(routeMapEl).display,instructor:getComputedStyle(document.getElementById("inst")).display},clip:{display:getComputedStyle(document.getElementById("clipControls")).display,top:clip.top,bottom:clip.bottom},systems:SIM.realtimeFlightState().aircraft_systems,cockpitState:SIM.realtimeFlightState().cockpit};
  });
  const chase=await page.evaluate(()=>{SIM.setCam(0);updateCamera(.016);return{panel:getComputedStyle(panel).display,bigSpeed:getComputedStyle(document.getElementById("bigSpd")).display,body:[...document.body.classList]};});

  const debrief=await page.evaluate(()=>{
    SCORE.value=83;SCORE.grade="B";SCORE.tdSink=1.3;SCORE.tdOff=4;DEBRIEF.visible=true;debriefEl.classList.add("show");
    AVIATOR.status="REALTIME VOICE OFFLINE";requestAviatorDebrief();const offline=debriefAviatorText.textContent;
    const sent=[];AVIATOR.status="LIVE";AVIATOR.dc={readyState:"open",send:payload=>sent.push(JSON.parse(payload))};AVIATOR.micEnabled=false;requestAviatorDebrief();
    const pending=DEBRIEF.aviatorPending;handleAviatorEvent({type:"response.output_audio_transcript.done",transcript:"Strength: smooth recovery. Correction: trim earlier. Next drill: one calmer circuit, because wrestling the yoke is not a personality."});
    return{offline,sent,pending,review:debriefAviatorText.textContent,pendingAfter:DEBRIEF.aviatorPending,mic:AVIATOR.micEnabled};
  });
  await page.screenshot({path:path.join(artifacts,"realtime-debrief-v2.png")});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{hideDebrief();SIM.setCam(1);updateCamera(.016);});await page.waitForTimeout(300);
  await page.screenshot({path:path.join(artifacts,"cockpit-systems-v2-mobile.png")});
  const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,mission:(()=>{const r=missionHud.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};})(),record:(()=>{const r=document.getElementById("clipControls").getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};})(),panel:getComputedStyle(panel).display,navigator:getComputedStyle(navDirector).display}));
  const eventText=debrief.sent.find(event=>event.item?.content?.[0]?.text)?.item.content[0].text||"";
  const checks={
    cockpitAssetsServed:assets["flight_control_yoke_textured.glb"]?.status===200&&assets["pirate_astrolabe_compass_textured.glb"]?.status===200&&assets["primary_instrument_pack.glb"]?.status===200&&assets["engine_control_quadrant.glb"]?.status===200&&assets["flight_systems_console.glb"]?.status===200&&assets["flight_controls_pedestal.glb"]?.status===200,
    cockpitAssetsLoaded:cockpit.assets.yoke==="loaded"&&cockpit.assets.compass==="loaded"&&cockpit.assets.instruments==="loaded"&&cockpit.assets.engineQuadrant==="loaded"&&cockpit.assets.systemsConsole==="loaded"&&cockpit.assets.flightControls==="loaded"&&cockpit.physicalPanel,
    cockpitHudIntegrated:cockpit.hidden.panel==="none"&&cockpit.hidden.bigSpeed==="none"&&cockpit.hidden.map==="none"&&cockpit.hidden.instructor==="none"&&cockpit.cockpitState.external_instrument_overlay===false,
    animatedHandsAndMotion:cockpit.hands===2&&JSON.stringify(motionA)!==JSON.stringify(motionB),
    liveCompass:cockpit.needleDelta>1,
    recordingStillReachable:cockpit.clip.display==="flex"&&cockpit.clip.top<200,
    chaseOverlayRestored:chase.panel==="block"&&chase.bigSpeed==="block"&&!chase.body.includes("cockpit-view"),
    truthfulSystems:cockpit.systems.fuel_estimate_only===true&&cockpit.systems.waste_system==="not installed on this trainer",
    offlineDebrief:debrief.offline.includes("83/100")&&debrief.offline.includes("Connect GPT Realtime"),
    groundedRealtimeDebrief:debrief.pending&&eventText.includes('"score":83')&&eventText.includes('"touchdown_sink_mps":1.3')&&debrief.review.startsWith("Strength:")&&!debrief.pendingAfter&&!debrief.mic,
    mobileFit:mobile.overflow<=0&&mobile.panel==="none"&&mobile.navigator==="none"&&mobile.mission.left>=0&&mobile.mission.right<=390&&mobile.mission.top>=0&&mobile.mission.right<=mobile.record.left,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,assets,cockpit,motion:{a:motionA,b:motionB},chase,debrief,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-systems-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,cockpit,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
