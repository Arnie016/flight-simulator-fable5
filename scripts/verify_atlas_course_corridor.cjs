#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

function overlaps(a,b){return !!a&&!!b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
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
  await page.click("#atlasFitRoute");
  await page.waitForFunction(()=>SIM.liveAtlas().routeFramed,null,{timeout:10000});await page.waitForTimeout(200);
  const desktop=await page.evaluate(()=>{const width=islandMapCanvas.clientWidth,height=islandMapCanvas.clientHeight,atlas=SIM.liveAtlas();return{atlas,plan:SIM.atlasRoutePlan(),readout:document.querySelector(".route-profile-copy")?.innerText||"",routeAnchors:atlas.route.map(id=>{const location=WORLD_LOCATIONS[id],marker=atlasMarkerPoint(location,width,height),anchor=islandAtlasPoint(location.point,width,height);return{id,marker:marker.slice(0,2),anchor};}),stage:(()=>{const r=atlasMapStage.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})()};});
  await page.screenshot({path:path.join(artifacts,"atlas-course-corridor-desktop.png")});

  const labelPairs=[];
  for(let i=0;i<desktop.atlas.routeLegLabels.length;i++)for(let j=i+1;j<desktop.atlas.routeLegLabels.length;j++)labelPairs.push(overlaps(desktop.atlas.routeLegLabels[i],desktop.atlas.routeLegLabels[j]));
  const reserved=[desktop.atlas.labelLayout.focus,...desktop.atlas.labelLayout.endpoints].filter(Boolean);
  const reservedCollisions=desktop.atlas.routeLegLabels.some(label=>reserved.some(box=>overlaps(label,box)));

  await page.locator("#islandMapCanvas").focus();await page.keyboard.press("0");await page.keyboard.press("f");
  await page.waitForFunction(()=>SIM.liveAtlas().routeFramed);await page.waitForTimeout(120);
  const keyboard=await page.evaluate(()=>({framed:SIM.liveAtlas().routeFramed,labels:SIM.liveAtlas().routeLegLabels.length,pressed:atlasFitRoute.getAttribute("aria-pressed")}));

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(240);
  await page.click("#atlasFitRoute");await page.waitForFunction(()=>SIM.liveAtlas().routeFramed);
  const mobile=await page.evaluate(()=>{const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(),stage=atlasMapStage.getBoundingClientRect(),brief=atlasMobileBrief.getBoundingClientRect(),layers=atlasMapStage.querySelector(".atlas-layers").getBoundingClientRect(),live=atlasLiveEl.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,atlas:SIM.liveAtlas(),readout:document.querySelector(".route-profile-copy")?.innerText||"",mobileRoute:atlasMobileRoute.textContent,sheet:{left:sheet.left,right:sheet.right},stage:{left:stage.left,right:stage.right},brief:{left:brief.left,right:brief.right},layers:{x:layers.x,y:layers.y,w:layers.width,h:layers.height},live:{x:live.x,y:live.y,w:live.width,h:live.height}};});
  await page.locator(".atlas-layout").screenshot({path:path.join(artifacts,"atlas-course-corridor-mobile.png")});

  const expectedLabels=desktop.plan.legs.map(leg=>"DTK "+String(leg.course_degrees).padStart(3,"0")+" · "+leg.distance_km.toFixed(1)+" KM");
  const checks={
    chartedCorridor:desktop.atlas.routeCorridor.style==="charted-course-v2"&&desktop.atlas.routeCorridor.visible&&desktop.atlas.routeCorridor.width===10&&desktop.atlas.routeCorridor.focus&&desktop.atlas.routeCorridor.anchor_locked&&desktop.atlas.routeCorridor.intermediate_fixes===1&&desktop.atlas.routeCorridor.fix_markers_deduplicated,
    geographicAnchors:desktop.routeAnchors.every(point=>Math.hypot(point.marker[0]-point.anchor[0],point.marker[1]-point.anchor[1])<.5),
    measuredLegs:desktop.plan.route_ids.join(",")==="academy,alpineRidge,stormhaven"&&desktop.plan.legs.length===2&&desktop.atlas.routeCorridor.legs.every((leg,index)=>leg.course_degrees===desktop.plan.legs[index].course_degrees&&leg.distance_m===desktop.plan.legs[index].distance_m),
    courseLabels:desktop.atlas.routeLegLabels.length===2&&desktop.atlas.routeLegLabels.every((label,index)=>label.text===expectedLabels[index]),
    collisionFreeLabels:!labelPairs.some(Boolean)&&!reservedCollisions,
    routeFocusDeclutter:desktop.atlas.routeCorridor.off_route_markers>=5&&desktop.atlas.routeCorridor.airspace_labels_suppressed>=1&&desktop.atlas.routeCorridor.endpoint_names_suppressed===2&&desktop.atlas.labelLayout.shown.every(label=>label.role?.startsWith("FIX"))&&desktop.atlas.labelLayout.suppressed.includes("academy")&&desktop.atlas.labelLayout.suppressed.includes("stormhaven"),
    departureOwnshipClear:desktop.atlas.routeCorridor.ownship_at_departure&&desktop.atlas.routeCorridor.ownship_label_suppressed,
    conciseFlightPlan:desktop.readout.includes("2 LEGS")&&desktop.readout.includes("DTK 250°")&&desktop.readout.includes("CRZ 300 M")&&desktop.readout.includes("CLR 300 M")&&desktop.readout.includes("RAIN")&&desktop.readout.includes("V52"),
    keyboardRouteFit:keyboard.framed&&keyboard.labels===2&&keyboard.pressed==="true",
    mobileProgressiveDisclosure:mobile.atlas.routeCorridor.visible&&mobile.atlas.zoom>=2.9&&mobile.atlas.routeLegLabels.length===0&&mobile.mobileRoute.includes("CLR")&&mobile.readout.includes("DTK 250°"),
    mobileFit:mobile.overflow<=0&&mobile.sheet.left>=0&&mobile.sheet.right<=390&&mobile.stage.left>=mobile.sheet.left&&mobile.stage.right<=mobile.sheet.right&&mobile.brief.left>=mobile.stage.left&&mobile.brief.right<=mobile.stage.right&&!overlaps(mobile.layers,mobile.live),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,desktop,keyboard,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"atlas-course-corridor-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,desktop:{route:desktop.atlas.route,labels:desktop.atlas.routeLegLabels,readout:desktop.readout},keyboard,mobile:{overflow:mobile.overflow,labels:mobile.atlas.routeLegLabels,route:mobile.mobileRoute,readout:mobile.readout},errors},null,2));
  await browser.close();
  if(!report.ok)process.exitCode=1;
}

main().catch(error=>{console.error(error);process.exit(1);});
