#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

function inside(rect,width,height){return rect.left>=0&&rect.right<=width&&rect.top>=0&&rect.bottom<=height;}
function separated(a,b){return a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}document.getElementById("boot").style.display="none";document.body.classList.remove("booting");S.paused=true;SIM.setCam(1);SIM.resetCockpitTutorProgress();setCockpitDockExpanded(false,true);S.ias=72/KT;updateCamera(.016);syncGraphics(.016);});
  await page.waitForFunction(()=>COCKPIT_INSTRUMENT_ASSET.status==="loaded"&&COCKPIT_ENGINE_ASSET.status==="loaded",null,{timeout:30000});
  await page.waitForTimeout(300);

  await page.click("#cockpitTutorLaunch");await page.waitForTimeout(160);
  const overview=await page.evaluate(()=>({
    state:SIM.cockpitTutor(),hidden:cockpitTutorEl.getAttribute("aria-hidden"),mode:cockpitTutorEl.dataset.mode,
    labels:[...cockpitTutorLabelsEl.querySelectorAll("button")].map(button=>{const rect=button.getBoundingClientRect();return{id:button.dataset.control,text:button.textContent.trim(),pressed:button.getAttribute("aria-pressed"),reviewed:button.dataset.reviewed,recommended:button.dataset.recommended,display:getComputedStyle(button).display,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};}),
    dockCollapsed:cockpitDockEl.classList.contains("collapsed"),title:cockpitTutorProgressTitle.textContent,meta:cockpitTutorProgressMeta.textContent
  }));
  await page.screenshot({path:path.join(artifacts,"cockpit-spatial-tutor-overview-desktop.png"),timeout:60000});

  await page.click('.cockpit-tutor-label[data-control="airspeed"]');await page.waitForTimeout(140);
  const airspeed=await page.evaluate(()=>{
    const panel=cockpitTutorPanel.getBoundingClientRect(),group=COCKPIT_INSTRUMENT_GROUPS.airspeed;
    return{state:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState().cockpit.learning,mode:cockpitTutorEl.dataset.mode,bodyClass:document.body.classList.contains("cockpit-tutor-active"),panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},shade:{x:cockpitTutorEl.style.getPropertyValue("--spot-x"),y:cockpitTutorEl.style.getPropertyValue("--spot-y"),filter:getComputedStyle(cockpitTutorShade).backdropFilter},locked:COCKPIT_INSTRUMENT_FOCUS.locked,extrusion:+(group.position.z-group.userData.basePosition.z).toFixed(3),normalInspectHidden:instrumentInspectEl.getAttribute("aria-hidden"),copy:cockpitTutorCopy.textContent,band:cockpitTutorBand.textContent};
  });
  await page.click("#cockpitTutorNext");await page.waitForTimeout(80);
  const threshold=await page.evaluate(()=>({state:SIM.cockpitTutor(),copy:cockpitTutorCopy.textContent,next:cockpitTutorNext.textContent}));
  await page.screenshot({path:path.join(artifacts,"cockpit-spatial-tutor-airspeed-desktop.png"),timeout:60000});
  await page.click("#cockpitTutorShade");await page.waitForTimeout(80);
  const returned=await page.evaluate(()=>SIM.cockpitTutor());

  const voice=await page.evaluate(()=>{
    const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};
    handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_control_lesson",arguments:JSON.stringify({action:"focus",control:"throttle"}),call_id:"voice-demo-1"});
    const outputEvent=sent.find(event=>event.item?.type==="function_call_output"),output=outputEvent?JSON.parse(outputEvent.item.output):null;
    return{sent,output,state:SIM.cockpitTutor(),realtime:SIM.realtimeFlightState().cockpit.learning,locked:COCKPIT_ENGINE_FOCUS.locked};
  });
  await page.waitForTimeout(100);await page.screenshot({path:path.join(artifacts,"cockpit-spatial-tutor-throttle-desktop.png"),timeout:60000});
  await page.click("#cockpitTutorNext");await page.click("#cockpitTutorNext");await page.click("#cockpitTutorNext");await page.waitForTimeout(100);
  const practice=await page.evaluate(()=>({state:SIM.cockpitTutor(),locked:COCKPIT_ENGINE_FOCUS.locked,dock:SIM.cockpitDock(),expanded:!cockpitDockEl.classList.contains("collapsed"),stored:JSON.parse(localStorage.getItem(COCKPIT_TUTOR_STORAGE)||"{}"),facts:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_lesson").map(event=>event.data)}));
  await page.evaluate(()=>SIM.openCockpitTutor("test"));await page.waitForTimeout(100);
  const progressOverview=await page.evaluate(()=>({state:SIM.cockpitTutor(),title:cockpitTutorProgressTitle.textContent,meta:cockpitTutorProgressMeta.textContent,dockCollapsed:cockpitDockEl.classList.contains("collapsed"),labels:[...cockpitTutorLabelsEl.querySelectorAll("button")].map(button=>({id:button.dataset.control,reviewed:button.dataset.reviewed,recommended:button.dataset.recommended,text:button.textContent.trim()}))}));
  await page.screenshot({path:path.join(artifacts,"cockpit-spatial-tutor-progress-desktop.png"),timeout:60000});
  const continuation=await page.evaluate(()=>{
    const sent=[];AVIATOR.dc={readyState:"open",send:value=>sent.push(JSON.parse(value))};handleAviatorEvent({type:"response.function_call_arguments.done",name:"present_control_lesson",arguments:JSON.stringify({action:"next"}),call_id:"voice-demo-2"});const item=sent.find(event=>event.item?.type==="function_call_output"),output=item?JSON.parse(item.item.output):null;return{output,state:SIM.cockpitTutor(),sent};
  });

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{setCockpitDockExpanded(false,true);SIM.openCockpitTutor("test");SIM.focusCockpitTutor("airspeed","test");updateCamera(.016);renderCockpitTutor();});await page.waitForTimeout(180);
  const mobile=await page.evaluate(()=>{const panel=cockpitTutorPanel.getBoundingClientRect(),dock=cockpitDockEl.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.cockpitTutor(),panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},dock:{top:dock.top,bottom:dock.bottom},visibleLabels:[...cockpitTutorLabelsEl.querySelectorAll("button")].filter(button=>getComputedStyle(button).display!=="none").length};});
  await page.screenshot({path:path.join(artifacts,"cockpit-spatial-tutor-mobile.png"),timeout:60000});

  const health=await fetch(baseUrl+"/api/realtime/health").then(response=>response.json());
  const serverSource=fs.readFileSync(path.join(project,"server/aviator-session.mjs"),"utf8");
  const checks={
    overviewSurfacesPhysicalControls:overview.state.visible&&overview.state.mode==="overview"&&overview.state.progress.reviewed_count===0&&overview.state.progress.recommended_control==="airspeed"&&overview.title.includes("0/11")&&overview.meta.includes("NEXT AIRSPEED")&&overview.labels.length===11&&overview.labels.some(label=>label.id==="battery")&&overview.labels.some(label=>label.id==="alternator")&&overview.labels.some(label=>label.id==="ignition")&&overview.labels.some(label=>label.id==="pitot")&&overview.labels.every(label=>label.display!=="none"&&inside(label,1440,900))&&overview.labels.every(label=>label.text!=="")&&overview.labels.every((label,index)=>overview.labels.slice(index+1).every(other=>separated(label,other))),
    focusIsSpatialAndMeasured:airspeed.state.selected_control==="airspeed"&&airspeed.mode==="focus"&&airspeed.bodyClass&&airspeed.locked==="airspeed"&&airspeed.extrusion>.02&&airspeed.shade.x.endsWith("px")&&airspeed.shade.y.endsWith("px")&&/grayscale/.test(airspeed.shade.filter)&&airspeed.state.live_readout.value.includes("72 KT")&&inside(airspeed.panel,1440,900)&&airspeed.normalInspectHidden==="true",
    lessonIsConciseAndThresholdAware:threshold.state.step===2&&threshold.copy.includes("55 kt")&&threshold.copy.includes("65 kt")&&threshold.copy.length<180&&airspeed.band.includes("NORMAL 55-110 KT"),
    overviewReturnWorks:returned.visible&&returned.mode==="overview"&&returned.selected_control===null,
    voiceToolDrivesSamePresentation:voice.output?.ok&&voice.output.selected_control==="throttle"&&voice.state.selected_control==="throttle"&&voice.realtime.selected_control==="throttle"&&voice.locked==="throttle"&&voice.sent.some(event=>event.item?.type==="function_call_output")&&voice.sent.some(event=>event.type==="response.create"),
    practiceReturnsRealControl:!practice.state.visible&&practice.locked==="throttle"&&practice.expanded&&practice.dock.focused_control==="throttle"&&practice.facts.some(fact=>fact.action==="practice"&&fact.control==="throttle"),
    progressIsHonestAndPersistent:practice.state.progress.label==="reviewed_not_mastered"&&practice.state.progress.reviewed_controls.includes("throttle")&&practice.stored.reviewed.includes("throttle")&&practice.facts.some(fact=>fact.action==="reviewed"&&fact.control==="throttle")&&practice.facts.some(fact=>fact.action==="practice"&&fact.reviewed_not_mastered===true)&&progressOverview.title.includes("1/11")&&progressOverview.dockCollapsed&&progressOverview.labels.find(label=>label.id==="throttle")?.reviewed==="true"&&progressOverview.labels.find(label=>label.id==="airspeed")?.recommended==="true",
    voiceNextUsesRecommendation:continuation.output?.ok&&continuation.output.selected_control==="airspeed"&&continuation.state.selected_control==="airspeed"&&continuation.state.progress.reviewed_controls.includes("throttle")&&continuation.sent.some(event=>event.type==="response.create"),
    mobileFocusFits:mobile.overflow<=0&&mobile.visibleLabels===0&&mobile.state.selected_control==="airspeed"&&inside(mobile.panel,390,844)&&mobile.panel.bottom<=mobile.dock.top,
    realtimeToolConfigured:health.model==="gpt-realtime-2"&&health.configured===true&&serverSource.includes('name: "present_control_lesson"')&&serverSource.includes('tools: [flightStateTool, controlLessonTool]'),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,overview,airspeed,threshold,returned,voice,practice,progressOverview,continuation,mobile,health,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-spatial-tutor-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,overview:overview.state,airspeed:airspeed.state,threshold,mobile,health,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
