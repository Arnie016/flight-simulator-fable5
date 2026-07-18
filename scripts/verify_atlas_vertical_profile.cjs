#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

function inside(inner,outer){return inner.left>=outer.left-1&&inner.right<=outer.right+1&&inner.top>=outer.top-1&&inner.bottom<=outer.bottom+1;}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
  const page=await browser.newPage({viewport:{width:1600,height:950},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{localStorage.clear();if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().hits.length===10,null,{timeout:30000});

  const storm=await page.evaluate(()=>SIM.liveAtlas().hits.find(hit=>hit.id==="stormhaven")),map=await page.locator("#islandMapCanvas").boundingBox();
  await page.mouse.click(map.x+storm.x,map.y+storm.y);
  await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="stormhaven");
  const initial=await page.evaluate(()=>({profile:SIM.routeProfile(),lesson:document.querySelector(".ground-mission.selected strong")?.textContent||"",readout:document.querySelector(".route-profile-copy")?.innerText||""}));

  await page.click("#destinationRouteToggle");
  await page.waitForFunction(()=>SIM.routeProfile().open&&SIM.routeProfile().canvas.height>=100);
  const canvas=await page.locator("#destinationRouteProfile").boundingBox();
  await page.mouse.move(canvas.x+canvas.width*.58,canvas.y+canvas.height*.5);
  await page.waitForTimeout(80);
  const pointer=await page.evaluate(()=>({profile:SIM.routeProfile(),sample:{position:routeProfileDistance.textContent,terrain:routeProfileTerrain.textContent,margin:routeProfileMargin.textContent},lesson:document.querySelector(".destination-card h3")?.textContent||"",missionDisplay:getComputedStyle(document.querySelector(".destination-missions")).display,pixels:(()=>{const c=destinationRouteProfile.getContext("2d"),data=c.getImageData(0,0,destinationRouteProfile.width,destinationRouteProfile.height).data;let colored=0,bright=0;for(let i=0;i<data.length;i+=16){if(data[i]+data[i+1]+data[i+2]>40)colored++;if(data[i+1]>150&&data[i+2]>130)bright++;}return{colored,bright};})()}));
  await page.locator("#destinationRouteToggle").focus();
  const beforeKey=pointer.profile.index;await page.keyboard.press("ArrowRight");
  const keyboard=await page.evaluate(()=>({profile:SIM.routeProfile(),position:routeProfileDistance.textContent,expanded:destinationRouteToggle.getAttribute("aria-expanded"),label:destinationRouteToggle.getAttribute("aria-label")}));
  await page.locator("#missionBoard .sheet").screenshot({path:path.join(artifacts,"training-atlas-profile-desktop.png")});

  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>!SIM.routeProfile().open);
  const collapsed=await page.evaluate(()=>({profile:SIM.routeProfile(),missionDisplay:getComputedStyle(document.querySelector(".destination-missions")).display,selectedMission:document.querySelector(".ground-mission.selected strong")?.textContent||"",launchVisible:destinationLaunch.offsetParent!==null}));

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);
  await page.locator("#destinationRouteToggle").scrollIntoViewIfNeeded();
  await page.locator("#destinationRouteToggle").click();
  await page.waitForFunction(()=>SIM.routeProfile().open&&SIM.routeProfile().canvas.height>=100);
  await page.locator(".destination-card").scrollIntoViewIfNeeded();await page.waitForTimeout(80);
  const mobile=await page.evaluate(()=>{const card=document.querySelector(".destination-card").getBoundingClientRect(),route=destinationRouteToggle.getBoundingClientRect(),actions=document.querySelector(".destination-actions").getBoundingClientRect(),copy=document.querySelector(".route-profile-data").getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,profile:SIM.routeProfile(),card:{left:card.left,right:card.right,top:card.top,bottom:card.bottom},route:{left:route.left,right:route.right,top:route.top,bottom:route.bottom},actions:{left:actions.left,right:actions.right,top:actions.top,bottom:actions.bottom},copy:{left:copy.left,right:copy.right,top:copy.top,bottom:copy.bottom},sample:{position:routeProfileDistance.textContent,terrain:routeProfileTerrain.textContent,margin:routeProfileMargin.textContent}};});
  await page.locator(".destination-card").screenshot({path:path.join(artifacts,"training-atlas-profile-mobile.png")});

  const plan=await page.evaluate(()=>SIM.atlasRoutePlan());
  const checks={
    startsCompact:!initial.profile.open&&initial.profile.canvas.height<60&&initial.lesson==="Stormhaven Medevac",
    measuredPlan:plan.samples.length>=8&&plan.distance_m>1000&&plan.max_terrain_m>=0&&plan.planned_altitude_m>=300&&plan.clearance_m>=160,
    expandedPlanningView:pointer.profile.open&&pointer.profile.expanded&&pointer.profile.cardOpen&&pointer.profile.canvas.height>=100&&pointer.missionDisplay==="none",
    pointerSamplesRoute:pointer.profile.index>0&&pointer.profile.index<pointer.profile.measurement.count-1&&pointer.sample.position.includes("KM")&&pointer.sample.terrain.includes("M / ")&&pointer.sample.margin.includes("M ·"),
    renderedProfile:pointer.pixels.colored>1000&&pointer.pixels.bright>10,
    keyboardInspection:keyboard.profile.index===Math.min(keyboard.profile.measurement.count-1,beforeKey+1)&&keyboard.expanded==="true"&&keyboard.label.includes("vertical route profile"),
    lessonPreserved:pointer.lesson==="Stormhaven"&&collapsed.selectedMission==="Stormhaven Medevac"&&collapsed.missionDisplay==="grid"&&collapsed.launchVisible,
    escapeCollapses:!collapsed.profile.open&&!collapsed.profile.expanded&&!collapsed.profile.cardOpen&&collapsed.profile.canvas.height<60,
    mobileFit:mobile.overflow<=0&&mobile.profile.open&&mobile.profile.canvas.height>=100&&inside(mobile.route,mobile.card)&&inside(mobile.actions,mobile.card)&&inside(mobile.copy,mobile.route),
    mobileReadout:mobile.sample.position.includes("KM")&&mobile.sample.terrain.includes("M / ")&&mobile.sample.margin.includes("M ·"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,pointer,keyboard,collapsed,mobile,plan,errors};
  fs.writeFileSync(path.join(artifacts,"atlas-vertical-profile-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,pointer:{profile:pointer.profile,sample:pointer.sample,pixels:pointer.pixels},keyboard,mobile:{overflow:mobile.overflow,profile:mobile.profile,sample:mobile.sample},errors},null,2));
  await browser.close();
  if(!report.ok)process.exitCode=1;
}

main().catch(error=>{console.error(error);process.exit(1);});
