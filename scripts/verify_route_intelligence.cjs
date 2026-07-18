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
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{localStorage.clear();if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().hits.length===10);

  const initial=await page.evaluate(()=>({atlas:SIM.liveAtlas(),plan:SIM.atlasRoutePlan()}));
  const stage=await page.locator("#atlasMapStage").boundingBox(),storm=initial.atlas.hits.find(hit=>hit.id==="stormhaven");
  await page.mouse.click(stage.x+storm.x,stage.y+storm.y);
  await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="stormhaven");
  const selected=await page.evaluate(()=>{
    const profile=document.getElementById("destinationRouteProfile"),ctx=profile.getContext("2d"),pixels=ctx.getImageData(0,0,profile.width,profile.height).data,mapPixels=islandMapCtx.getImageData(0,0,islandMapCanvas.width,islandMapCanvas.height).data;let profilePixels=0,cyanPixels=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>15&&(pixels[i]>40||pixels[i+1]>60||pixels[i+2]>60))profilePixels++;
    for(let i=0;i<mapPixels.length;i+=4)if(mapPixels[i+1]>135&&mapPixels[i+2]>115&&mapPixels[i+1]>mapPixels[i]*1.2)cyanPixels++;
    return{atlas:SIM.liveAtlas(),plan:SIM.atlasRoutePlan(),card:document.querySelector(".destination-card").innerText,profile:{width:profile.width,height:profile.height,profilePixels,cyanPixels,mode:profile.dataset.mode,label:profile.getAttribute("aria-label")}};
  });
  await page.screenshot({path:path.join(artifacts,"route-intelligence-desktop.png")});

  await page.locator("#atlasZoomIn").click();await page.locator("#atlasZoomIn").click();
  await page.waitForFunction(()=>SIM.liveAtlas().zoom>=1.35);
  const detailed=await page.evaluate(()=>SIM.liveAtlas());
  await page.locator("#atlasResetView").click();

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);
  await page.waitForFunction(()=>SIM.liveAtlas().width<400&&SIM.liveAtlas().zoom===1);
  const mobile=await page.evaluate(()=>{const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(),stage=atlasMapStage.getBoundingClientRect(),card=document.querySelector(".destination-card").getBoundingClientRect(),profile=document.getElementById("destinationRouteProfile").getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,atlas:SIM.liveAtlas(),sheet:{left:sheet.left,right:sheet.right},stage:{left:stage.left,right:stage.right},card:{left:card.left,right:card.right,height:card.height},profile:{left:profile.left,right:profile.right,width:profile.width},plan:SIM.atlasRoutePlan(),copy:document.querySelector(".route-profile-copy").innerText};});
  await page.locator(".atlas-layout").screenshot({path:path.join(artifacts,"route-intelligence-mobile.png")});

  const checks={
    cleanIslandView:initial.atlas.zoom===1&&!initial.atlas.networkVisible&&selected.atlas.zoom===1&&!selected.atlas.networkVisible,
    progressiveNetwork:detailed.zoom>=1.35&&detailed.networkVisible,
    multiLegRoute:selected.plan.mode==="transfer"&&selected.plan.route_ids.join(",")==="academy,alpineRidge,stormhaven"&&selected.plan.leg_count===2,
    actualTerrainProfile:selected.plan.samples.length>10&&selected.plan.max_terrain_m>0&&selected.plan.planned_altitude_m-selected.plan.max_terrain_m>=175,
    conciseBriefing:selected.card.includes("CRZ ")&&selected.card.includes("CLR ")&&selected.card.includes("ETA ")&&selected.card.includes("V52"),
    renderedProfile:selected.profile.width>150&&selected.profile.height>=70&&selected.profile.profilePixels>150&&selected.profile.label.includes("Highest terrain"),
    selectedCorridorVisible:selected.profile.cyanPixels>150,
    mobileFit:mobile.overflow<=0&&mobile.sheet.left>=0&&mobile.sheet.right<=390&&mobile.stage.left>=mobile.sheet.left&&mobile.stage.right<=mobile.sheet.right&&mobile.card.left>=mobile.sheet.left&&mobile.card.right<=mobile.sheet.right&&mobile.profile.left>=mobile.card.left&&mobile.profile.right<=mobile.card.right&&mobile.copy.includes("CRZ"),
    mobileKeepsCleanView:mobile.atlas.zoom===1&&!mobile.atlas.networkVisible&&mobile.plan.route_ids.length===3,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,selected,detailed,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"route-intelligence-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  await browser.close();
  if(!report.ok)process.exitCode=1;
}

main().catch(error=>{console.error(error);process.exit(1);});
