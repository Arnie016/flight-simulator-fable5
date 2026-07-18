# Goal

Objective: Ship **Fable Flight: Island Alpha** with ten fast-travel locations, twelve story missions, five weather regimes, a populated island, and GPT Realtime coaching for navigation, weather, energy, checklists, and emergencies.

Why now: Six lessons, deterministic physics, route guidance, missions, weather, Realtime voice, licensed audio, and 409 staged CC0 GLBs work. The next gain is one memorable world.

Evidence:

- `index.html`: Three.js simulator and `SIM` diagnostics.
- `contract.md`: 126 verified assertion rows.
- `assets/source-packs/kenney`: 409 CC0 GLBs.
- `assets/audio/library/manifest.json`: audio licenses.

Constraints:

- Desktop browser only; no Pixel Streaming or certified instruction.
- GPT Realtime is the only spoken instructor; no local TTS or prerecorded coaching.
- Record asset sources/licenses; optimize and lazy-load selections; never ship source archives.
- Flight forces remain deterministic and independent from voice, UI, audio, and particles.
- Balanced target: at least 45 FPS at 1440x900, zero console errors, no blank WebGL frame.
- Critical load at most 35 MB; optimized runtime island GLBs at most 25 MB. Scene assets/audio load on demand.

Next actions:

1. Build island registry, map, safe fast travel, and culling diagnostics.
2. Ship Alpine Rescue Ridge, Kauri Township, and Shepherd Highlands as the first world slice.
3. Add layered weather, density-altitude teaching, and Realtime coaching.
4. Add twelve missions, persistent consequences, and Black Box debriefs.
5. Complete locations, audio, optimization, and browser proof.

Acceptance contract:

- [x] W01 Ten locations exist: Academy Airfield, Breakwater Bay, Alpine Rescue Ridge, Stormhaven, Red Mesa Outpost, Frontier Field, Silver Lake, Kauri Township, Shepherd Highlands, and Ember Ruins.
- [x] W02 Map/Flight Board reach each location in two actions, spawn safely, and preserve progress.
- [x] W03 Each location has a distinct silhouette, landmark, sound, and activity.
- [x] W04 Towns use instanced buildings/roads/lights; highlands use instanced sheep; ordinary birds are render-only.
- [x] W05 Scenery uses culling, instancing, simple collision proxies, and lazy loading within asset budgets.
- [x] W06 Clear, crosswind, low-density, heavy-rain, and desert-thermal regimes affect visibility, handling, sound, and guidance deterministically.
- [x] W07 Heavy rain adds near/far streaks, spray, low visibility, wet braking, and coherent UI.
- [x] W08 Hot/high and alpine lessons demonstrate longer takeoff, reduced climb, kinetic-energy management, and recovery.
- [x] W09 Terrain impact, gear collapse, and water ditching have distinct render-only effects and clean reset behavior.
- [x] W10 Twelve missions cover six archetypes; each has a briefing, three stateful objectives, visible outcome, XP, and debrief.
- [x] W11 Realtime receives mission, route, weather, energy, checklist, warning, and safe-landing state through read-only tools.
- [x] W12 Aviator is calm, concise, lightly sarcastic outside emergencies, supportive, and never changes voice profile or controls.
- [x] W13 Black Box stores local event telemetry and Realtime transcripts for a factual debrief; microphone audio is off by default.
- [x] W14 Fictional combat radio remains separate and parked with multiplayer until authoritative networking exists.

Verification:

- Keep 126 assertion rows green; automate W01-W14.
- Syntax, JSON, diff, Realtime health, zero browser errors, 1440x900 and 390x844 HUD fit all pass.
- Playwright proves ten destinations, five weather modes, mission archetypes, crash/reset, performance, and Realtime telemetry.
- Proof captures map, three locations, heavy weather, crash/reset, debrief, and Realtime state.

Stop condition: Stop only when W01-W14 are browser-observable, licensed, within performance/payload limits, and verified without regressing the existing 126 assertion rows. Dogfights and multiplayer remain outside Island Alpha unless this contract is amended.
