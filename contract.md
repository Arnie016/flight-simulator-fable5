# Contract — Flight Sim v2 "Trainer"

**Negotiated:** 2026-07-05 (v1), extended 2026-07-06 (v2 goal: physics/graphics/cockpit/voice-instructor/mission).
**Graded:** 2026-07-06 — v1 regressions 22/24 re-verified on the new build; 21 new v2 assertions, 19 machine-verified, 2 manual. Method: deterministic `SIM.warp()` batteries, screenshots, canvas pixel checks.

## A. v1 regressions (all re-run on v2)

- [x] A01 zero console errors (accepted three.js deprecation warning only)
- [x] A02 single file + one pinned CDN dep
- [x] A03 spawns parked on threshold; settles on gear at 2.7° stance, phase `parked`
- [x] A04 takeoff — **behavior upgraded:** no longer self-rotates; wheelbarrows at near-zero gear load until pull. With rotation at 55 kt: airborne by z=193 (≈330 m of 1200 m used)
- [x] A05 climb after rotation (+87 m verified in scripted takeoff)
- [x] A06 hands-off 20 s: bank 0.2°, no tumble, no crash
- [x] A07 control signs: roll −33.2°, pitch +13.8°, yaw +19.1°
- [x] A08 stall + recovery (α 34° deep stall, nose drop, speed rebuild)
- [x] A09 drag decay at idle
- [x] A10 fuzz 30 s: zero non-finite states
- [x] A11–A16 instruments cross-checked (needle vs digital vs true state; AH pixel-verified in v1, layout unchanged)
- [x] A17 cameras — now 4 modes; chase + cockpit screenshot-verified
- [x] A18 mouse orbit/zoom — live free-camera input verified: canvas drag changed azimuth `0 → -1.05` and elevation `0.20 → 0.65`; wheel zoom changed distance `22.0 → 17.16`; mouseup cleared drag state.
- [x] A19 help panel — updated with F, T/G, X, C-or-V; content verified via `SIM.helpText()`
- [x] A20 landing: flaps-50 stabilized approach → 1.54 m/s touchdown, rollout, brakes to 0
- [x] A21 hard impact crashes — reason varies correctly with attitude ("hard impact" flat / "prop strike" nose-low, because the nose really does arrive first)
- [x] A22 hangar collision crash
- [x] A23 reset from all states
- [x] A24 60–86 FPS observed **with shadows enabled**; instancing kept

## B. v2 assertions

**Physics**
- [x] B01 stall onset α = 12.7° (buffet band 12–15° as designed)
- [x] B02 flaps reduce stall speed: 51.9 kt clean → 43.0 kt full flaps
- [x] B03 brakes: 30 m/s → stop in 138 m, on centerline
- [x] B04 gear compression bounded: 0.026 m on a normal landing (crash limit 0.34)
- [x] B05 no ground jitter: zero position drift over 5 s parked; zero after brake-stop
- [x] B06 thrust monotonic: 12.7 m/s @ 50% vs 24.0 m/s @ 100% after 6 s
- [x] B07 trim shifts hands-off pitch tendency: +5.3° → +13.5° drift with +0.15 trim
- [x] B08 crosswind: 23 m downwind drift over 15 s, wings-level (1.3°), controllable, no crash
- [x] B09 gear geometry: tricycle stance stable (mains behind CG — see log: the one real v2 bug)

**Graphics / state consistency**
- [x] B10 control surfaces deflect with correct signs: ailerons differential (−0.42/+0.42), elevator −, rudder +, flaps extend
- [x] B11 prop disc appears with throttle (idle false → full true)
- [x] B12 cockpit camera inside airframe: 1.08 m from center
- [x] B13 V key cycles 4 camera modes (dispatched real key events)
- [x] B14 shadows enabled + rendered at 60–86 FPS
- [x] B15 effects pooled (fixed 18-sprite pool, recycled — no unbounded allocation)

**Instructor / mission**
- [x] B16 phase machine: `parked → takeoff-roll → rotation → initial-climb → climb → stall → approach → flare → rollout` all observed
- [x] B17 says "Rotate at 55 knots" during roll at ≥52 kt; "Airspeed alive"; "Full throttle"
- [x] B18 stall warning + sink-rate warning + flare call + touchdown call all fire in their scenarios
- [x] B19 cooldown: 2–3 stall warnings per continuous 10 s stall, not spam
- [x] B20 mission gate 1 pass advances index + issues next-leg ("crosswind") instruction; text transcript works with or without speech (speech is render-side; physics never waits on it)
- [x] B21 full guided circuit end-to-end — deterministic integration exercised all six real gate transitions, then the real stopped-on-home-runway completion branch: `idx 0 → 6`, `1,740` gate XP, 99/A score, debrief, contract settlement, and career bank. The synthetic browser profile/progress record was removed after verification.

## C. v4 assertions (graded 2026-07-06)

**Terrain & world**
- [x] C01 heightfield alive after hash fix: 69/81 samples nonzero, hills to 96 m (was 9/81, max 14.8 — Math.imul repair, see log)
- [x] C02 airfield AND full traffic pattern provably flat (terrainH = 0 at field + all gate tracks)
- [x] C03 hill settle: aircraft parks on sloped terrain without crash, AGL 0
- [x] C04 lake exists in a carved basin (center 0 m, shore 42 m); ditching → crash "ditched in the lake"
- [x] C05 night mode: sky/fog/lighting switch, landing-light cone on runway, edge lights, panel tint — 61 FPS
- [x] C06 visibility setter scales fog (0.25–1)

**Engine & failures**
- [x] C07 RPM lags throttle (808 → 2685 over 3 s), reads 2700 at takeoff
- [x] C08 engine failure: windmilling RPM (~1100 at speed), zero thrust, instructor "Engine failure. Pitch for 70 knots…", cue "↓ engine out — 70 kt, pick a field"; recoverable (RPM 2696 after restore)
- [x] C09 vacuum failure: displayed attitude diverges from truth (5.2° vs 0.1° after 6 s), red VAC flag; truth unaffected
- [x] C10 turbulence: setter 0–2, calm = wings dead level, turbulent flight controllable, deterministic (simTime+position sines)
- [x] C11 thermals rise over high terrain by day only

**Training systems**
- [x] C12 circuit scoring: samples pattern altitude + final speed, touchdown sink + centerline, grade banner + voice + localStorage best; skipping the pattern correctly scores C, not A
- [x] C13 cue bar shows the exact key to press per situation, keycap lights when held (screenshot: "↓ rotate at 55 kt" during the roll at 46 kt)
- [x] C14 flight-path predictor line renders in guided flight, terrain-clamped
- [x] C15 settings panel (⚙): night, visibility, wind + strength, turbulence, engine/vacuum failures — all wired
- [x] C16 slip ball tracks sideslip; ASI arcs + 55 kt bug; RPM/trend/night/turb readouts
- [x] C17 fuzz with turbulence AND mid-fuzz engine failure: zero NaNs
- [x] C18 FPS 61–73 with terrain + shadows + night spotlight
- [x] C19 flap-asymmetry recovery: 50% command leaves right flap at 8%, adds +0.0547 rad/s roll-rate versus clean flight after 1 s, blocks preflight, drives alert/objective/cue/instructor feedback, clears after Shift+F retraction, and persists through replay
- [x] C20 gust feedback: deterministic Coastal Crosswind test at `t=0.75` reports `XWIND 8 G10`, raises a `SEA GUST` approach advisory, and schedules one rate-limited haptic pulse; scene mapping covers coast, alpine, storm, and frontier without affecting flight forces
- [x] C21 living airspace: the real distant `flyby` cue activates its matching jet silhouette; at mid-pass the silhouette moves through the camera frame while aircraft position and phase remain unchanged. Helicopter cues select the animated rotor silhouette.
- [x] C22 engine-out reroute: Frontier engine failure near the destination selects Frontier Field 09, replaces the normal route with an engine-out director target, updates objective/cue/alert to 70 kt plus glide margin, and leaves position/speed unchanged. Circuit mode selects Runway 36.
- [x] C23 dead-stick recovery drill: an airborne engine failure locks its selected runway. A centered target-runway touchdown at or below 3.2 m/s sink and 38 m/s ground speed earns mission XP plus a `DEAD-STICK LANDING` skill event; a wrong, hard, or fast runway touchdown records a missed diversion. Normal circuit completion is unchanged.
- [x] C24 departure discipline: in guided mode, entering the takeoff roll without a valid parked `E` departure check activates a training hold. The aircraft remains controllable, but gates, delivery progress, and mission XP are locked until restart; free flight and aircraft forces are unchanged.
- [x] C25 scene airspace: each selected level uses a distinct distant-traffic playlist. Switching levels stops the previous pass, stages only the new scene's clips, and continues to drive the existing matching traffic silhouette without changing collision, mission, or flight-force state.
- [x] C26 objective telemetry: guided mission HUD includes the live director target, horizontal range, speed-derived ETA, and compact scene/surface condition. Training holds and other director-free states show `ROUTE PAUSED` rather than an invented target.
- [x] C27 go-around recovery: a clearly unsafe low final triggers an instructor recovery call. The route redirects to a 120 m climb-out, and only full power, positive climb, 55 kt, and 120 m AGL log the recovery XP/skill event; flight forces and normal landing flow are unchanged.
- [x] C28 Realtime bridge readiness: `GET /api/realtime/health` reveals only bridge/model/configuration truth. The client checks it before microphone permission or client-secret creation, and the aviator's read-only state includes objective telemetry plus go-around status.
- [x] C29 recovery career record: mission recovery counts increment only for completed go-arounds and controlled dead-stick landings, persist per scene and pilot profile with legacy-profile defaults, and render in the Flight Board and debrief without adding risky contract goals.
- [x] C30 haptic calibration: settings expose the selected haptic route and send a forced calibration pulse only on explicit test; ordinary alerts retain the existing feedback enablement, strength scaling, and rate limit.
- [x] C31 mission cargo signatures: every relay plan maps to a distinct lightweight 3D rescue, shelter, medical, or dispatch signature. The same style follows pickup, carried, drop-zone, and released package state without changing delivery checks or drop physics.
- [x] C32 cargo render lifecycle: replacing a relay signature removes and disposes only its owned geometry/materials before attaching the new scene style, preventing accumulated WebGL cargo resources across repeated scene changes.
- [x] C33 localizer coaching: a materially off-center final produces a directional localizer cue, corrective objective, and caution alert while preserving the existing PAPI/glideslope guidance. A 45 m right-of-center final verified `LOCALIZER RIGHT`, a gentle-left cue, and the matching landing objective.
- [x] C34 media scheduler safety: external traffic and thunder schedules substitute finite fallback durations when browser media metadata is not finite, preventing invalid Web Audio times. A Storm launch ran through the traffic scheduling window with zero console errors and a running scene audio mix.
- [x] C35 scene-aware checks: parked departure checks include non-blocking selected-scene wind, visibility/operating condition, and runway surface. Storm verified `VIS 52% · RAIN` plus wet asphalt; Alpine verified `VIS 72% · FLURRIES` plus packed snow.
- [x] C36 scene integration smoke: all five selectable flights activate their expected wind/night/weather/surface/audio/cargo profile and show only the relevant Blender landmark set. The live browser pass completed with zero console errors.
- [x] C37 graphics quality: persisted High, Balanced, and Performance modes switch renderer pixel ratio and shadow policy without touching flight state. Browser verification moved High `2x` soft shadows → Performance `1x` shadows off → High restored.
- [x] C38 focus safety: a document visibility transition during an active flight pauses physics and shows `PAUSED — tab hidden — press P to resume`; pressing P restores the parked/live state.
- [x] C39 Desert Run: the selectable desert lesson activates a distinct sand surface, thermal/dust operating readout, water-pod relay, dune/rock field, and dust particles without altering terrain collision or requiring a remote skybox asset. An empty local manifest preserves the procedural sky; a declared panorama is loaded only for its matching scene.
- [x] C40 mobile mission density: at a 390x844 viewport, the parked mission card keeps the objective, telemetry, and `E CHECK` in a 182 px closed state. Its controlled departure-check tray expands on demand and remains stable while the live HUD redraws.
- [x] C41 Desert outpost: the water-pod delivery coordinate includes a scene-only solar canopy, shelter, water tank, marked pad, and pulsing beacon. The group and its light activate only in Desert Run and do not add a collision proxy to the relay zone.
- [x] C42 scene feedback identity: cargo pickup and delivery use distinct rate-limited haptic/audio signatures; Desert Run adds a unique launch cue and sand-brake dust plume while retaining the existing low-grip brake feedback policy. The feedback diagnostic exposes the last requested kind and haptic route.
- [x] C43 Desert airspace: Desert Run uses a dedicated distant-aircraft profile (1,220 m forward, 265 m high, 1,710 m traverse) rather than the generic circuit path, and thermal gust feedback adds a bounded scene-specific haptic boost.
- [x] C44 relay teaching telemetry: pickup objectives show live three-dimensional range; delivery objectives show live distance, AGL, and knots, then state the specific correction or a green `Q` release window. This reads only mission state and does not alter release gating.
- [x] C45 condition consistency: the active scene's live telemetry and Flight Board use the same rain, flurries, or Dust Haze condition naming as boot and departure checks; Desert Run no longer falls back to a generic wind label in those surfaces.
- [x] C46 Desert delivery acknowledgement: the real outpost derives its beacon color/intensity, pad color, and tank emissive state from `DELIVERY.dropAwarded`; reset or scene change clears the response through the existing delivery lifecycle, without adding a separate completion flag.
- [x] C47 Realtime relay telemetry: the existing GPT Realtime `get_flight_state` tool exposes a structured relay payload with objective, pickup range, drop distance/AGL/knots, configured release window, and readiness. Server instructions require a concise single corrective action; no local voice path is added.
- [x] C48 low-grip departure teaching: surfaces below 0.8 grip add a non-blocking departure brief; an armed takeoff roll reports `LOW GRIP`, a small-rudder/centerline cue, and a matching GPT Realtime instructor event. The existing per-wheel surface forces remain unchanged.
- [x] C49 scene solar profiles: each selectable scene supplies a distinct render-only sun vector that drives the moving shadow light and glare sprite direction. Browser diagnostics verify all six vectors; no flight-force calculation reads this profile.
- [x] C50 launch carousel: the boot screen's arrow controls and Left/Right keys cycle the same persisted `LEVELS` selection as its dropdown, update title/brief/conditions/accent plus `SCENE n / 6 · XP`, and launch the actual selected flight rather than a preview-only state. Boot-only key handling leaves in-flight arrows untouched.
- [x] C51 boot scene transition: a reduced-motion-aware 320 ms selector transition runs only after the boot surface is ready and a real level selection changes. It is removed on animation end and cannot run after launch.
- [x] C52 camera sensitivity: settings persist a bounded 0.5–1.8 multiplier which scales canvas orbit and wheel zoom only. Browser verification compares low and high sensitivity drag/zoom responses while aircraft state remains unchanged.
- [x] C53 clickable departure check: the parked mission HUD exposes a Confirm Check button which invokes the existing `acknowledgeDeparture()` path. Browser verification arms the check, awards the same 50 XP, removes the button after the live HUD refresh, and hides all check controls once airborne.
- [x] C54 guarded cargo release: a Release Pod command renders only while the real `deliveryDropReadiness()` window is ready. Browser verification confirms it is absent out of zone, present at 0 m / 100 m AGL / 64 kt, invokes the existing delivery and outpost acknowledgement, then removes itself.
- [x] C55 guarded go-around decision: an eligible approach exposes a Go Around command that calls the same recovery initializer as the automatic unsafe-final trigger. It stays absent while parked, outside the final envelope, during recovery, and after an awarded recovery.
- [x] C56 scene gust feedback: a gust onset invokes a rate-limited scene-tuned haptic/audio feedback profile for coast, alpine, storm, desert, and frontier. It resets on scene selection, never alters flight forces, and reports its state through `SIM.feedbackState()`.
- [x] C57 scene launch motifs: all six level selections have distinct procedural launch-cue note profiles. The selected cue is exposed through the render-side audio state, follows the existing user-gesture-safe audio path, and does not synthesize voice.
- [x] C58 optional Skybox integration: manifest-declared local panoramas replace the procedural dome at neutral tint, while missing, invalid, or failed assets retain the local fallback. `SIM.skybox()` exposes manifest, configured, load, and active-use state without client credentials.
- [x] C59 cinematic HUD preference: the U-key/button overlay toggle leaves simulation state untouched, persists the hidden preference, and maintains accurate accessible button state while leaving its show control available.
- [x] C60 scene-aware Realtime telemetry: the Aviator flight-state tool now includes structured active-scene visibility, weather, gust, runway surface, grip/brake, and ambience data in addition to the title. The server instruction requires scene-specific coaching from this state.
- [x] C61 precision-release input parity: the Q key and guarded Release Pod command invoke `releaseDelivery()` only after launch. Browser verification confirms safe Q delivery and unsafe Q rejection with the same retained-cargo state; the HUD control advertises Q through `aria-keyshortcuts`.
- [x] C62 Realtime-only instructor boundary: the browser has no speech-synthesis or prerecorded-instructor route, and the unused Deepgram voice-generation script has been removed. Spoken coaching is available only through the live GPT Realtime Aviator connection.
- [x] C63 live scene strip: mission telemetry combines the selected level's visibility percentage, weather, and active runway surface in its compact HUD scene line, including route-paused states.
- [x] C64 desert terrain separation: global decorative green ground patches hide only for Desert Run while dunes, dust, outpost, and sand-surface physics remain active. Environment diagnostics expose the patch visibility.
- [x] C65 alpine terrain separation: the same global green patch layer hides for Alpine Rescue while snow fields and flurries remain active; green scenes restore the layer.
- [x] C66 Flight Board surface conditions: every scene card exposes the same `LEVELS` surface short label used by physics and landing instruction, beside visibility, wind, and XP before launch.
- [x] C67 rollout stopping reference: current rollout cues pair remaining runway with a read-only estimate derived from actual ground speed and selected surface braking. A late unbraked rollout raises `BRAKE POINT`; the estimate is exposed through `SIM.arrival()` and cannot affect forces.
- [x] C68 brake-point feedback: the first `BRAKE POINT` alert transition invokes a dedicated haptic/procedural-audio profile through the existing feedback path; stable alert frames do not replay it and no flight force changes.
- [x] C69 route guidance: a persisted Route guidance setting drives one sparse centerline of moving 3D chevrons, open corridor brackets, a compact track-up topographic map, and the bearing director from the same active guide target. It supports gate/relay/go-around/arrival targets, preserves target brackets when disabled, reports through `SIM.routeGuidance()`, and fits without mobile HUD overlap.
- [x] C70 weather and crash presentation: Storm Return renders 176 camera-relative, wind-sheared rain streaks without changing weather forces. A non-water crash starts render-only persistent fire and dark-smoke effects; a water ditching starts vapor/smoke without fire. Reset clears all crash effects and neither path changes physics or the GPT Realtime-only speech boundary.
- [x] C71 Island Atlas fast travel: the Flight Board exposes ten named regions through a clickable canvas map and one selected-destination card with an explicit Fast Travel command. Each destination selects its assigned weather profile, enters free flight at a deterministic runway or safe airborne start, survives an initial simulation step, preserves career XP, and returns to the same destination on reset. A scored lesson launch clears travel state and restores Guided mode.
- [x] C72 lazy physical island pack: Academy startup requests no island pack. Entering any enriched destination loads one 218,510-byte loader-free CC0 Kenney bake with 21 assets and 48 materials, reuses cached geometry/materials through instanced scenery, applies simple collision proxies, and exposes near/far/dormant culling through `SIM.islandAssets()`.
- [x] C73 topographic navigation language: the Flight Board derives a shaded/contoured island raster from world coordinates, uses distinct landmark symbols and leader lines instead of numbered dots, and keeps all ten map-selectable destinations usable without horizontal overflow at 390 px. The same raster drives a circular track-up minimap; objective guidance uses open corridor brackets and one restrained centerline of moving chevrons rather than collectible rings or dashed rails.
- [x] C74 second physical island slice: Breakwater Bay provides a dock, coast station, three moored canoes, moving watercraft, and 18 birds; Silver Lake provides lilies, survey infrastructure, cave/bridge shoreline dressing, moving watercraft, and 14 birds; Ember Ruins provides an obelisk/column field, cave approaches, campfire dressing, and 72 localized embers. All activity is culled and render-only. Browser travel to all three is safe at 112–120 FPS with one runtime-pack request.
- [x] C75 live bird's-eye atlas: the Flight Board renders the shared Three.js island through a north-up aerial camera with scene fog suppressed only for that pass. Projected destination, player, parked-aircraft, jet, and helicopter markers stay aligned with the real terrain while live flight continues; map terrain is GPU-capped separately from the faster marker overlay. Desktop airborne proof moved both player and jet, and 390x844 proof fit without horizontal overflow or console errors.
- [x] C76 destination-first progression UI: the live island map is the level selector. Six numbered authored regions expose only their two local lessons and Start Level; four additional landmarks expose explicit free flight and Fast Travel without inventing scored routes. The prior six-card lesson wall is removed. Rank, leaderboard, tabbed settings, and map click behavior remain intact at desktop and 390x844.
- [x] C77 Alpine 2 km range: repeated primary-summit samples return 1,950.81 m, four shoulder samples return 1,584.2/1,624.6/1,379.5/1,185.1 m, and the carved glacial-valley midpoint returns 113.5 m from the shared deterministic `terrainH`. A 220x190 dedicated tile renders 42,211 vertices with a dithered ~1,100 m snowline; cap cloud, valley fog, ridge plume, and denser local flurries are render-only, generic-cloud intrusion reports zero, the rescue landmark remains 0.02 m above sampled ground, and safe summit/fast-travel AGL probes do not crash. Balanced 1440x900 measured 103 FPS, 390x844 measured 120 FPS with zero horizontal overflow, and browser proof reported zero console errors.
- [x] C78 local Black Box and opt-in microphone: a rolling versioned local store records run, scene, mission-leg, stabilized-final, warning, crash, landing, privacy, and GPT Realtime transcript facts without audio payloads. The real debrief renders measured recent facts and transcript counts. GPT Realtime connects receive-only and exposes a separate microphone command; a mocked session attempt made zero `getUserMedia` calls, storage survived reload, desktop/mobile debriefs had zero overflow, and the browser reported zero console errors.
- [x] C79 twelve story missions: six flight scenes each expose two selectable missions spanning training, rescue, delivery, survey, emergency, and transport. Every mission has a briefing, exactly three objectives backed by live check, route, relay, stable-final, recovery, or score state, objective XP, and a first-completion bonus. Selection and completion survive reload; the HUD shows live objective progress and the debrief states complete or partial outcome. `artifacts/story-missions-verification.json` passes all 14 catalog, interaction, persistence, outcome, XP, desktop/mobile fit, and console checks.
- [x] C80 deterministic weather regimes: clear, crosswind, low-density, heavy-rain, and desert-thermal profiles expose distinct visibility, gust, density, vertical-air, sound, HUD, and GPT Realtime state. Fixed-coordinate samples repeat exactly and `artifacts/weather-energy-verification.json` passes the regime, guidance, audio, and console checks.
- [x] C81 layered heavy rain: Storm Return renders separate 128-segment near and 224-segment far rain fields, wet-runway puddles, rolling/braking spray, 52% visibility, and reduced grip/braking without coupling particles to flight forces. Desktop and 390x844 browser captures fit without overflow.
- [x] C82 density and energy training: density now scales indicated airspeed, available thrust, takeoff performance, and climb. Clear/Alpine/Desert measured 244.9/280.5/298.5 m takeoff rolls and 15.46/13.10/12.03 m/s maximum climb; low-energy recovery guidance and a six-second 75-90 kt objective are exposed to the HUD and GPT Realtime state. Balanced render capacity clears 45 FPS and the story plus Black Box regression suites remain green.
- [x] C83 distinct crash signatures: terrain impact renders persistent flame and dark smoke; gear collapse renders a lowered fuselage, canted gear, scrape glow, sparks, and low smoke without fire; water ditching renders vapor without fire or sparks. `SIM.crashEffects()` exposes each render-only signature, reset restores the gear and clears every pooled effect, and Black Box records factual crash causes.
- [x] C84 complete read-only Realtime state: the single `get_flight_state` tool returns mission, navigation, scene/weather, energy, checklist, warning, safe-landing, Black Box, and civilian-scope state. Browser verification invoked the real tool handler and proved aircraft and control state were byte-identical before and after the call.
- [x] C85 fixed supportive Aviator: the bridge uses only `gpt-realtime-2` with the fixed `marin` voice, concise calm coaching, optional dry humor outside emergencies, and an explicit no-mock emergency rule. Browser code contains no local TTS or session voice mutation, and the tool remains read-only so the pilot retains control.
- [x] C86 civilian Island Alpha boundary: browser and Realtime state identify civilian flight training while multiplayer, dogfights, and fictional combat radio remain parked. Server instructions reject combat or multiplayer roleplay until authoritative networking exists.
- [x] C87 Control Lab yoke lesson: the 2,727,172-byte textured GLB is used in the cockpit and a full-screen engineering view with five hover-isolated parts. Real pointer input crosses the measured 45-degree boundary, returns inside 5 degrees, logs Black Box facts, and produces a telemetry-backed debrief. The existing `gpt-realtime-2` bridge receives the same state for spoken coaching while microphone input remains separately opt-in.
- [x] C88 integrated cockpit and Realtime debrief: cockpit mode hides the duplicate bottom gauges, speed block, map, rank, and instructor overlays while mapping the live instrument canvas onto a 3D panel. The yoke and 3,023,812-byte compass GLBs load independently; two gloved hands and deterministic turbulence animate in cockpit space, the compass follows heading, and Record/Share remains on the right rail. Hear Aviator sends measured score, touchdown, systems, objective, and Black Box facts to `gpt-realtime-2`, stores the returned transcript, and retains an honest offline fallback with microphone input disabled.
- [x] C89 visual flight report and map-first progression: completion captures the rendered touchdown frame, awards score-derived stars, limits the open report to three measured highlights, and plots the recorded replay lateral path against the runway centerline. Objectives and Black Box facts remain available in a collapsed Flight Log. GPT Realtime returns one parsed strength, correction, and next drill with receive-only and microphone state explained in-place; offline mode remains text-only. `artifacts/debrief-training-map-verification.json` passes all 10 visual, telemetry, conversation, map, persistence, responsive, and console checks.

## Determinism guarantee (unchanged)
Everything inside `step()` — physics, wind gusts, phase detection, mission gates, instruction *emission* — depends only on state + `S.simTime`. Speech synthesis, effects, camera shake, and UI run render-side and never touch physics.

## Non-goals
Certified-accurate aerodynamics; licensed soundtrack/music curation; envelope protection (zoom climbs are permitted energy-consistent aerobatics).

## Amendment rule
Changes only by renegotiation, recorded in [log.md](log.md).
