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
  await page.evaluate(()=>{
    if(BOOT.active){BOOT.ready=true;enterFlight();}
    boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);SIM.openMissionBoard();
    STORY_PROGRESS_CACHE={version:1,missions:{
      "breakwater-relay":{completed:true,attempts:2,bestScore:88},
      "lighthouse-survey":{completed:true,attempts:1,bestScore:91},
      "alpine-shelter":{completed:true,attempts:1,bestScore:83},
      "ridge-mail":{completed:false,attempts:1,bestScore:72}
    }};
    renderMissionBoard();
  });
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().frames>0&&SIM.liveAtlas().hits.length===10,null,{timeout:30000});

  const terrain=await page.evaluate(()=>{
    const canvas=ensureAtlasTerrain(),ctx=canvas.getContext("2d");
    const sample=(point)=>{const [x,y]=atlasWorldPoint(point,canvas.width,canvas.height),pixel=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,Math.round(x))),Math.max(0,Math.min(canvas.height-1,Math.round(y))),1,1).data;return Array.from(pixel.slice(0,3));};
    const buckets=new Set();
    for(let y=12;y<canvas.height;y+=29)for(let x=12;x<canvas.width;x+=29){const p=ctx.getImageData(x,y,1,1).data;buckets.add([p[0]>>4,p[1]>>4,p[2]>>4].join("/"));}
    const scratch=document.createElement("canvas");scratch.width=900;scratch.height=520;const sc=scratch.getContext("2d");
    drawAtlasRunway(sc,HOME_RUNWAY,scratch.width,scratch.height);drawAtlasRunway(sc,FRONTIER_RUNWAY,scratch.width,scratch.height);drawAtlasScale(sc,scratch.width,scratch.height);
    const marks=sc.getImageData(0,0,scratch.width,scratch.height).data;let markedPixels=0;for(let i=3;i<marks.length;i+=4)if(marks[i])markedPixels++;
    return{width:canvas.width,height:canvas.height,buckets:buckets.size,markedPixels,cartography:SIM.liveAtlas().cartography,samples:{ocean:sample([3950,-3850]),cove:sample([COASTAL_COVE.x,COASTAL_COVE.z]),lowland:sample([0,0]),alpine:sample([-1450,1250]),dry:sample([2800,1900])}};
  });
  const states=await page.evaluate(()=>Object.fromEntries(SIM.liveAtlas().hits.map(hit=>[hit.id,hit])));

  await page.evaluate(()=>setAtlasSelection("breakwater"));
  const mastered=await page.evaluate(()=>({
    selected:SIM.liveAtlas().selectedId,
    status:document.querySelector(".destination-level b")?.textContent||"",
    missionStates:[...document.querySelectorAll(".ground-mission")].map(row=>row.innerText),
    legend:getComputedStyle(document.querySelector(".atlas-state-key")).display,
    card:document.querySelector(".destination-card")?.innerText||""
  }));
  await page.screenshot({path:path.join(artifacts,"training-atlas-progression-desktop.png")});

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{setAtlasSelection("alpineRidge");drawIslandAtlas();});
  await page.waitForTimeout(240);
  const mobile=await page.evaluate(()=>{
    const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(),stage=atlasMapStage.getBoundingClientRect(),card=locationGrid.getBoundingClientRect();
    return{selected:SIM.liveAtlas().selectedId,status:document.querySelector(".destination-level b")?.textContent||"",legend:getComputedStyle(document.querySelector(".atlas-state-key")).display,overflow:document.documentElement.scrollWidth-innerWidth,sheet:{left:sheet.left,right:sheet.right},stage:{left:stage.left,right:stage.right},card:{left:card.left,right:card.right}};
  });
  await page.screenshot({path:path.join(artifacts,"training-atlas-progression-mobile.png")});

  const checks={
    progressionStates:states.academy.state==="current"&&states.breakwater.state==="mastered"&&states.breakwater.completed===2&&states.alpineRidge.state==="in-progress"&&states.alpineRidge.completed===1&&states.stormhaven.state==="available"&&states.silverLake.state==="landmark",
    masteredCard:mastered.selected==="breakwater"&&mastered.status.includes("MASTERED")&&mastered.missionStates.length===2&&mastered.missionStates.every(row=>row.includes("MASTERED")),
    inProgressCard:mobile.selected==="alpineRidge"&&mobile.status.includes("1/2"),
    desktopLegend:mastered.legend==="flex",
    mobileLegendHidden:mobile.legend==="none",
    mobileFit:mobile.overflow<=0&&mobile.stage.left>=mobile.sheet.left&&mobile.stage.right<=mobile.sheet.right&&mobile.card.left>=mobile.sheet.left&&mobile.card.right<=mobile.sheet.right,
    highResolutionTerrain:terrain.width===1440&&terrain.height===760,
    terrainDiversity:terrain.buckets>=24,
    waterReadability:terrain.samples.ocean[2]>terrain.samples.ocean[0]+25&&terrain.samples.cove[2]>terrain.samples.cove[0]+60,
    reliefReadability:terrain.samples.lowland[1]>terrain.samples.lowland[0]&&terrain.cartography?.zoneCount===5&&terrain.cartography.reliefRange[1]>1500&&terrain.cartography.hillshadeRange[1]-terrain.cartography.hillshadeRange[0]>.4&&terrain.cartography.bands.alpine>1000&&terrain.cartography.bands.snow>1000,
    runwayAndScaleMarks:terrain.markedPixels>250,
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,states,terrain,mastered,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"atlas-progression-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,states,terrain,mastered:{selected:mastered.selected,status:mastered.status,missionStates:mastered.missionStates,legend:mastered.legend},mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
