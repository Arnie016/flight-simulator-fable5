#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const project=path.resolve(__dirname,"..");
const artifacts=path.join(project,"artifacts");
const baseUrl=process.env.FABLE_URL||"http://127.0.0.1:8643";
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function cleanLabelLayout(layout,width,height){
  const boxes=[...(layout?.shown||[]),...(layout?.endpoints||[]),...(layout?.focus?[layout.focus]:[])];
  return boxes.every(box=>box.x>=0&&box.y>=0&&box.x+box.w<=width&&box.y+box.h<=height)&&boxes.every((box,index)=>boxes.slice(index+1).every(other=>!overlaps(box,other)));
}
function routeInSafeFrame(state,inset=24){return state.route.every(id=>{const hit=state.hits.find(item=>item.id===id);return hit&&hit.x>=inset&&hit.x<=state.width-inset&&hit.y>=inset&&hit.y<=state.height-inset;});}

async function main(){
  fs.mkdirSync(artifacts,{recursive:true});
  const systemChrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser=await chromium.launch({headless:true,...(fs.existsSync(systemChrome)?{executablePath:systemChrome}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}),errors=[];
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push("console: "+message.text());});
  await page.goto(baseUrl,{waitUntil:"commit"});
  await page.waitForFunction(()=>window.SIM&&SIM.bootState().firstFrame,null,{timeout:30000});
  await page.evaluate(()=>{if(BOOT.active){BOOT.ready=true;enterFlight();}boot.style.display="none";document.body.classList.remove("booting");SIM.setCam(1);updateCamera(.016);SIM.openMissionBoard();});
  await page.waitForFunction(()=>SIM.liveAtlas().ready&&SIM.liveAtlas().frames>=3&&SIM.liveAtlas().hits.length===10&&SIM.liveAtlas().cartography?.zoneCount===5,null,{timeout:30000});
  await page.waitForTimeout(900);

  const initial=await page.evaluate(()=>{const stage=atlasMapStage.getBoundingClientRect(),canvas=islandMapCanvas.getBoundingClientRect(),state=SIM.liveAtlas();return{state,stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom,width:stage.width,height:stage.height},canvas:{width:canvas.width,height:canvas.height,bufferWidth:islandMapCanvas.width,bufferHeight:islandMapCanvas.height},view:atlasViewState.textContent,card:locationGrid.innerText};});
  await page.screenshot({path:path.join(artifacts,"training-atlas-full-island-desktop.png")});
  const frontier=initial.state.hits.find(hit=>hit.id==="frontierField"),mapBox=await page.locator("#islandMapCanvas").boundingBox();
  await page.mouse.click(mapBox.x+frontier.x,mapBox.y+frontier.y);
  await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="frontierField");
  const selected=await page.evaluate(()=>{const focus=atlasFocus.getBoundingClientRect(),stage=atlasMapStage.getBoundingClientRect();return{state:SIM.liveAtlas(),route:document.querySelector(".destination-route")?.innerText||"",objective:document.querySelector(".destination-copy p")?.textContent||"",lessons:[...document.querySelectorAll(".ground-mission strong")].map(node=>node.textContent),focus:{id:atlasFocus.dataset.id,text:atlasFocus.innerText,left:focus.left,right:focus.right,top:focus.top,bottom:focus.bottom,stageLeft:stage.left,stageRight:stage.right,stageTop:stage.top,stageBottom:stage.bottom}};});
  const breakwater=selected.state.hits.find(hit=>hit.id==="breakwater");
  await page.mouse.move(mapBox.x+breakwater.x,mapBox.y+breakwater.y);await page.waitForFunction(()=>SIM.liveAtlas().focusId==="breakwater");
  const hovered=await page.evaluate(()=>({focusId:SIM.liveAtlas().focusId,focus:atlasFocus.innerText,selectedId:SIM.liveAtlas().selectedId,card:document.querySelector(".destination-card h3")?.textContent||""}));
  await page.mouse.move(mapBox.x-5,mapBox.y+mapBox.height*.5);await page.waitForFunction(()=>SIM.liveAtlas().focusId==="frontierField");

  await page.mouse.move(mapBox.x+mapBox.width*.68,mapBox.y+mapBox.height*.48);await page.mouse.wheel(0,-1400);await page.waitForTimeout(220);
  const zoomed=await page.evaluate(()=>({state:SIM.liveAtlas(),view:atlasViewState.textContent,canvasLabel:islandMapCanvas.getAttribute("aria-label")}));
  const panPoint=await page.evaluate(()=>{const state=SIM.liveAtlas(),w=islandMapCanvas.clientWidth,h=islandMapCanvas.clientHeight;let best={x:w*.5,y:h*.8,distance:0};for(let gy=2;gy<=8;gy++)for(let gx=2;gx<=8;gx++){const x=w*gx/10,y=h*gy/10,distance=Math.min(...state.hits.map(hit=>Math.hypot(hit.x-x,hit.y-y)));if(distance>best.distance)best={x,y,distance};}return best;});
  await page.mouse.move(mapBox.x+panPoint.x,mapBox.y+panPoint.y);await page.mouse.down();await page.mouse.move(mapBox.x+panPoint.x+86,mapBox.y+panPoint.y+48,{steps:6});await page.mouse.up();await page.waitForTimeout(180);
  const panned=await page.evaluate(()=>({state:SIM.liveAtlas(),selected:document.querySelector(".destination-card h3")?.textContent||"",panning:islandMapCanvas.classList.contains("panning")}));
  await page.screenshot({path:path.join(artifacts,"training-atlas-desktop.png")});

  await page.click("#atlasFitRoute");await page.waitForFunction(()=>SIM.liveAtlas().routeFramed);
  const routeFramed=await page.evaluate(()=>({state:SIM.liveAtlas(),pressed:atlasFitRoute.getAttribute("aria-pressed"),title:atlasFitRoute.title,focusId:SIM.liveAtlas().focusId,focus:atlasFocus.innerText}));
  await page.screenshot({path:path.join(artifacts,"training-atlas-route-framed-desktop.png")});
  await page.locator("#islandMapCanvas").focus();await page.keyboard.press("ArrowRight");await page.waitForTimeout(100);
  const routeUnframed=await page.evaluate(()=>({state:SIM.liveAtlas(),pressed:atlasFitRoute.getAttribute("aria-pressed")}));
  await page.keyboard.press("f");await page.waitForFunction(()=>SIM.liveAtlas().routeFramed);
  const keyboardRouteFrame=await page.evaluate(()=>({state:SIM.liveAtlas(),pressed:atlasFitRoute.getAttribute("aria-pressed")}));

  await page.click("#atlasResetView");await page.locator("#islandMapCanvas").focus();await page.keyboard.press("=");await page.keyboard.press("ArrowRight");await page.waitForTimeout(120);
  const keyboard=await page.evaluate(()=>SIM.liveAtlas());
  await page.locator("#destinationNext").focus();await page.keyboard.press("Enter");await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="silverLake");
  const keyboardDestination=await page.evaluate(()=>({selectedId:SIM.liveAtlas().selectedId,title:document.querySelector(".destination-card h3")?.textContent||"",launchDisabled:document.querySelector("#destinationLaunch")?.disabled===true}));
  await page.locator("#destinationPrev").focus();await page.keyboard.press("Enter");await page.waitForFunction(()=>SIM.liveAtlas().selectedId==="frontierField");
  await page.locator("#islandMapCanvas").focus();await page.keyboard.press("Home");await page.waitForTimeout(100);
  const reset=await page.evaluate(()=>SIM.liveAtlas());
  const cockpitReturn=await page.evaluate(()=>{SIM.hideMissionBoard();return{board:SIM.boardState().visible,cockpit:document.body.classList.contains("cockpit-view"),camera:SIM.camInfo().mode};});

  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>SIM.openMissionBoard());await page.waitForFunction(()=>SIM.liveAtlas().hits.length===10);await page.click("#atlasZoomIn");await page.waitForTimeout(180);
  const mobile=await page.evaluate(()=>{const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(),stage=atlasMapStage.getBoundingClientRect(),tools=atlasMapStage.querySelector(".atlas-tools").getBoundingClientRect(),card=locationGrid.getBoundingClientRect(),focus=atlasFocus.getBoundingClientRect(),brief=atlasMobileBrief.getBoundingClientRect(),state=SIM.liveAtlas();return{overflow:document.documentElement.scrollWidth-innerWidth,state,sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom},stage:{left:stage.left,right:stage.right,top:stage.top,bottom:stage.bottom,width:stage.width,height:stage.height},tools:{left:tools.left,right:tools.right,top:tools.top,bottom:tools.bottom},focus:{left:focus.left,right:focus.right,top:focus.top,bottom:focus.bottom,text:atlasFocus.innerText,id:atlasFocus.dataset.id||null,hidden:atlasFocus.classList.contains("hidden"),display:getComputedStyle(atlasFocus).display,ariaHidden:atlasFocus.getAttribute("aria-hidden")},brief:{left:brief.left,right:brief.right,top:brief.top,bottom:brief.bottom,text:atlasMobileBrief.innerText,route:atlasMobileRoute.textContent},card:{left:card.left,right:card.right,top:card.top,bottom:card.bottom}};});
  const mobileMapBox=await page.locator("#islandMapCanvas").boundingBox(),mobileBreakwater=mobile.state.hits.find(hit=>hit.id==="breakwater");
  const mobilePoint={x:mobileMapBox.x+mobileBreakwater.x,y:mobileMapBox.y+mobileBreakwater.y},mobileTarget=await page.evaluate(({x,y})=>{const node=document.elementFromPoint(x,y);return{id:node?.id||"",className:node?.className||"",tag:node?.tagName||""};},mobilePoint);
  await page.mouse.click(mobilePoint.x,mobilePoint.y);await page.waitForTimeout(250);
  const mobileSelection=await page.evaluate(()=>({selectedId:SIM.liveAtlas().selectedId,title:document.querySelector(".destination-card h3")?.textContent||"",focusId:SIM.liveAtlas().focusId,focusCollapsed:SIM.liveAtlas().mobileFocusCollapsed,route:atlasMobileRoute.textContent}));
  await page.click("#atlasFitRoute");await page.waitForFunction(()=>SIM.liveAtlas().routeFramed);
  const mobileRouteFrame=await page.evaluate(()=>({state:SIM.liveAtlas(),pressed:atlasFitRoute.getAttribute("aria-pressed"),focusId:SIM.liveAtlas().focusId}));
  await page.screenshot({path:path.join(artifacts,"training-atlas-mobile.png")});

  const aspect=initial.state.halfExtents[0]/initial.state.halfExtents[1],stageAspect=initial.stage.width/initial.stage.height;
  const checks={
    crispOverlay:initial.state.overlayDpr===2&&Math.abs(initial.canvas.bufferWidth-initial.canvas.width*2)<=2&&Math.abs(initial.canvas.bufferHeight-initial.canvas.height*2)<=2,
    terrainRelief:initial.state.cartography?.palette==="regional-relief-v3"&&initial.state.cartography.zoneCount===5&&initial.state.cartography.regionCount===5&&initial.state.cartography.reliefRange[1]-initial.state.cartography.reliefRange[0]>1200&&initial.state.cartography.hillshadeRange[1]-initial.state.cartography.hillshadeRange[0]>.4&&Object.values(initial.state.cartography.bands).every(Boolean)&&Object.values(initial.state.cartography.regions).every(Boolean),
    aspectCorrect:Math.abs(aspect-stageAspect)<.02,
    tenDestinations:initial.state.hits.length===10,
    progressiveRegionDisclosure:initial.state.labelLayout.focus.id==="academy"&&initial.state.labelLayout.shown.length===0&&initial.state.labelLayout.hidden.length===0&&zoomed.state.labelLayout.shown.length>0&&zoomed.state.labelLayout.shown.every(label=>label.text.includes("L")),
    collisionFreeLabels:cleanLabelLayout(initial.state.labelLayout,initial.state.width,initial.state.height)&&cleanLabelLayout(selected.state.labelLayout,selected.state.width,selected.state.height)&&cleanLabelLayout(panned.state.labelLayout,panned.state.width,panned.state.height),
    routeSelection:selected.state.selectedId==="frontierField"&&selected.state.route.length>1&&selected.route.includes("KM")&&selected.route.includes("V90")&&selected.lessons.length===2,
    crispFocusCard:selected.state.focusId==="frontierField"&&selected.focus.id==="frontierField"&&selected.focus.text.includes("Frontier Field")&&selected.focus.text.includes("ETA")&&selected.focus.left>=selected.focus.stageLeft&&selected.focus.right<=selected.focus.stageRight&&selected.focus.top>=selected.focus.stageTop&&selected.focus.bottom<=selected.focus.stageBottom,
    hoverPreview:hovered.focusId==="breakwater"&&hovered.focus.includes("Breakwater Bay")&&hovered.selectedId==="frontierField"&&hovered.card==="Frontier Field",
    directionalRoute:selected.state.routeChevrons===2,
    objectivePreview:selected.objective.includes("dispatch bag")||selected.objective.includes("valley route"),
    wheelZoom:zoomed.state.zoom>2&&zoomed.state.detail==="airspace"&&zoomed.canvasLabel.includes("airspace"),
    dragPan:Math.hypot(panned.state.center[0]-zoomed.state.center[0],panned.state.center[1]-zoomed.state.center[1])>50&&panned.state.selectedId==="frontierField"&&!panned.panning,
    routeFrame:routeFramed.state.routeFramed&&routeFramed.pressed==="true"&&routeFramed.title==="Frame selected route"&&routeFramed.focusId==="frontierField"&&routeFramed.state.zoom>1&&routeInSafeFrame(routeFramed.state),
    routeFocusedLabels:routeFramed.state.labelLayout.mode==="route"&&routeFramed.state.labelLayout.routeIds.join(",")===routeFramed.state.route.join(",")&&routeFramed.state.labelLayout.shown.every(label=>routeFramed.state.route.includes(label.id))&&routeFramed.state.labelLayout.suppressed.length>=4,
    routeEndpoints:routeFramed.state.labelLayout.endpoints.length===2&&routeFramed.state.labelLayout.endpoints[0].id===routeFramed.state.route[0]&&routeFramed.state.labelLayout.endpoints[0].role==="DEP"&&routeFramed.state.labelLayout.endpoints[1].id===routeFramed.state.route.at(-1)&&routeFramed.state.labelLayout.endpoints[1].role==="ARR"&&routeFramed.focus.includes("ARRIVAL"),
    manualNavigationClearsFrame:!routeUnframed.state.routeFramed&&routeUnframed.pressed==="false",
    keyboardRouteFrame:keyboardRouteFrame.state.routeFramed&&keyboardRouteFrame.pressed==="true"&&routeInSafeFrame(keyboardRouteFrame.state),
    keyboardNavigation:keyboard.zoom>1&&Math.abs(keyboard.center[0])>1,
    keyboardDestinationSelection:keyboardDestination.selectedId==="silverLake"&&keyboardDestination.title==="Silver Lake"&&keyboardDestination.launchDisabled,
    resetView:reset.zoom===1&&Math.abs(reset.center[0])<1&&Math.abs(reset.center[1]+450)<1,
    cockpitContinuity:!cockpitReturn.board&&cockpitReturn.cockpit&&cockpitReturn.camera==="COCKPIT",
    mobileFit:mobile.overflow<=0&&mobile.stage.left>=mobile.sheet.left&&mobile.stage.right<=mobile.sheet.right&&mobile.tools.left>=mobile.stage.left&&mobile.tools.right<=mobile.stage.right&&mobile.focus.hidden&&mobile.focus.display==="none"&&mobile.focus.ariaHidden==="true"&&mobile.state.mobileFocusCollapsed&&mobile.brief.left>=mobile.stage.left&&mobile.brief.right<=mobile.stage.right&&mobile.brief.top>=mobile.stage.top&&mobile.brief.bottom<=mobile.stage.bottom&&mobile.brief.route.includes("CLR")&&mobile.card.left>=mobile.sheet.left&&mobile.card.right<=mobile.sheet.right&&mobile.state.zoom>1&&mobile.state.labelLayout.shown.length===0,
    mobileMarkerSelection:mobileSelection.selectedId==="breakwater"&&mobileSelection.title==="Breakwater Bay"&&mobileSelection.focusId===null&&mobileSelection.focusCollapsed&&mobileSelection.route.includes("CLR"),
    mobileRouteFrame:mobileRouteFrame.state.routeFramed&&mobileRouteFrame.pressed==="true"&&mobileRouteFrame.state.selectedId==="breakwater"&&mobileRouteFrame.state.mobileFocusCollapsed&&mobileRouteFrame.state.labelLayout.mode==="route"&&mobileRouteFrame.state.labelLayout.shown.length===0&&mobileRouteFrame.state.labelLayout.endpoints.length===2&&routeInSafeFrame(mobileRouteFrame.state,18),
    zeroConsoleErrors:errors.length===0
  };
  const report={ok:Object.values(checks).every(Boolean),checks,initial,selected,hovered,zoomed,panned,panPoint,routeFramed,routeUnframed,keyboardRouteFrame,keyboard,keyboardDestination,reset,cockpitReturn,mobile,mobilePoint,mobileTarget,mobileSelection,mobileRouteFrame,errors};
  fs.writeFileSync(path.join(artifacts,"atlas-navigation-verification.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({ok:report.ok,checks,initial:{state:initial.state,stage:initial.stage,canvas:initial.canvas},selected,hovered,zoomed,panned,routeFramed,routeUnframed,keyboardRouteFrame,keyboard,keyboardDestination,reset,cockpitReturn,mobile,mobilePoint,mobileTarget,mobileSelection,mobileRouteFrame,errors},null,2));
  await browser.close();process.exitCode=report.ok?0:1;
}

main().catch(error=>{console.error(error);process.exitCode=1;});
