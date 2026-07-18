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
  const config=await import(path.join(project,"server/aviator-session.mjs")),session=config.aviatorSessionConfig(),systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1600,height:950},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.openMissionBoard();const storm=SIM.worldLocations().locations.find(location=>location.level==="storm"&&defaultWorldLocation(location.level)===location.id);setAtlasSelection(storm.id);});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&document.querySelectorAll("[data-release-focus]").length===5,null,{timeout:30000});

  await page.click('[data-release-focus="wind"]');await page.waitForTimeout(120);
  const pointer=await page.evaluate(()=>({focus:SIM.trainingReleaseFocus(),pressed:document.querySelector('[data-release-focus="wind"]').getAttribute("aria-pressed"),layer:document.querySelector('[data-atlas-layer="weather"]').getAttribute("aria-selected"),profile:SIM.routeProfile(),events:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="training_release_focus").map(event=>event.data)}));
  await page.screenshot({path:path.join(artifacts,"training-release-drilldown-weather-desktop.png"),fullPage:false});

  await page.locator('[data-release-focus="clearance"]').focus();await page.keyboard.press("Enter");await page.waitForTimeout(120);
  const keyboard=await page.evaluate(()=>({focus:SIM.trainingReleaseFocus(),pressed:document.querySelector('[data-release-focus="clearance"]').getAttribute("aria-pressed"),layer:document.querySelector('[data-atlas-layer="terrain"]').getAttribute("aria-selected"),profile:SIM.routeProfile(),active:document.activeElement?.dataset?.releaseFocus||null}));

  const realtime=await page.evaluate(()=>{const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_release_briefing",arguments:JSON.stringify({focus:"visibility"}),call_id:"release-brief-1"});const outputEvent=sent.find(event=>event.type==="conversation.item.create"&&event.item?.type==="function_call_output"),output=outputEvent?JSON.parse(outputEvent.item.output):null,event=[...BLACK_BOX.events].reverse().find(item=>item.run===BLACK_BOX.runId&&item.type==="training_release_focus"&&item.data.source==="gpt_realtime");return{sent,output,event:event?.data||null,focus:SIM.trainingReleaseFocus(),screen:SIM.realtimeFlightState().screen_context};});

  const guard=await page.evaluate(()=>{SIM.hideMissionBoard();S.phase="cruise";const result=SIM.applyTrainingReleaseFocusCommand({focus:"clearance"},"gpt_realtime");return{result,board:SIM.boardState()};});
  const layout=await page.evaluate(()=>{S.phase="parked";SIM.openMissionBoard();const release=document.querySelector(".destination-release"),buttons=[...release.querySelectorAll("button")];return{display:getComputedStyle(release).display,buttons:buttons.map(button=>{const rect=button.getBoundingClientRect();return{focus:button.dataset.releaseFocus,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,scrollWidth:button.scrollWidth,clientWidth:button.clientWidth,label:button.getAttribute("aria-label")};})};});

  const releaseTool=session.tools.find(tool=>tool.name==="present_release_briefing"),checks={
    fiveOperableEvidenceControls:layout.display==="grid"&&layout.buttons.length===5&&layout.buttons.every(button=>button.label?.startsWith("Show")&&button.scrollWidth<=button.clientWidth+1),
    collisionFreeDesktopStrip:layout.buttons.every((button,index)=>index===0||button.left>=layout.buttons[index-1].right)&&layout.buttons.every(button=>button.bottom>button.top),
    pointerShowsWeatherEvidence:pointer.focus.focus==="wind"&&pointer.focus.layer==="weather"&&pointer.focus.route_framed&&pointer.pressed==="true"&&pointer.layer==="true"&&!pointer.profile.open&&pointer.events.some(event=>event.source==="atlas"&&event.focus==="wind"&&event.layer==="weather"),
    keyboardShowsTerrainProfile:keyboard.active==="clearance"&&keyboard.focus.focus==="clearance"&&keyboard.focus.layer==="terrain"&&keyboard.focus.route_framed&&keyboard.focus.profile_open&&keyboard.pressed==="true"&&keyboard.layer==="true"&&keyboard.profile.open,
    realtimeToolContract:releaseTool?.parameters?.properties?.focus?.enum?.length===5&&releaseTool.description.includes("changes no aircraft control")&&session.instructions.includes("present_release_briefing after get_flight_state"),
    realtimeToolExecutes:realtime.output?.ok===true&&realtime.output.focus==="visibility"&&realtime.output.layer==="weather"&&realtime.output.evidence.value==="52%"&&realtime.sent.some(event=>event.type==="response.create"),
    screenAndBlackBoxAgree:realtime.screen.map_open&&realtime.screen.atlas_layer==="weather"&&realtime.screen.training_release_focus==="visibility"&&!realtime.screen.route_profile_open&&realtime.event?.focus==="visibility"&&realtime.event.source==="gpt_realtime"&&realtime.event.evidence==="52%",
    airborneGuard:guard.result.ok===false&&guard.result.error.includes("while parked")&&!guard.board.visible,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,pointer,keyboard,realtime:{...realtime,sent:realtime.sent.map(event=>({type:event.type,name:event.name||null,output:event.item?.output||null}))},guard,layout,session:{model:session.model,voice:session.audio.output.voice,tools:session.tools.map(tool=>tool.name)},errors};
  fs.writeFileSync(path.join(artifacts,"training-release-drilldown-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,pointer,keyboard,realtime:report.realtime,guard,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
