#!/usr/bin/env node
"use strict";

const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";

async function main(){
  const manifest=JSON.parse(fs.readFileSync(path.join(project,"assets/destinations/manifest.json"),"utf8"));
  const files=manifest.files.map(item=>{const file=path.join(project,"assets/destinations",item.file),buffer=fs.readFileSync(file);return{...item,exists:true,actualBytes:buffer.length,hash:crypto.createHash("sha256").update(buffer).digest("hex")};});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().hits.length===10,null,{timeout:30000});

  const cards=[];
  for(const item of manifest.files){
    const card=await page.evaluate(async item=>{
      setAtlasSelection(item.id);
      const url=destinationArtUrl(WORLD_LOCATIONS[item.id]),image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=52;canvas.height=23;ctx.drawImage(image,0,0,52,23);const data=ctx.getImageData(0,0,52,23).data,buckets=new Set();let luminance=0;
      for(let i=0;i<data.length;i+=4){buckets.add([data[i]>>5,data[i+1]>>5,data[i+2]>>5].join("/"));luminance+=(data[i]+data[i+1]+data[i+2])/3;}
      return{id:item.id,expectedTitle:item.name,url,width:image.naturalWidth,height:image.naturalHeight,buckets:buckets.size,meanLuminance:+(luminance/(data.length/4)).toFixed(1),background:getComputedStyle(document.querySelector(".destination-art")).backgroundImage,title:document.querySelector(".destination-card h3")?.textContent||""};
    },item);
    cards.push(card);
  }
  await page.evaluate(()=>setAtlasSelection("kauriTownship"));await page.waitForTimeout(120);
  await page.screenshot({path:path.join(artifacts,"training-atlas-destination-art-desktop.png")});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setAtlasSelection("stormhaven"));await page.waitForTimeout(120);
  const mobile=await page.evaluate(()=>{const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(),card=locationGrid.getBoundingClientRect(),art=document.querySelector(".destination-art").getBoundingClientRect();return{overflow:document.documentElement.scrollWidth-innerWidth,sheet:{left:sheet.left,right:sheet.right},card:{left:card.left,right:card.right},art:{left:art.left,right:art.right,width:art.width,height:art.height},background:getComputedStyle(document.querySelector(".destination-art")).backgroundImage};});
  await page.screenshot({path:path.join(artifacts,"training-atlas-destination-art-mobile.png")});

  const checks={
    tenAuthoredFiles:files.length===10&&files.every(file=>file.exists&&file.actualBytes===file.bytes&&file.actualBytes>3000),
    uniqueFiles:new Set(files.map(file=>file.hash)).size===10,
    modestPayload:files.reduce((sum,file)=>sum+file.actualBytes,0)<400000,
    mappedAndLoaded:cards.length===10&&cards.every(card=>card.url===`assets/destinations/${card.id}.webp`&&card.background.includes(`/assets/destinations/${card.id}.webp`)&&card.width===1040&&card.height===460),
    locationSpecificTitles:cards.every(card=>card.title===card.expectedTitle),
    nonBlankImages:cards.every(card=>card.buckets>=8&&card.meanLuminance>=18),
    noProceduralDataUrls:cards.every(card=>!card.background.includes("data:image")),
    mobileFit:mobile.overflow<=0&&mobile.card.left>=mobile.sheet.left&&mobile.card.right<=mobile.sheet.right&&mobile.art.left>=mobile.card.left&&mobile.art.right<=mobile.card.right&&mobile.art.width>300&&mobile.art.height>=88,
    mobileUsesAuthoredArt:mobile.background.includes("/assets/destinations/stormhaven.webp"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,files:files.map(({id,name,file,actualBytes,hash})=>({id,name,file,bytes:actualBytes,hash})),cards,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"destination-art-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,payloadBytes:files.reduce((sum,file)=>sum+file.actualBytes,0),cards,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
