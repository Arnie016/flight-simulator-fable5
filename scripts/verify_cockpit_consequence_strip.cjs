#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function openAccessibleDock(page){
  await page.waitForTimeout(280);
  if(!await page.evaluate(()=>SIM.cockpitDock().expanded))await page.click("#cockpitDockToggle");
  await page.waitForFunction(()=>SIM.cockpitDock().expanded);
}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);COCKPIT_DOCK.focus="";updateCockpitDock();});
  await page.waitForFunction(()=>SIM.cockpitDock().physical_controls_ready,null,{timeout:30000});
  await openAccessibleDock(page);

  const read=()=>page.evaluate(()=>({ui:{focus:cockpitDockEl.dataset.focus,label:cockpitFocusName.textContent,value:cockpitFocusValue.textContent,effect:cockpitDockStatus.textContent,boundary:cockpitEffect.dataset.state},dock:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.controls,focused:[...cockpitDockEl.querySelectorAll("[data-dock-control].focused")].map(node=>node.dataset.dockControl),blackBox:BLACK_BOX.events.filter(event=>event.run===BLACK_BOX.runId&&event.type==="cockpit_control").map(event=>event.data)}));
  const overview=await read();

  await page.locator("#cockpitMixture").focus();await page.waitForTimeout(80);
  const keyboard=await read();
  await page.locator("#cockpitMixture").evaluate(input=>{input.value="4";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  await page.waitForTimeout(120);const mixtureLimit=await read();

  await page.evaluate(()=>{reset();COCKPIT_DOCK.focus="";SIM.setCam(1);updateCamera(.016);updateCockpitDock();});
  await openAccessibleDock(page);
  await page.locator("#cockpitAlternator").focus();await page.keyboard.press("Enter");
  const alternator=await page.evaluate(()=>{SIM.setBatteryCharge(.32);SIM.warp(18);updateCockpitDock();return{state:SIM.cockpitDock(),realtime:SIM.realtimeFlightState().cockpit.controls,ui:{focus:cockpitDockEl.dataset.focus,label:cockpitFocusName.textContent,value:cockpitFocusValue.textContent,effect:cockpitDockStatus.textContent,boundary:cockpitEffect.dataset.state}};});
  await page.screenshot({path:path.join(artifacts,"cockpit-consequence-strip-desktop.png")});

  await page.evaluate(()=>{reset();COCKPIT_DOCK.focus="";SIM.setCam(1);updateCamera(.016);updateCockpitDock();});
  await openAccessibleDock(page);
  await page.locator("#cockpitTrim").focus();
  await page.locator("#cockpitTrim").evaluate(input=>{input.value="25";input.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));});
  const trim=await read();

  const brakeBox=await page.locator("#cockpitBrake").boundingBox();await page.mouse.move(brakeBox.x+brakeBox.width/2,brakeBox.y+brakeBox.height/2);await page.mouse.down();
  const brakes=await read();await page.mouse.up();

  await page.evaluate(()=>{reset();COCKPIT_DOCK.focus="";SIM.setCam(1);updateCamera(.016);updateCockpitDock();});await openAccessibleDock(page);await page.locator("#cockpitPitot").focus();
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{updateCamera(.016);updateCockpitDock();});await page.waitForTimeout(180);
  const mobile=await page.evaluate(()=>{const rect=node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};},dock=rect(cockpitDockEl),effect=rect(cockpitEffect),cue=rect(document.getElementById("cue")),fields=[cockpitFocusName,cockpitFocusValue,cockpitDockStatus].map(rect);return{overflow:document.documentElement.scrollWidth-innerWidth,dock,effect,cue,fields,text:cockpitEffect.innerText,boundary:cockpitEffect.dataset.state};});
  await page.screenshot({path:path.join(artifacts,"cockpit-consequence-strip-mobile.png")});

  const checks={
    overview:overview.ui.focus==="overview"&&overview.ui.label==="SYSTEMS"&&overview.ui.value.includes("V")&&overview.ui.boundary==="caution",
    keyboardFocus:keyboard.ui.focus==="mixture"&&keyboard.focused.length===1&&keyboard.focused[0]==="mixture"&&keyboard.ui.label==="MIXTURE",
    mixtureLimit:mixtureLimit.ui.boundary==="limit"&&mixtureLimit.ui.value.includes("CUTOFF")&&mixtureLimit.ui.effect.includes("ENGINE STOP")&&!mixtureLimit.dock.engine_running,
    realtimeGrounded:mixtureLimit.realtime.focused_control==="mixture"&&mixtureLimit.realtime.focused_boundary==="limit"&&mixtureLimit.realtime.focused_effect===mixtureLimit.dock.focused_effect,
    blackBoxBoundary:mixtureLimit.blackBox.some(event=>event.control==="mixture"&&event.value===4),
    alternatorConsequence:alternator.ui.focus==="alternator"&&alternator.ui.boundary==="caution"&&alternator.ui.value==="OFF"&&alternator.ui.effect.includes("BATT SOURCE")&&alternator.state.volts<11&&alternator.realtime.focused_boundary==="caution",
    trimBoundary:trim.ui.focus==="trim"&&trim.ui.boundary==="caution"&&trim.dock.trim_percent===25&&trim.ui.effect.includes("LIMIT ±25"),
    brakeSurface:brakes.ui.focus==="brakes"&&brakes.ui.value==="HELD"&&brakes.ui.effect.includes("DRY ASPHALT")&&brakes.dock.brakes_commanded,
    mobileFit:mobile.overflow<=0&&mobile.dock.left>=0&&mobile.dock.right<=390&&mobile.dock.bottom<=844&&mobile.cue.bottom<=mobile.dock.top&&mobile.effect.left>=mobile.dock.left&&mobile.effect.right<=mobile.dock.right,
    mobileTextFit:mobile.fields.every(field=>field.scrollWidth<=field.clientWidth+1)&&mobile.text.includes("PITOT HEAT")&&mobile.text.includes("ASI RELIABLE"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,overview,keyboard,mixtureLimit,alternator,trim,brakes,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"cockpit-consequence-strip-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
