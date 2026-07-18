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
  const source=fs.readFileSync(path.join(project,"index.html"),"utf8"),config=await import(path.join(project,"server/aviator-session.mjs")),session=config.aviatorSessionConfig();
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{boot.style.display="none";BOOT.active=false;document.body.classList.remove("booting");SIM.reset();S.paused=true;SIM.setCam(1);setAviatorRailExpanded(true);updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready,null,{timeout:30000});

  const interaction=await page.evaluate(()=>{
    const sent=[];AVIATOR.status="LIVE";AVIATOR.micEnabled=true;AVIATOR.audible=true;AVIATOR.eventAt={};AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};
    Object.assign(COCKPIT_DOCK,{standardCoachPendingKey:"",standardCoachPendingAt:0,standardCoachLastKey:"",standardCoachLastId:"",standardCoachLastState:"",standardCoachLastAt:-999});
    BOOT.active=false;S.paused=false;S.crashed=false;INS.mode=0;camMode=1;
    const course=(state,status,measured,signed)=>({id:"route-course",label:"COURSE",value:Math.round(measured)+" DEG",status,state,measured,normal_min:0,normal_max:7,position:Math.min(1,measured/45),band_start:0,band_end:7/45,signed_error_degrees:signed});
    S.simTime=100;const settling=updateTrainingStandardRealtime(course("caution","TURN RIGHT 18 DEG",18,18));
    S.simTime=100.7;const stillSettling=updateTrainingStandardRealtime(course("caution","TURN RIGHT 18 DEG",18,18));
    S.simTime=100.9;const first=updateTrainingStandardRealtime(course("caution","TURN RIGHT 18 DEG",18,18));
    S.simTime=102;const duplicate=updateTrainingStandardRealtime(course("caution","TURN RIGHT 17 DEG",17,17));
    S.simTime=108;const reverseSettling=updateTrainingStandardRealtime(course("caution","TURN LEFT 14 DEG",14,-14));
    S.simTime=109;const reverse=updateTrainingStandardRealtime(course("caution","TURN LEFT 14 DEG",14,-14));
    S.simTime=116;const recoverySettling=updateTrainingStandardRealtime(course("normal","ON COURSE",4,4));
    S.simTime=117;const recovery=updateTrainingStandardRealtime(course("normal","ON COURSE",4,4));
    S.simTime=125;const unrelatedNormal=updateTrainingStandardRealtime({id:"final-stable",label:"STABLE FINAL",value:"65 KT",status:"HOLD",state:"normal",measured:65,normal_min:58,normal_max:72});
    S.paused=true;S.simTime=130;const paused=updateTrainingStandardRealtime(course("warning","TURN RIGHT 30 DEG",30,30));
    handleAviatorEvent({type:"response.output_audio_transcript.done",transcript:"Course error eighteen degrees. Turn right."});
    updateAviatorUi();document.getElementById("banner").style.display="none";document.getElementById("cue").style.display="none";
    return{sent,results:{settling,stillSettling,first,duplicate,reverseSettling,reverse,recoverySettling,recovery,unrelatedNormal,paused},events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="realtime_standard_coaching").map(event=>event.data),conversation:SIM.aviatorConversation()};
  });
  const visualStandard=await page.evaluate(()=>{
    const target=guideTarget(),rad=Math.PI/180;
    S.paused=true;S.phase="cruise";S.onGround=false;S.wasAirborne=true;S.crashed=false;S.stall=false;S.over=false;S.fail.engine=false;
    MISSION.done=false;PREFLIGHT.departureBlocked=false;ROUTE_GUIDANCE.enabled=true;INS.mode=0;BOARD.visible=false;
    S.pos.set(target[0],terrainH(target[0],target[2])+150,target[2]+1200);
    const bearing=Math.atan2(target[0]-S.pos.x,-(target[2]-S.pos.z)),desiredHeading=bearing-18*rad;
    S.quat.setFromAxisAngle(new THREE.Vector3(0,1,0),-desiredHeading);S.ias=80/KT;S.tas=S.ias;S.vel.set(0,0,-S.ias);S.rpm=2350;
    updateCamera(.016);syncGraphics(.016);updateCockpitDock();
    const standard=SIM.trainingStandard();
    return{...standard,dom:{label:cockpitStandardLabel.textContent,value:cockpitStandardValue.textContent,status:cockpitStandardStatus.textContent}};
  });
  await page.screenshot({path:path.join(artifacts,"realtime-standard-coaching-desktop.png"),fullPage:false});

  const items=interaction.sent.filter(event=>event.type==="conversation.item.create"),responses=interaction.sent.filter(event=>event.type==="response.create"),texts=items.map(event=>event.item?.content?.[0]?.text||"");
  const checks={
    stableBoundaryGate:interaction.results.settling.reason==="settling"&&interaction.results.stillSettling.reason==="settling"&&interaction.results.first.sent===true,
    exactMeasuredCorrection:texts[0]?.includes("course error 18 degrees")&&texts[0]?.includes("TURN RIGHT 18 DEG"),
    deduplicated:interaction.results.duplicate.reason==="cooldown"&&items.length===3&&responses.length===3,
    directionChangeCoached:interaction.results.reverse.sent===true&&texts[1]?.includes("TURN LEFT 14 DEG"),
    verifiedRecoveryOnly:interaction.results.recovery.sent===true&&texts[2]?.includes("Course recovered inside seven degrees")&&interaction.results.unrelatedNormal.reason==="quiet",
    pauseAndSilentGuard:interaction.results.paused.reason==="inactive",
    conciseResponseContract:responses.every(event=>event.response?.max_output_tokens===80&&event.response?.instructions?.includes("under 18 words"))&&session.max_output_tokens===80,
    authoritativeRealtimePrompt:config.aviatorInstructions.includes("cockpit.controls.training_standard")&&config.aviatorInstructions.includes("without inventing a tolerance"),
    blackBoxGrounded:interaction.events.length===3&&interaction.events[0].measured===18&&interaction.events[0].required_correction==="TURN RIGHT 18 DEG"&&interaction.events.every(event=>event.model==="gpt-realtime-2"),
    rightRailTranscript:interaction.conversation.turns.some(turn=>turn.role==="ai"&&turn.text.startsWith("Course error eighteen")),
    visualStandardCoherent:visualStandard.id==="route-course"&&Math.round(visualStandard.measured)===18&&visualStandard.status==="TURN RIGHT 18°"&&visualStandard.dom.label==="COURSE"&&visualStandard.dom.value==="18 DEG"&&visualStandard.dom.status==="TURN RIGHT 18°",
    exactLegacySpeedEvents:source.includes('"Climb airspeed "+Math.round(kt)+" knots')&&source.includes('"Final airspeed "+Math.round(kt)+" knots'),
    realtimeAudioOnly:session.output_modalities.join(",")==="audio"&&!source.includes("speechSynthesis")&&!source.includes("SpeechSynthesisUtterance"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,session:{model:session.model,voice:session.audio.output.voice,max_output_tokens:session.max_output_tokens},visualStandard,interaction:{...interaction,sent:interaction.sent.map(event=>({type:event.type,text:event.item?.content?.[0]?.text||null,response:event.response||null}))},errors};
  fs.writeFileSync(path.join(artifacts,"realtime-standard-coaching-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,visualStandard,results:interaction.results,prompts:texts,events:interaction.events,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
