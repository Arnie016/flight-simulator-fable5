#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";
const MB = 1024 * 1024;
let activeBrowser = null;

async function main() {
  fs.mkdirSync(artifacts, { recursive:true });
  const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = activeBrowser = await chromium.launch({ headless:true, ...(fs.existsSync(systemChrome) ? { executablePath:systemChrome } : {}) });
  const context = await browser.newContext({ viewport:{ width:1440, height:900 } });
  const page = await context.newPage(), errors = [], resources = new Map();
  page.setDefaultTimeout(8000);
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  page.on("response", response => {
    if (!/^https?:/.test(response.url()) || response.status() >= 400) return;
    const url = new URL(response.url()), relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const localPath = path.resolve(project, relative);
    const insideProject = localPath === project || localPath.startsWith(project + path.sep);
    const bytes = insideProject && fs.existsSync(localPath) && fs.statSync(localPath).isFile() ? fs.statSync(localPath).size : +(response.headers()["content-length"] || 0);
    const prior = resources.get(response.url());
    if (!prior || bytes > prior.bytes) resources.set(response.url(), { bytes, status:response.status(), type:response.request().resourceType() });
  });

  await page.goto(baseUrl, { waitUntil:"domcontentloaded", timeout:30000 });
  await page.waitForFunction(() => window.SIM && SIM.bootState().ready, null, { timeout:30000 });
  const preLaunch = await page.evaluate(() => ({ world:SIM.worldLocations(), assets:SIM.islandAssets(), profile:SIM.pilotProfile() }));
  await page.evaluate(() => { applyGraphicsQuality("low", false); window.requestAnimationFrame = () => 0; });
  const enterPoint = await page.evaluate(() => { const rect=bootEnter.getBoundingClientRect(); return { x:rect.left+rect.width/2, y:rect.top+rect.height/2 }; });
  await page.mouse.click(enterPoint.x, enterPoint.y);
  await page.waitForTimeout(2600);
  const criticalUrls = new Set(resources.keys()), criticalBytes = [...criticalUrls].reduce((sum, url) => sum + resources.get(url).bytes, 0);

  const travel = [];
  for (const location of preLaunch.world.locations) {
    const boardReady = await page.evaluate(() => { S.paused = true; SIM.openMissionBoard(); drawIslandAtlas(); return SIM.boardState().visible && WORLD_STATE.mapHits.length === 10; });
    if (!boardReady) throw new Error("Mission board did not render ten destination pins for " + location.id);
    await page.waitForTimeout(450);
    const point = await page.evaluate(id => {
      drawIslandAtlas();
      const hit = WORLD_STATE.mapHits.find(pin => pin.id === id), rect = islandMapCanvas.getBoundingClientRect();
      return { x:rect.left + hit.x / islandMapCanvas.width * rect.width, y:rect.top + hit.y / islandMapCanvas.height * rect.height };
    }, location.id);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(80);
    if (!await page.evaluate(id => BOARD.selectedId === id, location.id)) throw new Error("Map selection missed " + location.id);
    const travelPoint = await page.evaluate(() => { const rect=destinationTravel.getBoundingClientRect(); return { x:rect.left+rect.width/2, y:rect.top+rect.height/2 }; });
    await page.mouse.click(travelPoint.x, travelPoint.y);
    await page.waitForTimeout(80);
    if (!await page.evaluate(id => SIM.worldLocations().currentId === id && SIM.worldLocations().fastTravelId === id, location.id)) throw new Error("Fast travel did not select " + location.id);
    const state = await page.evaluate(() => { SIM.warp(.25); return { snap:SIM.snap(), world:SIM.worldLocations(), profile:SIM.pilotProfile(), assets:SIM.islandAssets(), agl:SIM.agl() }; });
    travel.push({ id:location.id, actions:2, state });
    console.log("travel_verified " + location.id);
  }
  await page.waitForFunction(() => SIM.islandAssets().status === "ready", null, { timeout:15000 });
  await page.waitForTimeout(450);
  const postTravel = await page.evaluate(() => {
    const assets = SIM.islandAssets(), kauri = ENV.islandWorld.kauriTownship, shepherd = ENV.islandWorld.shepherdHighlands;
    return {
      world:SIM.worldLocations(), assets, profile:SIM.pilotProfile(),
      instancing:{
        kauri:kauri.near.children.filter(child => child.isInstancedMesh).map(mesh => mesh.count),
        shepherd:shepherd.near.children.filter(child => child.isInstancedMesh).map(mesh => mesh.count)
      },
      collisions:{ total:obstacles.length, boxes:obstacles.filter(item => item.min?.isVector3 && item.max?.isVector3).length, birds:obstacles.filter(item => /bird/i.test(item.label || "")).length },
      renderer:{ calls:renderer.info.render.calls, triangles:renderer.info.render.triangles }
    };
  });

  await page.evaluate(() => SIM.openMissionBoard());
  await page.evaluate(() => { renderLiveAtlas(performance.now() + 1000); drawIslandAtlas(); });
  await page.waitForTimeout(120);
  const desktop = await page.evaluate(() => {
    const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(), map=islandMapCanvas.getBoundingClientRect();
    return { overflow:document.documentElement.scrollWidth-innerWidth, sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom}, map:{width:map.width,height:map.height}, atlas:SIM.liveAtlas() };
  });
  await page.screenshot({ path:path.join(artifacts, "island-alpha-final-board-desktop.png"), timeout:30000 });
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => { renderLiveAtlas(performance.now() + 2000); drawIslandAtlas(); });
  await page.waitForTimeout(120);
  const mobile = await page.evaluate(() => {
    const sheet=missionBoardEl.querySelector(".sheet").getBoundingClientRect(), map=islandMapCanvas.getBoundingClientRect();
    return { overflow:document.documentElement.scrollWidth-innerWidth, sheet:{left:sheet.left,right:sheet.right,top:sheet.top,bottom:sheet.bottom}, map:{width:map.width,height:map.height} };
  });
  await page.screenshot({ path:path.join(artifacts, "island-alpha-final-board-mobile.png"), timeout:30000 });

  const audioManifest = JSON.parse(fs.readFileSync(path.join(project, "assets/audio/library/manifest.json"), "utf8"));
  const kenneyManifest = fs.readFileSync(path.join(project, "assets/source-packs/kenney/ASSET_MANIFEST.md"), "utf8");
  const natureLicense = fs.readFileSync(path.join(project, "assets/source-packs/kenney/nature-kit/License.txt"), "utf8");
  const survivalLicense = fs.readFileSync(path.join(project, "assets/source-packs/kenney/survival-kit/License.txt"), "utf8");
  const readme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  const audioFiles = audioManifest.files || [];
  const runtimePackBytes = fs.statSync(path.join(project, "assets/runtime/island-runtime-pack.js")).size;
  const allResources = [...resources.entries()].map(([url, entry]) => ({ url, ...entry }));
  const runtimeRequests = allResources.filter(entry => entry.url.includes("/assets/runtime/island-runtime-pack.js"));
  const names = preLaunch.world.locations.map(location => location.name);
  const identities = preLaunch.world.locations.map(location => location.identity);
  const regionValues = Object.values(postTravel.assets.regions), totalInstances = regionValues.reduce((sum, region) => sum + region.instances, 0), totalDraws = regionValues.reduce((sum, region) => sum + region.draws, 0);
  const bands = new Set(regionValues.map(region => region.band));
  const checks = {
    tenNamedLocations:preLaunch.world.count === 10 && new Set(names).size === 10 && ["Academy Airfield", "Breakwater Bay", "Alpine Rescue Ridge", "Stormhaven", "Red Mesa Outpost", "Frontier Field", "Silver Lake", "Kauri Township", "Shepherd Highlands", "Ember Ruins"].every(name => names.includes(name)),
    twoActionTravel:travel.length === 10 && travel.every(result => result.actions === 2 && result.state.world.currentId === result.id && result.state.world.fastTravelId === result.id),
    safeSpawns:travel.every(result => !result.state.snap.crashed && result.state.agl >= -.2 && Number.isFinite(result.state.snap.x) && Number.isFinite(result.state.snap.alt) && Number.isFinite(result.state.snap.z)),
    travelPreservesProgress:travel.every(result => result.state.profile.xp === preLaunch.profile.xp) && postTravel.profile.xp === preLaunch.profile.xp,
    distinctLocationIdentity:new Set(identities.map(identity => identity.silhouette)).size === 10 && new Set(identities.map(identity => identity.landmark)).size === 10,
    distinctSoundAndActivity:new Set(preLaunch.world.locations.map(location => location.ambience)).size === 10 && new Set(preLaunch.world.locations.map(location => location.activity)).size === 10,
    populatedTown:postTravel.instancing.kauri.length >= 7 && postTravel.instancing.kauri.reduce((sum, count) => sum + count, 0) >= 130 && postTravel.assets.activity.kauriStreetLights === 18 && postTravel.assets.activity.kauriVehicle,
    populatedHighlands:postTravel.assets.activity.sheep === 52 && postTravel.instancing.shepherd.length >= 6 && postTravel.instancing.shepherd.reduce((sum, count) => sum + count, 0) >= 300,
    populatedWaterAndAir:postTravel.assets.activity.birds >= 32 && postTravel.assets.activity.watercraft >= 2 && postTravel.assets.activity.islandFlights >= 3 && postTravel.assets.activity.groundVehicles >= 4,
    birdsRenderOnly:postTravel.collisions.birds === 0,
    simpleCollisionProxies:postTravel.collisions.total >= 20 && postTravel.collisions.total === postTravel.collisions.boxes,
    instancingEfficient:totalInstances >= 850 && totalInstances / Math.max(1, totalDraws) >= 8,
    cullingBands:bands.has("near") && (bands.has("far") || bands.has("dormant")) && postTravel.world.streaming.near.length >= 1 && postTravel.world.streaming.dormant.length >= 1,
    lazyRuntimePack:preLaunch.assets.status === "idle" && ![...criticalUrls].some(url => url.includes("island-runtime-pack.js")) && runtimeRequests.length === 1 && postTravel.assets.status === "ready",
    runtimePackBudget:runtimePackBytes <= 25 * MB && postTravel.assets.encodedBytes <= 25 * MB && postTravel.assets.assetCount === 21 && postTravel.assets.materialCount === 48,
    criticalLoadBudget:criticalBytes <= 35 * MB,
    sourceArchivesNotLoaded:allResources.every(entry => !entry.url.includes("/assets/source-packs/")),
    kenneyLicense:postTravel.assets.license === "CC0-1.0" && /Creative Commons CC0/.test(kenneyManifest) && /Creative Commons Zero, CC0/.test(natureLicense) && /Creative Commons Zero, CC0/.test(survivalLicense),
    audioLicenseManifest:audioManifest.source === "Mixkit Free Sound Effects" && /mixkit\.co\/license/.test(audioManifest.license) && audioFiles.length === 14 && audioFiles.every(file => file.file && file.title && file.role && file.download_url && fs.existsSync(path.join(project, "assets/audio/library", file.file))),
    externalAudioAttribution:/user-supplied ElevenLabs renders/.test(readme) && /WuxiaScrub/.test(readme) && /CC0/.test(readme),
    sketchfabAttribution:/antonmoek/.test(readme) && /CC BY 4\.0/.test(readme),
    desktopFit:desktop.overflow <= 0 && desktop.sheet.left >= 0 && desktop.sheet.right <= 1440 && desktop.sheet.top >= 0 && desktop.sheet.bottom <= 900 && desktop.map.width > 500,
    mobileFit:mobile.overflow <= 0 && mobile.sheet.left >= 0 && mobile.sheet.right <= 390 && mobile.sheet.top >= 0 && mobile.sheet.bottom <= 844 && mobile.map.width > 300,
    liveAtlas:desktop.atlas.ready && !desktop.atlas.failed && desktop.atlas.frames >= 1 && desktop.atlas.aircraft >= 2,
    zeroConsoleErrors:errors.length === 0
  };
  const report = {
    ok:Object.values(checks).every(Boolean), checks,
    payload:{ criticalBytes, criticalMB:+(criticalBytes / MB).toFixed(2), runtimePackBytes, runtimePackMB:+(runtimePackBytes / MB).toFixed(3), criticalResources:allResources.filter(entry => criticalUrls.has(entry.url)), runtimeRequests },
    preLaunch, travel, postTravel, desktop, mobile, licenses:{ audioFiles:audioFiles.length, kenney:postTravel.assets.license }, errors
  };
  fs.writeFileSync(path.join(artifacts, "island-world-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok:report.ok, checks, payload:report.payload, errors }, null, 2));
  await browser.close(); activeBrowser = null;
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(async error => {
  console.error(error);
  if (activeBrowser) await activeBrowser.close().catch(() => {});
  process.exitCode = 1;
});
