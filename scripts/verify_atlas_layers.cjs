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
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().hits.length===10&&SIM.liveAtlas().layer==="terrain",null,{timeout:30000});
  await page.waitForTimeout(400);

  const initial=await page.evaluate(()=>({state:SIM.liveAtlas(),tabs:[...atlasLayerButtons].map(button=>({layer:button.dataset.atlasLayer,selected:button.getAttribute("aria-selected"),tabIndex:button.tabIndex,text:button.textContent.trim()})),view:atlasViewState.textContent,live:atlasLiveEl.textContent}));
  const storm=initial.state.hits.find(hit=>hit.id==="stormhaven"),map=await page.locator("#islandMapCanvas").boundingBox();
  await page.mouse.click(map.x+storm.x,map.y+storm.y);await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="stormhaven");
  await page.locator('[data-atlas-layer="weather"]').click();await page.waitForFunction(()=>SIM.liveAtlas().layer==="weather"&&SIM.liveAtlas().layerStats.weatherCells>=4);
  await page.locator("#atlasFitRoute").click();await page.waitForFunction(()=>SIM.liveAtlas().routeFramed);
  const weather=await page.evaluate(()=>({state:SIM.liveAtlas(),selected:[...atlasLayerButtons].find(button=>button.getAttribute("aria-selected")==="true")?.dataset.atlasLayer||"",view:atlasViewState.textContent,live:atlasLiveEl.textContent,route:document.querySelector(".destination-route")?.innerText||"",stage:(()=>{const r=atlasMapStage.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};})(),tabs:[...atlasLayerButtons].map(button=>{const r=button.getBoundingClientRect();return{layer:button.dataset.atlasLayer,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})}));
  await page.screenshot({path:path.join(artifacts,"training-atlas-weather-desktop.png")});

  await page.locator('[data-atlas-layer="weather"]').focus();await page.keyboard.press("ArrowRight");await page.waitForFunction(()=>SIM.liveAtlas().layer==="traffic");
  const keyboardFocus=await page.evaluate(()=>document.activeElement?.dataset?.atlasLayer||"");
  await page.locator("#islandMapCanvas").focus();await page.locator(".destination-card").waitFor({state:"visible"});await page.waitForTimeout(400);
  const traffic=await page.evaluate(focused=>({state:SIM.liveAtlas(),selected:[...atlasLayerButtons].find(button=>button.getAttribute("aria-selected")==="true")?.dataset.atlasLayer||"",focused,view:atlasViewState.textContent,live:atlasLiveEl.textContent,routeFramed:atlasFitRoute.getAttribute("aria-pressed"),stored:localStorage.getItem("fable-atlas-layer-v1"),layout:(()=>{const bounds=selector=>{const element=document.querySelector(selector),rect=element?.getBoundingClientRect();return{visible:!!element&&getComputedStyle(element).visibility!=="hidden"&&getComputedStyle(element).display!=="none",left:rect?.left||0,right:rect?.right||0,top:rect?.top||0,bottom:rect?.bottom||0};};return{title:bounds("#missionBoardTitle"),career:bounds("#careerBoard"),map:bounds("#atlasMapStage"),card:bounds("#missionBoard .destination-card")};})()}),keyboardFocus);
  await page.screenshot({path:path.join(artifacts,"training-atlas-traffic-desktop.png"),animations:"disabled"});

  await page.evaluate(()=>SIM.hideMissionBoard());await page.evaluate(()=>SIM.openMissionBoard());await page.waitForFunction(()=>SIM.liveAtlas().layer==="traffic");
  const reopened=await page.evaluate(()=>({state:SIM.liveAtlas(),selected:[...atlasLayerButtons].find(button=>button.getAttribute("aria-selected")==="true")?.dataset.atlasLayer||"",destination:document.querySelector(".destination-card h3")?.textContent||""}));

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(220);
  await page.locator('[data-atlas-layer="weather"]').click();await page.waitForFunction(()=>SIM.liveAtlas().layer==="weather");await page.waitForTimeout(180);
  const mobile=await page.evaluate(()=>{const stage=atlasMapStage.getBoundingClientRect(),brief=atlasMobileBrief.getBoundingClientRect(),tabs=atlasLayerButtons.map(button=>{const r=button.getBoundingClientRect();return{layer:button.dataset.atlasLayer,left:r.left,right:r.right,top:r.top,bottom:r.bottom,selected:button.getAttribute("aria-selected")};});return{overflow:document.documentElement.scrollWidth-innerWidth,state:SIM.liveAtlas(),stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom},brief:{left:brief.left,right:brief.right,top:brief.top,bottom:brief.bottom},tabs,view:atlasViewState.textContent,live:atlasLiveEl.textContent};});
  await page.screenshot({path:path.join(artifacts,"training-atlas-weather-mobile.png")});

  const tabsInside=(tabs,stage)=>tabs.every(tab=>tab.left>=stage.left&&tab.right<=stage.right&&tab.top>=stage.top&&tab.bottom<=stage.bottom);
  const checks={
    terrainDefault:initial.state.layer==="terrain"&&initial.tabs.find(tab=>tab.layer==="terrain")?.selected==="true"&&initial.view.includes("ISLAND"),
    authoredWeather:weather.state.layer==="weather"&&weather.state.layerStats.weatherCells>=4&&weather.state.layerStats.selectedRegime==="heavy-rain"&&weather.live.includes("WX LIVE")&&weather.route.includes("RAIN"),
    routeContinuity:weather.state.routeFramed&&weather.state.selectedId==="stormhaven"&&weather.state.route.length>1&&weather.state.routeChevrons>=2,
    desktopLayerFit:tabsInside(weather.tabs,weather.stage),
    keyboardLayerNavigation:traffic.state.layer==="traffic"&&traffic.selected==="traffic"&&traffic.focused==="traffic",
    liveTrafficPicture:traffic.state.layerStats.trafficTracks>=1&&traffic.live.includes("TRACKS")&&traffic.view.includes("TRAFFIC"),
    trafficLayoutVisible:Object.values(traffic.layout).every(item=>item.visible&&item.right>item.left&&item.bottom>item.top)&&traffic.layout.card.left>traffic.layout.map.left,
    viewContinuity:traffic.state.routeFramed&&traffic.routeFramed==="true"&&traffic.state.selectedId==="stormhaven"&&traffic.state.zoom===weather.state.zoom&&traffic.state.center.join(",")===weather.state.center.join(","),
    layerPersists:traffic.stored==="traffic"&&reopened.state.layer==="traffic"&&reopened.selected==="traffic"&&reopened.destination==="Stormhaven",
    mobileLayerFit:mobile.overflow<=0&&tabsInside(mobile.tabs,mobile.stage)&&mobile.brief.left>=mobile.stage.left&&mobile.brief.right<=mobile.stage.right&&mobile.brief.bottom<=mobile.stage.bottom,
    mobileTouchLayer:mobile.state.layer==="weather"&&mobile.tabs.find(tab=>tab.layer==="weather")?.selected==="true"&&mobile.state.selectedId==="stormhaven"&&mobile.live.includes("WX LIVE"),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,weather,traffic,reopened,mobile,errors};
  fs.writeFileSync(path.join(artifacts,"atlas-layers-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial,weather,traffic,reopened,mobile,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
