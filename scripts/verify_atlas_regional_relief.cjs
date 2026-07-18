#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"commit"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.openMissionBoard();setAtlasSelection("redMesa");atlasResetView.click();});
  await page.waitForFunction(()=>SIM.liveAtlas().cartography?.palette==="regional-relief-v3"&&SIM.liveAtlas().frames>=3,null,{timeout:30000});
  await page.waitForTimeout(500);
  const desktop=await page.evaluate(()=>{
    const sample=(x,z)=>{const point=atlasWorldPoint([x,z]),ctx=ATLAS_CACHE.canvas.getContext("2d"),pixel=ctx.getImageData(Math.round(point[0]),Math.round(point[1]),1,1).data;return[pixel[0],pixel[1],pixel[2]];};
    const stage=atlasMapStage.getBoundingClientRect(),sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect();
    return{state:SIM.liveAtlas(),samples:{rainCoast:sample(-3500,-450),westernPasture:sample(-3000,900),alpineRange:sample(-2200,1850),easternMesa:sample(2300,550),emberField:sample(3050,1950),ocean:sample(6500,-300)},stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom},sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom},selected:document.querySelector(".destination-card h3")?.textContent||"",route:document.querySelector(".destination-route")?.innerText||""};
  });
  await page.screenshot({path:path.join(artifacts,"training-atlas-regional-relief-desktop.png"),timeout:60000});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  const mobile=await page.evaluate(()=>{const stage=atlasMapStage.getBoundingClientRect(),briefRect=atlasMobileBrief.getBoundingClientRect(),sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.liveAtlas(),stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom},brief:{left:briefRect.left,right:briefRect.right,top:briefRect.top,bottom:briefRect.bottom,text:atlasMobileBrief.innerText},sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom}};});
  await page.screenshot({path:path.join(artifacts,"training-atlas-regional-relief-mobile.png"),timeout:60000});

  const colors=Object.values(desktop.samples),pairDistances=[];for(let i=0;i<colors.length;i++)for(let j=i+1;j<colors.length;j++)pairDistances.push(distance(colors[i],colors[j]));
  const checks={
    regionalPalette:desktop.state.cartography.palette==="regional-relief-v3"&&desktop.state.cartography.zoneCount===5&&desktop.state.cartography.regionCount===5,
    populatedRegions:Object.values(desktop.state.cartography.regions).every(count=>count>1000),
    distinctRegionalPixels:pairDistances.filter(value=>value>20).length>=10,
    readableClimateColors:desktop.samples.rainCoast[2]>desktop.samples.rainCoast[0]&&desktop.samples.westernPasture[1]>desktop.samples.westernPasture[0]&&desktop.samples.easternMesa[0]>desktop.samples.easternMesa[2]+18&&desktop.samples.emberField[0]>desktop.samples.emberField[1],
    authoritativeRelief:desktop.state.cartography.reliefRange[1]>1500&&desktop.state.cartography.hillshadeRange[1]-desktop.state.cartography.hillshadeRange[0]>.4&&Object.values(desktop.state.cartography.bands).every(Boolean),
    navigationPreserved:desktop.state.hits.length===10&&desktop.state.selectedId==="redMesa"&&desktop.selected==="Red Mesa Outpost"&&desktop.route.includes("CLR"),
    desktopFit:desktop.stage.left>=desktop.sheet.left&&desktop.stage.right<=desktop.sheet.right&&desktop.stage.top>=desktop.sheet.top&&desktop.stage.bottom<=desktop.sheet.bottom,
    mobileFit:mobile.overflow<=0&&mobile.state.mobileFocusCollapsed&&mobile.stage.left>=mobile.sheet.left&&mobile.stage.right<=mobile.sheet.right&&mobile.brief.left>=mobile.stage.left&&mobile.brief.right<=mobile.stage.right&&mobile.brief.text.includes("FLY"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,desktop,mobile,pairDistances:pairDistances.map(value=>+value.toFixed(1)),errors};
  fs.writeFileSync(path.join(artifacts,"atlas-regional-relief-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
