#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8643";

async function main() {
  fs.mkdirSync(artifacts, { recursive:true });
  const browser = await chromium.launch({ headless:false, args:["--disable-frame-rate-limit", "--disable-gpu-vsync"] });
  const page = await browser.newPage({ viewport:{ width:1440, height:900 } }), errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto(baseUrl, { waitUntil:"domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().ready, null, { timeout:30000 });
  await page.getByRole("button", { name:"BEGIN FLIGHT" }).click();
  await page.evaluate(() => applyGraphicsQuality("balanced", false));
  await page.waitForTimeout(4000);
  const measurement = await page.evaluate(async () => {
    const intervals = [];
    await new Promise(resolve => {
      let previous = performance.now();
      const tick = now => {
        intervals.push(now - previous); previous = now;
        if (intervals.length >= 240) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const fps = intervals.slice(20).map(ms => 1000 / ms).sort((a, b) => a - b);
    const gl = renderer.getContext(), debug = gl.getExtension("WEBGL_debug_renderer_info"), width = 64, height = 64;
    const pixels = new Uint8Array(width * height * 4), x = Math.max(0, Math.floor((gl.drawingBufferWidth - width) / 2)), y = Math.max(0, Math.floor((gl.drawingBufferHeight - height) / 2));
    renderer.render(scene, camera); gl.finish(); gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonBlack = 0, min = 255, max = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      if (luminance > 4) nonBlack++; min = Math.min(min, luminance); max = Math.max(max, luminance);
    }
    return {
      median:+fps[Math.floor(fps.length / 2)].toFixed(1),
      p10:+fps[Math.floor(fps.length * .1)].toFixed(1),
      mean:+(fps.reduce((sum, value) => sum + value, 0) / fps.length).toFixed(1),
      sim:SIM.snap().fps,
      renderer:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      drawCalls:renderer.info.render.calls,
      triangles:renderer.info.render.triangles,
      centerPixels:{ nonBlack, total:width * height, luminanceRange:+(max - min).toFixed(1) },
      graphics:SIM.graphicsState()
    };
  });
  await page.screenshot({ path:path.join(artifacts, "mac-balanced-performance.png") });
  const checks = {
    metalRenderer:/Apple|Metal/.test(measurement.renderer),
    balancedMode:measurement.graphics.quality === "balanced",
    medianAtLeast45:measurement.median >= 45,
    p10AtLeast45:measurement.p10 >= 45,
    nonBlankFrame:measurement.centerPixels.nonBlack >= measurement.centerPixels.total * .9 && measurement.centerPixels.luminanceRange >= 8,
    zeroConsoleErrors:errors.length === 0
  };
  const report = { ok:Object.values(checks).every(Boolean), checks, measurement, errors };
  fs.writeFileSync(path.join(artifacts, "mac-balanced-performance.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
