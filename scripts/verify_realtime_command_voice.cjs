#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const project = path.resolve(__dirname, "..");
const artifacts = path.join(project, "artifacts");
const baseUrl = process.env.FABLE_URL || "http://127.0.0.1:8644";

async function main() {
  fs.mkdirSync(artifacts, { recursive: true });
  const config = await import(path.join(project, "server/aviator-session.mjs"));
  const session = config.aviatorSessionConfig();
  const health = await fetch(baseUrl + "/api/realtime/health").then(response => response.json());
  const secretProof = await fetch(baseUrl + "/api/realtime/client-secret", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(async response => ({ status: response.status, body: await response.json() }));

  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push("pageerror: " + error.message));
  page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.SIM && SIM.bootState().firstFrame, null, { timeout: 30000 });
  await page.evaluate(() => { boot.style.display = "none"; BOOT.active = false; S.paused = true; document.body.classList.remove("booting"); SIM.reset(); setAviatorRailExpanded(true); });

  const interaction = await page.evaluate(() => {
    const sent = [];
    AVIATOR.dc = { readyState: "open", send: value => sent.push(JSON.parse(value)) };
    handleAviatorEvent({ type: "conversation.item.added", item: { id: "pilot_audio_1", role: "user", content: [{ type: "input_audio", transcript: null }] } });
    handleAviatorEvent({ type: "response.done", response: { metadata: { purpose: "pilot_transcript", item_id: "pilot_audio_1" }, output: [{ content: [{ type: "output_text", text: "What are flaps?" }] }] } });
    handleAviatorEvent({ type: "response.output_audio_transcript.done", transcript: "Flaps increase lift and drag; use them for lower-speed takeoff and landing control." });
    const state = aviatorFlightState();
    SIM.showPhysicsCue();
    AVIATOR.status = "LIVE"; AVIATOR.micEnabled = true; AVIATOR.audible = true; updateAviatorUi();
    return {
      sent,
      conversation: SIM.aviatorConversation(),
      state,
      rail: { expanded: aviatorRail.getAttribute("aria-expanded"), status: aviatorRailStatus.textContent, physics: physicsCueEl.classList.contains("show"), physicsText: physicsCueText.textContent }
    };
  });
  await page.screenshot({ path: path.join(artifacts, "realtime-command-voice-desktop.png"), fullPage: false });
  await page.click("#aviatorRailToggle");
  const collapsed = await page.evaluate(() => ({ collapsed: aviatorRail.classList.contains("collapsed"), expanded: aviatorRail.getAttribute("aria-expanded"), toggleVisible: aviatorRailToggle.getBoundingClientRect().right <= innerWidth }));
  await page.click("#aviatorRailToggle");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(artifacts, "realtime-command-voice-mobile.png"), fullPage: false });
  const mobile = await page.evaluate(() => { const rect=aviatorRail.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,overflow:document.documentElement.scrollWidth-innerWidth,inside:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight}; });

  const oob = interaction.sent.find(event => event.type === "response.create" && event.response?.metadata?.purpose === "pilot_transcript");
  const checks = {
    configuredRealtime2: health.configured === true && health.model === "gpt-realtime-2" && session.model === "gpt-realtime-2",
    audibleSession: session.output_modalities?.join(",") === "audio" && session.audio?.output?.voice === "marin",
    secureEphemeralSession: secretProof.status === 200 && typeof secretProof.body.value === "string" && secretProof.body.value.length > 10,
    sternConciseContract: config.aviatorInstructions.includes("stern, decisive") && config.aviatorInstructions.includes("under 18 words") && config.aviatorInstructions.includes("at most two short sentences") && session.max_output_tokens <= 120,
    everyTurnGetsFreshState: config.aviatorInstructions.includes("Before every substantive pilot response, call get_flight_state"),
    exactCorrectionsPresent: Number.isFinite(interaction.state.guidance_targets.speed_target_knots) && Number.isFinite(interaction.state.guidance_targets.speed_delta_knots) && Number.isFinite(interaction.state.attitude.correction_to_level.pitch_degrees),
    screenAwareState: interaction.state.screen_context.camera === "CHASE" && interaction.state.screen_context.transcript_visible === true,
    realtimeOnlyPilotTranscript: oob?.response?.conversation === "none" && oob?.response?.output_modalities?.join(",") === "text" && oob?.response?.input?.[0]?.type === "item_reference" && !JSON.stringify(session).includes("transcribe"),
    twoSidedTranscript: interaction.conversation.turns.some(turn => turn.role === "pilot" && turn.text === "What are flaps?") && interaction.conversation.turns.some(turn => turn.role === "ai" && turn.text.startsWith("Flaps increase")),
    railIsAudibleAndHideable: interaction.rail.status === "MIC LIVE · AUDIBLE" && collapsed.collapsed && collapsed.expanded === "false" && collapsed.toggleVisible,
    sparsePhysicsCue: interaction.rail.physics && interaction.rail.physicsText.length > 24,
    mobileFit: mobile.inside && mobile.overflow <= 0,
    zeroConsoleErrors: errors.length === 0
  };
  const report = { ok: Object.values(checks).every(Boolean), checks, health, secretProof: { status: secretProof.status, hasValue: typeof secretProof.body.value === "string", expiresAt: secretProof.body.expires_at || null }, session: { model: session.model, voice: session.audio.output.voice, outputModalities: session.output_modalities, maxOutputTokens: session.max_output_tokens }, interaction, collapsed, mobile, errors };
  fs.writeFileSync(path.join(artifacts, "realtime-command-voice-verification.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: report.ok, checks, health, secretProof: report.secretProof, collapsed, mobile, errors }, null, 2));
  await browser.close();
  process.exitCode = report.ok ? 0 : 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
