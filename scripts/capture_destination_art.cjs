#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const output=path.join(project,"assets","destinations");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";
const profiles={
  academy:{az:0,el:.24,dist:460,focusHeight:2},
  breakwater:{az:.9,el:.34,dist:660,focusHeight:12,useBounds:true},
  alpineRidge:{az:-2.42,el:.3,dist:1050,focusHeight:120},
  stormhaven:{az:.55,el:.3,dist:560,focusHeight:24,exposure:1.2,stormFill:true},
  redMesa:{az:-.72,el:.34,dist:760,focusHeight:34},
  frontierField:{az:1.57,el:.25,dist:470,focusHeight:4},
  silverLake:{az:2.4,el:.68,dist:600,focusHeight:28},
  kauriTownship:{az:.8,el:.34,dist:440,focusHeight:18,useBounds:true},
  shepherdHighlands:{az:2.4,el:.38,dist:560,focusHeight:18},
  emberRuins:{az:1.05,el:.36,dist:450,focusHeight:16}
};

async function openCapturePage(browser,needRuntime){
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  await page.goto(baseUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(async needRuntime=>{
    if(BOOT.active){BOOT.ready=true;enterFlight();}
    boot.style.display="none";document.body.classList.remove("booting");
    if(needRuntime&&typeof ensureIslandRuntimePack==="function")await ensureIslandRuntimePack();
  },needRuntime);
  if(needRuntime)await page.waitForFunction(()=>SIM.islandAssets().status==="ready",null,{timeout:30000});
  return page;
}

async function main(){
  fs.mkdirSync(output,{recursive:true});fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const captures=[];
  for(const [id,profile] of Object.entries(profiles)){
    const page=await openCapturePage(browser,!!profile.useBounds);
    const capture=await page.evaluate(async({id,profile})=>{
      travelToLocation(id,false);S.paused=true;
      const location=WORLD_LOCATIONS[id],record=ENV.islandWorld[id];let targetX=location.point[0],targetZ=location.point[1],bounds=null;
      if(profile.useBounds&&record){record.root.visible=true;record.near.visible=true;record.far.visible=false;record.root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(record.near);if(!box.isEmpty()){const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());targetX=center.x;targetZ=center.z;bounds=[+size.x.toFixed(1),+size.y.toFixed(1),+size.z.toFixed(1)];}}
      const ground=terrainH(targetX,targetZ);S.pos.set(targetX,ground+profile.focusHeight,targetZ);S.vel.set(0,0,0);S.onGround=false;
      camMode=2;orbit.az=profile.az;orbit.el=profile.el;orbit.dist=profile.dist;
      updateEnvironmentFX();updateSceneWeather();syncGraphics(0);updateCamera(1);
      if(record){record.root.visible=true;record.near.visible=true;record.far.visible=false;}if(profile.stormFill){const fill=new THREE.HemisphereLight(0x8fb9d8,0x17263a,2.6),key=new THREE.DirectionalLight(0x9dc9ed,2.2);key.position.set(-180,260,120);scene.add(fill,key);scene.background=new THREE.Color(0x17273a);if(scene.fog)scene.fog.color.set(0x17273a);}if(pilot)pilot.visible=false;renderer.toneMappingExposure=profile.exposure||1.08;
      await new Promise(resolve=>setTimeout(resolve,280));
      updateCamera(1);if(record){record.root.visible=true;record.near.visible=true;record.far.visible=false;}if(pilot)pilot.visible=false;renderer.render(scene,camera);
      const source=renderer.domElement,out=document.createElement("canvas"),ctx=out.getContext("2d");out.width=1040;out.height=460;
      const cropHeight=Math.min(source.height,source.width/(out.width/out.height)),cropTop=Math.max(0,(source.height-cropHeight)*.48);
      ctx.drawImage(source,0,cropTop,source.width,cropHeight,0,0,out.width,out.height);
      return{name:location.name,data:out.toDataURL("image/webp",.9),target:[+targetX.toFixed(1),+targetZ.toFixed(1)],bounds};
    },{id,profile});
    const bytes=Buffer.from(capture.data.split(",")[1],"base64"),file=path.join(output,id+".webp");fs.writeFileSync(file,bytes);
    captures.push({id,name:capture.name,data:capture.data,bytes:bytes.length,target:capture.target,bounds:capture.bounds});
    console.log(`${id} ${bytes.length} bytes target ${capture.target.join(",")}`);
    await page.close();
  }

  const page=await browser.newPage();
  const sheet=await page.evaluate(async captures=>{
    const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=1080;canvas.height=1300;ctx.fillStyle="#071116";ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let index=0;index<captures.length;index++){
      const item=captures[index],image=new Image();image.src=item.data;await image.decode();const col=index%2,row=Math.floor(index/2),x=20+col*530,y=20+row*255;
      ctx.drawImage(image,x,y,510,226);ctx.fillStyle="rgba(4,12,16,.82)";ctx.fillRect(x,y+194,510,32);ctx.fillStyle="#dff8f4";ctx.font="700 15px system-ui";ctx.fillText(String(index+1).padStart(2,"0")+"  "+item.name.toUpperCase(),x+12,y+216);
    }
    return canvas.toDataURL("image/png");
  },captures);
  fs.writeFileSync(path.join(artifacts,"destination-art-contact-sheet.png"),Buffer.from(sheet.split(",")[1],"base64"));
  fs.writeFileSync(path.join(output,"manifest.json"),JSON.stringify({version:1,source:"Fable Flight Three.js world captures",width:1040,height:460,files:captures.map(({id,name,bytes,target,bounds})=>({id,name,file:id+".webp",bytes,target,bounds}))},null,2)+"\n");
  await page.close();
  await browser.close();
}

main().catch(error=>{console.error(error);process.exitCode=1;});
