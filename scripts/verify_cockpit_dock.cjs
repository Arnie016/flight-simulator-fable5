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
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);updateCockpitDock();});
  await page.waitForFunction(()=>getComputedStyle(cockpitDockEl).display==="block");
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready&&!SIM.cockpitDock().expanded,null,{timeout:30000});
  await page.waitForTimeout(240);
  const physicalFirst=await page.evaluate(()=>{const rect=cockpitDockEl.getBoundingClientRect();return{state:SIM.cockpitDock(),title:cockpitDockTitle.textContent,toggle:cockpitDockToggle.getAttribute("aria-label"),body:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-body")).display,brief:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-brief")).display,rect:{width:rect.width,height:rect.height}};});
  await page.click("#cockpitDockToggle");
  await page.waitForFunction(()=>SIM.cockpitDock().expanded);

  await page.locator("#cockpitThrottle").evaluate(input=>{input.value="68";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.click('[data-cockpit-flap="0.5"]');
  await page.locator("#cockpitTrim").evaluate(input=>{input.value="12";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.evaluate(()=>SIM.warp(2.2));
  const powered=await page.evaluate(()=>({snap:SIM.snap(),dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.controls,blackBox:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));
  const panel=await page.evaluate(()=>{const rect=cockpitDockEl.getBoundingClientRect(),lamp=id=>{const element=document.getElementById(id);return{state:element.dataset.state,value:element.querySelector("em").textContent};};return{rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width},background:getComputedStyle(cockpitDockEl).backgroundColor,lamps:{bus:lamp("cockpitBusLamp"),engine:lamp("cockpitEngineLamp"),pitot:lamp("cockpitPitotLamp"),check:lamp("cockpitPreflightLamp")}};});

  const brakeBox=await page.locator("#cockpitBrake").boundingBox();
  await page.mouse.move(brakeBox.x+brakeBox.width/2,brakeBox.y+brakeBox.height/2);await page.mouse.down();
  const braking=await page.evaluate(()=>({dock:SIM.cockpitDock(),override:ovr.brakes,pressed:cockpitBrake.getAttribute("aria-pressed")}));
  await page.mouse.up();
  const released=await page.evaluate(()=>({dock:SIM.cockpitDock(),override:ovr.brakes,pressed:cockpitBrake.getAttribute("aria-pressed")}));

  await page.hover('[data-cockpit-flap="1"]');
  await page.waitForTimeout(180);
  const hover=await page.evaluate(()=>({transform:getComputedStyle(document.querySelector('[data-cockpit-flap="1"]')).transform,shadow:getComputedStyle(document.querySelector('[data-cockpit-flap="1"]')).boxShadow,status:cockpitDockStatus.textContent}));
  await page.click("#cockpitAlternator");
  const alternator=await page.evaluate(()=>{SIM.setBatteryCharge(.32);const before=SIM.electrical().volts;SIM.warp(18);updateCockpitDock();return{before,after:SIM.electrical().volts,dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.controls,text:cockpitAlternator.textContent,status:cockpitDockStatus.textContent,busLamp:{state:cockpitBusLamp.dataset.state,value:cockpitBusLampValue.textContent}};});
  await page.screenshot({path:path.join(artifacts,"cockpit-control-dock-desktop.png")});

  await page.evaluate(()=>{reset();S.fail.alternator=false;S.electrical.masterOn=true;S.electrical.alternatorOn=true;S.pitotHeatOn=true;S.flapSet=S.flapPos=0;S.trim=0;S.mixture=1;S.ignition="both";S.engineIgnited=true;COCKPIT_DOCK.lastPhase="parked";COCKPIT_DOCK.manualExpanded=true;COCKPIT_DOCK.autoCollapsed=false;COCKPIT_DOCK.physicalReadyCollapsed=false;setCockpitDockExpanded(true);updateElectrical(0);updateCockpitDock();});
  await page.click("#cockpitDepartureCheck");
  await page.evaluate(()=>{COCKPIT_DOCK.manualExpanded=false;COCKPIT_DOCK.physicalReadyCollapsed=false;});
  await page.locator("#cockpitThrottle").evaluate(input=>{input.value="75";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.evaluate(()=>{SIM.warp(2.5);updateCockpitDock();});
  await page.waitForFunction(()=>cockpitDockEl.classList.contains("collapsed")&&cockpitDockEl.getBoundingClientRect().width<=561,null,{timeout:3000});
  const autoCompact=await page.evaluate(()=>{const rect=cockpitDockEl.getBoundingClientRect(),compact=cockpitDockEl.querySelector(".cockpit-compact-state");return{classed:cockpitDockEl.classList.contains("collapsed"),expanded:cockpitDockToggle.getAttribute("aria-expanded"),body:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-body")).display,rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height},state:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.controls,readout:{bus:cockpitCompactBus.value,rpm:cockpitCompactRpm.value,speed:cockpitCompactSpeed.value,phase:cockpitCompactPhase.value,label:compact.getAttribute("aria-label")},event:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_panel_mode").at(-1)?.data||null};});
  await page.screenshot({path:path.join(artifacts,"cockpit-control-pedestal-compact-desktop.png")});
  await page.click("#cockpitDockToggle");
  const reopened=await page.evaluate(()=>({expanded:SIM.cockpitDock().expanded,manual:COCKPIT_DOCK.manualExpanded,body:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-body")).display}));
  await page.click("#cockpitDockToggle");
  const collapsed=await page.evaluate(()=>({classed:cockpitDockEl.classList.contains("collapsed"),expanded:cockpitDockToggle.getAttribute("aria-expanded"),body:getComputedStyle(cockpitDockEl.querySelector(".cockpit-dock-body")).display}));
  await page.click("#cockpitDockToggle");
  await page.evaluate(()=>{reset();S.fail.alternator=false;SIM.setBatteryCharge(1);SIM.warp(.4);SIM.setCam(1);COCKPIT_DOCK.manualExpanded=false;COCKPIT_DOCK.autoCollapsed=false;COCKPIT_DOCK.physicalReadyCollapsed=true;setCockpitDockExpanded(false);updateCamera(.016);updateCockpitDock();});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{updateCamera(.016);updateCockpitDock();});await page.waitForTimeout(200);
  const mobile=await page.evaluate(()=>{const dock=cockpitDockEl.getBoundingClientRect(),cue=document.getElementById("cue").getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,dock:{left:dock.left,right:dock.right,top:dock.top,bottom:dock.bottom,width:dock.width,height:dock.height},cue:{top:cue.top,bottom:cue.bottom},display:getComputedStyle(cockpitDockEl).display};});
  await page.screenshot({path:path.join(artifacts,"cockpit-control-dock-mobile.png")});

  const checks={
    physicalFirstDefault:physicalFirst.state.physical_controls_ready&&!physicalFirst.state.expanded&&physicalFirst.state.physical_first_collapsed&&physicalFirst.state.presentation==="physical-first"&&physicalFirst.title==="SYSTEMS READY"&&physicalFirst.toggle==="Open accessible cockpit controls"&&physicalFirst.body==="none"&&physicalFirst.brief==="none"&&physicalFirst.rect.height<=31&&physicalFirst.rect.width<=561,
    modeledControls:powered.snap.throttle>.55&&powered.snap.rpm>1500&&powered.snap.flapLeft>.45&&Math.abs(powered.snap.trim-.12)<.01,
    telemetryMatches:powered.dock.throttle_command_percent===68&&powered.realtime.throttle_command_percent===68&&powered.dock.flaps_command_percent===50&&powered.realtime.trim_percent===12,
    heldBrake:braking.dock.brakes_commanded&&braking.override===true&&braking.pressed==="true"&&!released.dock.brakes_commanded&&released.override===null&&released.pressed==="false",
    alternatorConsequence:!alternator.dock.alternator_switch_on&&!alternator.realtime.alternator_switch_on&&alternator.after<alternator.before&&alternator.text.includes("OFF"),
    liveAnnunciators:panel.lamps.bus.state==="on"&&panel.lamps.bus.value==="14.2V"&&panel.lamps.engine.state==="on"&&panel.lamps.engine.value==="RUN"&&panel.lamps.pitot.state==="on"&&panel.lamps.check.state==="warn"&&alternator.busLamp.state==="warn"&&alternator.busLamp.value==="10.8V",
    panelIntegrated:Math.abs(panel.rect.bottom-900)<1&&panel.rect.width>=450&&panel.background!=="rgba(0, 0, 0, 0)",
    blackBoxControls:["throttle","flaps","trim"].every(control=>powered.blackBox.some(event=>event.control===control)),
    hoverFeedback:hover.transform!=="none"&&hover.shadow!=="none"&&hover.status.includes("flap drive"),
    automaticFlightCompaction:autoCompact.classed&&autoCompact.expanded==="false"&&autoCompact.body==="none"&&autoCompact.state.visible&&!autoCompact.state.expanded&&autoCompact.state.auto_collapsed&&autoCompact.realtime.phase==="takeoff-roll"&&autoCompact.readout.bus.endsWith("V")&&+autoCompact.readout.rpm>1500&&autoCompact.readout.speed.endsWith("KT")&&autoCompact.readout.phase==="ROLL"&&autoCompact.event?.reason==="departure"&&autoCompact.rect.height<=31&&autoCompact.rect.width<=561,
    oneClickReopen:reopened.expanded&&reopened.manual&&reopened.body==="block",
    collapsible:collapsed.classed&&collapsed.expanded==="false"&&collapsed.body==="none",
    mobileFit:mobile.overflow<=0&&mobile.display==="block"&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.cue.bottom<=mobile.dock.top,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,physicalFirst,powered,panel,braking,released,hover,alternator,autoCompact,reopened,collapsed,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-dock-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,physicalFirst,powered:{snap:powered.snap,dock:powered.dock,realtime:powered.realtime},panel,braking,released,hover,alternator,autoCompact,reopened,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
