# Fable Flight — browser flight trainer

A desktop-browser flight trainer for mission-based flight learning with measurable outcomes, voice coaching, and systems-first training workflows.

## 1) Human-first summary for judges

| What judges care about | Where this project delivers |
|---|---|
| Is it real and complete? | Full playable loop from briefing → flying → scoring → debrief → downloadable/shareable clips |
| Is the experience understandable? | Guided missions, visible instructions, progressive checklist, and explicit controls |
| Does it solve a real problem? | Reduces setup cost for flight basics and systems coaching with a hands-on simulator environment |
| Can judges reproduce it? | Public run links plus local run instructions are included |

## 2) Build Week scoring matrix (explicit mapping)

| Criterion | Evidence |
|---|---|
| Technological Implementation | Deterministic simulation state, measured telemetry, event-driven Black Box facts, and `gpt-realtime-2.1` tool-connected coaching with same-origin bridge |
| Design | Full user flow with training missions, map/flight-state clarity, controller support, emergency drills, and replay/debrief |
| Potential Impact | A reusable teaching model for flight training, simulation coaching, and instructional systems with constrained, low-cost delivery |
| Quality of Idea | Integrates AI coaching into a complex simulator loop (control + environment + measurable outcomes), not a superficial proof of concept |

## 3) Built with Codex + GPT-5.6

### How it was made
- Built in iterative Codex sessions using a strict: **specify → implement → validate → repair** loop.
- High-impact work was encoded in contract/assertion and verification artifacts to support reproducibility.
- GPT-5.6 was used for the in-product instructor/review coaching path and for explanation layers used in the final submission deck.

### Time allocation (post-2026-07-13 focus)
- 2026-07-18 17:35–19:05: core Build Week feature work and stabilization in one continuous stretch.
- 2026-07-22: final docs/packaging and judge-readiness cleanup.
- For full exact trace: `git log --since='2026-07-13'`.

## 4) Run and test (what judges should do first)

| Path | Command / action | Result |
|---|---|---|
| Vercel judge/public demo | Open [https://flight-sim-sandy.vercel.app](https://flight-sim-sandy.vercel.app) | Public playable build |
| GitHub Pages fallback | Open [https://arnie016.github.io/flight-simulator-fable5/](https://arnie016.github.io/flight-simulator-fable5/) | Public fallback mirror |
| Local static launch | Open `index.html` | Immediate single-file run |
| Local Realtime coach | Run `cd /Users/arnav/Desktop/flight-sim && OPENAI_API_KEY="YOUR_KEY_HERE" node server/fable-flight-server.mjs` | Starts same-origin bridge for voice coaching |

Then open `http://127.0.0.1:8643`, click **BEGIN FLIGHT**, and allow microphone permission for voice mode.

## 5) Future work (beyond submission) for next judging cycle

- Mobile offline scoring snapshots and classroom mode.
- Multi-user instructor and class analytics layers.
- Mission bank expansion with adaptive difficulty.
- Exportable debrief reports for coaching review.

## Appendix A — Implementation and technical notes (for AI/technical review)


## How to fly
Choose the training flight on the opening screen before pressing **BEGIN FLIGHT**. That selection applies its actual terrain/weather, runway surface, mission objectives, traffic, cargo, lighting, sound, and haptic profile, and is restored on the next reload. On the local bridge, the same gesture starts **GPT Realtime Aviator** and requests browser microphone permission; the compact **MIC LIVE** control pauses or resumes pilot input without disconnecting event coaching. There is no local or prerecorded instructor-voice fallback. Then press **E** to clear the scene-aware departure check, hold **W** for full throttle → pull **↓** at 55 kt → follow the text guidance, sparse route chevrons, and open corridor brackets → stabilize final at ~65 kt with flaps **F** → flare below 10 m → brake with **Space**. Use **Shift+F** to retract flaps one notch. Each scene ends with a visual flight report: a captured touchdown frame, one-to-three stars, three landing highlights, and an actual replay-derived centerline trace. Full objectives and Black Box facts remain in the collapsed Flight Log.

**Black Box:** local versioned telemetry records high-signal run, route, warning, crash, landing, privacy, and GPT Realtime transcript facts for the measured debrief. It stores no microphone audio. The first real flight-entry gesture starts Realtime and asks the browser for microphone permission. Denial leaves receive-only coaching live; **MIC LIVE** pauses by removing the sender track while the Realtime session and event coaching remain connected.

**Academy shelf:** the Flight Board opens with an image-led lesson rail. Basic, Intermediate, Advanced, and Pro each contain three one-click authored lessons; a launch carries its mission, location, weather, and GPT Realtime context directly into cockpit view. Free Roam remains a separate unscored launch and suppresses lesson objectives until Guided mode resumes.

**World clock:** every scene moves continuously through day, sunset, and night on a ten-minute training-day cycle while retaining its authored weather, visibility, surface grip, and turbulence. Directional light, sky and fog tint, exposure, runway lighting, windsock lighting, landing light, and cockpit cabin light respond to the same clock. Settings and `N` can still pin noon or night for practice.

**Control Lab lesson:** choose **YOKE LAB** to leave the flight view for the separate textured engineering bench. Hover a named subassembly to isolate it, start **Primary Control Limits**, drag the pivot past the measured 45-degree boundary, then recover inside 5 degrees. The Black Box records the inspected part, first limit crossing, maximum deflection, and neutral-recovery time. Text guidance always works; a connected GPT Realtime Aviator adds spoken coaching from the same telemetry. Asset provenance is recorded in [assets/cockpit/ASSET_MANIFEST.md](assets/cockpit/ASSET_MANIFEST.md).

Cockpit view now surrounds the pilot eye point with a textured floor and sidewalls, window glazing, roof liner, rear bulkhead, windshield frame, forward cowl, upholstery, and night-aware cabin lighting instead of presenting the panel as a freestanding object.

**3D cockpit systems:** cockpit camera mode removes the duplicated bottom instrument canvas, large speed block, circular route map, rank strip, instructor card, and external fuselage shell. A single continuous dark-metal dashboard now frames the physical gauge pack, centered yoke and animated hands, inset systems/engine consoles, flight-control pedestal, compass, and live BUS/ENG/PITOT/CHECK lamps while preserving the forward windshield as the dominant view. A Blender-authored GLB replaces the flat panel with five physical airspeed, attitude, altitude, vertical-speed, and heading instruments. Six named pivots move from the same deterministic telemetry used by flight physics; hovering or tapping a gauge lifts its assembly forward and shows its measured value, normal range, and modeled failure boundary, with identical state available to GPT Realtime. The strip scales to keep all gauges visible on narrow screens and restores the live canvas only if its GLB fails. The textured yoke and compass GLBs load independently; the compass needle tracks live heading, two gloved hands follow the yoke, and deterministic gust/turbulence motion affects the hands and cockpit camera. A second Blender-authored GLB mounts a physical black throttle and red mixture quadrant in the cockpit. Both named lever pivots follow live engine state, lift on hover, accept direct mouse or touch drags, synchronize the dock, and expose the same best-power/cutoff/restart boundaries to Black Box and GPT Realtime. A third Blender-authored console balances the opposite lower panel with a draggable five-position magneto key plus direct BAT, ALT, and PITOT rockers. A fourth physical pedestal adds direct 0/50/FULL flaps, continuous -25% to +25% elevator trim, and a momentary wheel-brake paddle. Its visible pivots and pilot hands follow the authoritative controls; surface effectiveness, actual flap travel, ranges, failures, and every direct action enter Black Box and GPT Realtime. These physical controls share the dock's authoritative starter interlocks, electrical drain, bus-loss, sensed-airspeed icing, flap, trim, and braking consequences. All mounts remain reachable on mobile; the HTML dock remains the load and keyboard fallback. Once all six cockpit assets are ready, that fallback defaults to a 560x31 **SYSTEMS READY** strip for bus voltage, RPM, IAS, and flight-plan stage so the physical controls remain primary. One click opens the full Engine, Flight, and Electrical/Gear control panel; asset-load failure keeps that panel open automatically. A cleared departure changes the compact presentation to **FLIGHT STATUS**, while reset and new lessons return to physical-first readiness. The exact presentation state enters read-only GPT Realtime telemetry. Pointer or keyboard focus highlights one control and drives a compact instrument strip with its measured value, modeled effect, and normal/caution/limit boundary; the identical focused state enters read-only GPT Realtime telemetry. Its BUS, ENGINE, PITOT, and CHECK lamps are driven by the same measured state, including low-voltage, stopped-engine, unpowered-heat, and uncleared-preflight boundaries. BAT OFF removes bus power and aircraft lights while the magneto-driven engine continues; ALT OFF leaves the modeled battery carrying the bus. Both configurations block the departure check, create measured Black Box facts, and enter the GPT Realtime cockpit state without conflating a pilot switch with the separate alternator-failure setting. Launching an authored lesson from any camera enters cockpit mode, carries its mission, weather, runway, and phase into Realtime state, and exposes the real departure check through both the physical cockpit and accessible panel. Record/Share moves to the right tool rail. Chase, free, and tower cameras retain the external instrument panel. Fuel is currently an explicitly labelled estimate and does not change flight physics; this trainer has no waste system.

**Spatial cockpit guide:** choose the `?` control in the physical-first strip, or ask a connected Aviator to explain the cockpit. The overview projects ordered, non-overlapping live labels onto eleven real GLB controls and preserves a locally persisted **reviewed, not mastered** familiarization record. Reviewed controls turn green; the next recommended control stays cyan; saying **next** lets GPT Realtime open that recommendation directly. Selecting airspeed, attitude, altitude, vertical speed, heading, throttle, mixture, battery, alternator, ignition, or pitot heat recesses unrelated HUD and scene color, leaves the chosen assembly colored and lifted, and opens a skippable two-or-three-step lesson with the current value, normal band, and modeled failure boundary. **BACK**, **NEXT**, **SKIP**, background return, and the final **PRACTICE** handoff work without audio; Realtime voice uses the `present_control_lesson` tool to drive the same state and receives the same telemetry, while the aircraft remains under pilot control. Reopening the guide restores the physical-first cockpit composition when every GLB is ready, and mobile moves the concise lesson above the panel so the focused gauge remains visible.

**Voice-driven cold start:** while parked with a stopped, serviceable engine, Aviator can open an adaptive BAT, mixture, throttle, and START lesson. It skips controls already configured, requires the learner to operate each physical GLB control, respects real starter blockers, verifies the spring return to BOTH plus stable idle RPM, rejects an already-running engine, depleted battery, or hardware fault, and records every measured transition for the debrief.

**Camera rail:** click the visible camera control, press **C/V**, or use gamepad **Y** to cycle the four useful player views: **CHASE → COCKPIT → NOSE → FREE**. Cockpit mode exposes the integrated GLB dashboard and removes the duplicated external gauges; nose view hides the airframe for an unobstructed forward sightline. Tail and tower transforms remain available to authored replays and test tooling without cluttering the player cycle.

**Voice-driven pitot recovery:** in visible moisture or a measured pitot-ice condition, GPT Realtime can open a four-stage recovery drill through the same cockpit lesson tool. The presentation first isolates the unreliable airspeed gauge, then moves its aperture to the physical PITOT rocker. The learning layer cannot operate the switch: it releases a bounded pointer path so the pilot must select the real GLB control, observes electrical effectiveness and live ice percentage, returns focus to IAS while the probe clears, and verifies completion only when sensed airspeed is reliable again. Start, physical action, clearing, elapsed recovery, and completion enter Black Box for a telemetry-backed debrief; an out-of-context request is rejected rather than staging a fake emergency. Compact screens retain a visible selected-control label and a 22 px nearest-control touch radius while distant taps remain ignored.

**Voice-driven alternator recovery:** when live telemetry shows a running engine and a battery-powered bus with the ALT switch off, GPT Realtime can open a second four-stage drill. It isolates the physical ALT rocker, requires the learner to operate that GLB control, and completes only after the electrical source changes to `ALT` and the bus returns to at least 13.5 V. A healthy bus, stopped engine, master-off state, and real alternator hardware fault are rejected rather than staged. In particular, `alternator_fault` never teaches switch cycling as a repair; Aviator directs battery conservation and landing planning. The measured source, voltage, switch event, recovery, and completion enter Black Box and the visual debrief record.

**Ignition training:** the dock's five-position ignition switch models OFF, each single magneto, BOTH, and spring-loaded START. A single magneto produces a measured 94% power factor; OFF stops the engine; START requires battery power, mixture, low throttle, and no engine fault. The selector gates the departure check and carries its exact engine state, blockers, control event, and recovery into alerts, Black Box, replay, and GPT Realtime coaching.

**Mixture training:** the dock's red mixture control computes a density-specific best-power setting, changes actual RPM/thrust, stops the engine at cutoff, and participates in the departure check. Too-lean, cutoff, and recovery transitions produce concise cockpit warnings, measured Black Box facts, and the same recommendation/power factor in GPT Realtime state. Standard-density flights remain full rich; Alpine and Desert departures can recover otherwise-lost power by leaning toward the displayed target.

**Pitot-heat training:** the dock's PITOT switch adds measured electrical load and becomes a departure requirement in rain or snow. Airborne visible moisture with ineffective heat accumulates deterministic trainer icing, makes only the sensed cockpit airspeed unreliable, and exposes the actual-versus-sensed split to the alert, Black Box, replay, and GPT Realtime instructor. Turning powered heat back on clears the indication and records the recovery; aerodynamic forces, mission scoring, and the model's true IAS remain unchanged.

**Progressive preflight:** the cockpit defaults to one readiness line instead of a flat wall of checks. Eight required items roll into Config, Power, and Systems groups; weather, visibility, and runway surface become one concise Conditions brief. Opening the line or failing verification discloses the four groups with blockers first, control corrections update the counts live, and successful clearance collapses the detail. The full underlying checklist remains unchanged for mission contracts, Black Box state, and GPT Realtime. Desktop and mobile alerts move clear of the expanded checklist rather than covering it.

**Cockpit flight plan:** cockpit mode keeps one objective, target, range, and ETA beside a six-stage glare-shield annunciator: Check, Roll, Climb, Route, Final, and Stop. Completed stages light green, the active stage lights amber, and recovery warnings light red without adding another floating progress card. The exact active stage, status, and six-step plan enter the read-only GPT Realtime flight state for phase-correct coaching. The full preflight expands only when requested or blocked; on mobile, the plan becomes six compact lamps and retains guidance when the separate navigation director is hidden.

**Realtime debrief:** **HEAR AVIATOR** packages only measured score, objective outcome, touchdown sink, centerline offset, stable-final state, fuel estimate, electrical state, and recent Black Box facts. A connected `gpt-realtime-2.1` session answers aloud with one visible strength, one correction, and one next drill. Receive-only coaching works with the microphone off; enabling MIC in Settings allows follow-up conversation. With Realtime offline, the report stays text-only and never substitutes a synthetic browser voice.

The on-screen cue bar always shows the exact key to press next. A compact top-centre navigation director mirrors the active corridor, relay point, or runway with heading, bearing, turn direction, altitude trend, and distance; the circular map below is track-up and uses the same topographic island raster as the Flight Board. **B** opens the Flight Board with scene briefings, conditions, best scores, and direct launch controls; **L** cycles Clear Circuit, Coastal Crosswind, Alpine Rescue, Storm Return, and Frontier Link; **H** opens the full controls. **⚙** has the same scene selector plus night mode, wind, turbulence, visibility, and practice failures (engine, vacuum, alternator, flap asymmetry). Each scene also carries a subtle procedural sound bed: quiet airfield hush, coastal surf, alpine wind, rain squall and distant storm rumble, or open-valley air; it fades with the simulator when paused. Crosswind scenes animate a striped windsock and call out the wind direction during the departure check; Storm Return also gives the runway a wet reflective treatment.

**Training Island:** open the map with **B** to access ten named regions on a live bird's-eye render of the shared Three.js island. The high-DPI overlay and aspect-correct camera support wheel/button zoom, drag or arrow-key pan, full-island reset, and a dedicated route-frame command (`↗` or **F** while the map is focused) that fits every selected route fix inside safe desktop or mobile margins. Manual pan, zoom, or destination changes release that framed camera state. Coast, inland water, elevation contours, biome relief, both runways, and a distance scale share one continuous chart; its cached 1440x760 regional-relief cartography retains five measured elevation zones and directional hillshade while giving the rain coast, western pasture, alpine range, eastern mesa, and ember field distinct restrained color identities. Ocean, lake, beach, lowland, rock, and snow remain derived from the same authoritative height and water sources. Terrain, Weather, and Traffic chart tabs preserve the selected destination and camera: Weather plots authored visibility, wind vectors, precipitation, dust, and turbulence cells, while Traffic adds range rings, approach extensions, live tracks, headings, and altitude labels. The tab is persisted locally and supports click, touch, and Left/Right/Home/End keyboard selection. Mission records distinguish current, mastered, in-progress, available, and free-flight landmark states. Terrain, training-region, and airspace detail disclose progressively. At full-island desktop scale, all six authored academy regions remain named through deterministic label placement that reserves the focus card and every marker; a label is suppressed rather than drawn over another artifact. Hovering a marker opens a crisp, clamped location preview without changing the committed destination; clicking selects it, preserves mastered/current state, and draws a charted course corridor as straight measured legs between authored fixes. Route focus snaps course symbols to their geographic anchors, dims off-route markers and connections without disabling their hit targets, replaces each intermediate destination marker with one numbered fix diamond, and suppresses duplicate endpoint, airspace, and departure-ownship labels. Route framing adds collision-aware desired-track and leg-distance labels plus DEP/FIX/ARR sequencing; mobile zooms farther around the course while retaining 40 px touch targets, suppresses secondary labels, and collapses live status to a dot so the layer controls stay clear. The destination card plots the actual `terrainH` profile with measured leg count, bearing, distance, cruise altitude, clearance, ETA, weather, compact visibility, objective, and two local lessons. Those lessons compare authored difficulty, mission type, three-objective progress, reward or best score, and completion state; click/tap or use Up/Down/Home/End to select one, and that exact choice persists into the cockpit and GPT Realtime state. On mobile, the rank row collapses to 54 px and a persistent selected-destination rail keeps distance, bearing, terrain clearance, weather, briefing access, **GO**, and **FLY** inside the first map viewport; the redundant desktop hover card is suppressed so it cannot cover the route. Landmarks correctly disable scored launch, and the summary opens the full briefing by keyboard or touch. Each card uses a 1040x460 WebP capture of that exact Three.js location rather than generic procedural artwork; all ten total 253 KB and keep the old canvas renderer only as a missing-asset fallback. Four additional landmarks remain explicit free-flight destinations instead of pretending to host authored routes. The map also projects your moving aircraft, parked aircraft, and active traffic. In Traffic mode, every visible aircraft has a callsign, 45-second vector, history tail, clock position, range, relative altitude, closure trend, and clear/monitor/alert state; click or tap a target, or use **N** and **Shift+N**, to inspect it without changing the selected lesson. The same selected traffic record enters GPT Realtime read-only state, and mobile suppresses secondary chart labels while keeping 28 px traffic targets and the destination rail. Closing and reopening clears transient drag state while preserving the active cockpit camera; Fast Travel remains separate, reset returns to that travel start, and career XP is never changed by travel.

**Physical island slices:** six destinations now lazy-load a 218 KB loader-free runtime pack derived from 21 selected CC0 Kenney GLBs. All six use shared geometry/material caches, instanced scenery, simple collision proxies, and near/far/dormant culling. Alpine adds a rescue camp and moving snowcat; Kauri adds roads, houses, fences, and a service car; Shepherd adds a barn, pasture, and 52 sheep; Breakwater adds a dock, coast station, birds, and watercraft; Silver Lake adds lilies, survey infrastructure, birds, and a moving canoe; Ember adds a column/obelisk ruin field with localized embers. Ambient motion is render-only and does not enter flight physics.

The coastal scene also exposes an animated cove beneath the lighthouse pier, with bobbing navigation buoys and night lamps; water contact is treated as a ditching event during that flight.

**Alpine Rescue:** a deterministic 1,950.8 m summit, four shoulder peaks, erosion-inspired crag bands, and a carved glacial approach valley now form a true 2 km-scale range. A dedicated 220x190 terrain tile adds slope-aware grass, forest, rock, and a dithered ~1,100 m snowline while preserving the same `terrainH` source for rendering, collision, AGL, and glide calculations. Local cap cloud, valley fog, ridge-blown snow, and denser massif flurries stay render-only; generic clouds are excluded from the range so they cannot cut through rock. Collect a thermal shelter kit from the ridge beacon, release it over the Blender-authored rescue station inside the altitude/speed envelope, then rejoin the circuit. The implementation and verification record are in [docs/ALPINE_WORLD_PIPELINE.md](docs/ALPINE_WORLD_PIPELINE.md).

**Runway surfaces:** scene selection changes the live ground model, not just materials. Clear Circuit uses dry asphalt; Coastal Crosswind has reduced damp-pavement grip; Storm Return has wet braking and steering; Alpine Rescue uses packed snow with the longest rollout. The departure check names the surface, and low-grip rollouts call for smooth braking and gentle steering.

**Scene-aware checks:** the parked departure checklist also reports the selected crosswind, visibility and operating condition, plus runway surface, so weather pressure is visible before takeoff without turning an informational condition into an artificial dispatch block.

**Departure command:** the same parked checklist now includes a clickable **Confirm Check** command alongside the `E` shortcut. It invokes the existing live check, awards the same XP, and disappears once cleared or airborne.

Low-grip braking also changes the feedback texture: tire rumble is muffled on snow, while wet and snow surfaces add a light scrub tone, controller/browser-vibration pulse, and brief rear-wheel spray under sustained braking. These cues respect the existing sound and haptic controls.

Storm Return now adds deterministic lightning flashes, low thunder, and a restrained haptic pulse when a strike rolls through, while keeping weather effects render-side and flight physics deterministic.

**Mission variety:** Coastal Crosswind, Alpine Rescue, and Storm Return add a supply relay after the early route markers. Intercept the floating pod, carry it to the marked ground zone, then press **Q** only when the cue confirms a safe release altitude and speed. Pickup and delivery earn separate mission XP and trigger voice, alert, audio, skill-chain, and haptic feedback.

**Frontier Link:** a 2.1 km regional dispatch flight to a separate short-field airport. Clear the departure, collect the dispatch bag, release it at the Frontier cargo apron, then join the west-to-east PAPI approach and stop on Frontier Field Runway 09. Its landing surface, centerline score, PAPI bank, and completion gate are destination-aware rather than reusing Runway 36.

**Story missions:** the Flight Board now offers twelve missions across training, rescue, delivery, survey, emergency, and transport archetypes, with two choices in every scene. Each mission has a concise briefing, three persistent measured objectives, objective XP, a one-time completion bonus, live HUD progress, and an explicit complete/partial debrief outcome.

**Gamepad:** plug in a controller — sticks fly, right trigger is throttle, A brakes, X flaps, Y camera. Controller rumble and the browser vibration API (where supported) respond to checks, alerts, checkpoints, touchdown, stalls, and debriefs.

**Instant replay:** after a few seconds of flying, press **J** or choose **REPLAY** in the debrief to play the last 90 seconds. The flight physics pause during playback; **C**/**V** cycle chase, cockpit, nose, tail, free, and tower cameras, and **J** exits back to the exact live flight state.

**Focus safety:** leaving the browser tab during a live flight pauses the simulator and leaves it paused on return. Press **P** to resume, so an unattended tab cannot crash or advance a lesson.

**Flight clips:** **RECORD** captures up to 60 seconds of the desktop WebGL flight view and its live internal audio mix. Press it again to prepare the clip; **SHARE** uses the native file-share sheet when the browser supports it and otherwise downloads a `.webm` with a copied mission summary.

**Feedback controls:** `⚙` provides persistent master volume, haptic enable/strength, lightning-flash visibility, and graphics quality without changing flight physics. High keeps the full-resolution soft-shadow presentation; Balanced lowers render cost while keeping shadows; Performance uses native resolution without shadows. The local mix combines procedural engine, airflow, tire, and weather layers with supplied prop and crosswind recordings. Occasional stereo jet and helicopter passes cross the airfield as distant traffic, never as the player aircraft. Strong deterministic gusts now add a `G` value to the departure wind check, issue scene-specific approach advisories, and create rate-limited controller/phone pulses.

**Living airspace:** every distant traffic audio cue now has a matching render-only moving jet or helicopter silhouette. Its altitude and route spacing adapt to the active circuit, coast, alpine, storm, or frontier scene; it never collides with the trainer or modifies mission/flight physics.

**Flight-school fleet:** three material-varied Fable T-01 GLB trainers now occupy the Academy and Frontier aprons. They use the original project's 552-triangle LOD1 asset and remain render-only, while named parked-aircraft collision proxies protect the ground lesson. Each callsign is selectable on the live traffic chart with its real world position; the deterministic procedural player aircraft remains the sole flight-physics authority.

**Electrical training:** enable **Alternator failure** in `⚙` to run on battery power. The departure check blocks an ALT fault; in the air the system escalates from an alternator alert to low volts and electrical-off guidance. Battery state drives the aircraft nav/strobe/landing lights, the panel voltage readout, instructor callouts, alert tone, haptic cue, and instant replay, while leaving aerodynamic forces unchanged.

**Flap-asymmetry recovery:** enable **Flap asymmetry** in `⚙` during an approach to jam the right flap near retracted. The left/right surfaces visibly split, their difference creates a bounded roll/yaw tendency, and the objective, alert, instructor, sound, and haptic cue direct a wings-level recovery with **Shift+F**. The route resumes once the flaps are safely retracted.

## GPT Realtime aviator

Run the included same-origin server rather than a static file server, with `OPENAI_API_KEY` configured in the process environment:

```bash
cd /Users/arnav/Desktop/flight-sim
OPENAI_API_KEY="$OPENAI_API_KEY" node server/fable-flight-server.mjs
```

Open `http://127.0.0.1:8643` and press **BEGIN FLIGHT**. That user gesture requests microphone permission, receives a short-lived client secret, and connects directly to `gpt-realtime-2.1` over WebRTC. The top voice control pauses or resumes microphone input; Settings retains manual connect/disconnect controls. The aviator can call the read-only `get_flight_state` tool for live phase, mission objective, speed, altitude, warnings, weather, and parked departure checks; it cannot change the flight controls.

Before asking for microphone permission, the client checks the same-origin `/api/realtime/health` bridge endpoint. It reports only bridge/model/configuration status, never an API key or a session secret; a missing local bridge or `OPENAI_API_KEY` is surfaced directly in the Aviator status.

Verify the yoke lesson with real pointer input, Black Box facts, Realtime event payloads, and desktop/mobile screenshots:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_control_lab.cjs
```

Verify the physical instrument GLB, all six telemetry pivots, direct gauge inspection, failure-boundary/Realtime parity, panel pixels, and desktop/mobile fit:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cockpit_instrument_pack.cjs
```

Verify the spatial cockpit guide, eleven projected controls, focus aperture, measured lessons, Realtime presentation tool, practice handoff, and mobile composition:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cockpit_spatial_tutor.cjs
```

Verify the six internal camera transforms, focused four-view player cycle, integrated cockpit, unobstructed nose view, Realtime auto-start contract, voice pause state, and desktop/mobile toolbar fit:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_camera_voice_shell.cjs
```

Verify the physical adaptive cold-start lesson, real BAT/mixture/throttle/START actions, measured idle completion, rejected impossible states, Black Box facts, and mobile interaction:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cold_start_tutor.cjs
```

Verify the Realtime-triggered pitot-icing drill, physical-only rocker action, live clearing, Black Box completion facts, rejected inactive conditions, and desktop/mobile interaction apertures:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_pitot_recovery_tutor.cjs
```

Verify the Realtime-triggered alternator-bus drill, physical-only ALT rocker action, source/voltage completion, hardware-fault rejection, Black Box facts, and desktop/mobile interaction:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_alternator_recovery_tutor.cjs
```

Verify the continuous cockpit panel, physical asset loading, live electrical/preflight annunciators, direct battery interaction, Realtime parity, and clean desktop/mobile composition:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cockpit_integrated_panel.cjs
```

Verify the physical-first default, compact status strip, direct physical battery action, one-click accessible controls, Realtime parity, cue spacing, and desktop/mobile fit:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_physical_first_dock.cjs
```

Verify the physical engine quadrant, direct throttle/mixture drags, cutoff consequences, dock/Realtime parity, and desktop/mobile reachability:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cockpit_engine_quadrant.cjs
```

Verify the physical systems console, magneto drag/start sequence, BAT/ALT/PITOT consequences, Realtime parity, and mobile reachability:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cockpit_systems_console.cjs
```

Verify the physical flap/trim/brake pedestal, direct detents and limits, momentary braking, runway-surface feedback, Realtime/Black Box parity, and desktop/mobile reachability:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_cockpit_flight_controls.cjs
```

Verify ignition limits, starter interlocks, telemetry, Realtime grounding, replay, hover help, and mobile fit:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_ignition_training.cjs
```

Verify the measured fuel-feed system, selector and boost-pump recovery procedure, engine consequences, Realtime grounding, Black Box/replay evidence, and 44 px mobile interaction targets:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_fuel_feed_recovery_tutor.cjs
```

Verify pitot electrical load, weather preflight gating, measured display error, recovery, Realtime/Black Box grounding, replay, hover feedback, and mobile fit:

```bash
NODE_PATH=/Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/arnav/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_pitot_heat_training.cjs
```

**Flight alerts:** a desktop annunciator stays on-screen with the corrective action for engine loss, stalls, sink rate, overspeed, flap speed, instrument failures, unstable finals, incomplete takeoff checks, and a guided-lesson training hold. It disappears with the HUD toggle.

**Cinematic HUD:** press `U` or use the HUD control to hide every flight overlay without pausing or changing the simulation. The preference persists for the next launch, and the retained control exposes its pressed state for assistive technology.

**Departure discipline:** press `E` while parked to confirm the live departure check. A guided takeoff without that confirmation remains flyable for control practice, but puts the lesson in a training hold: route gates, delivery progress, and mission XP remain locked until restart. Free flight is unaffected.

**Scene airspace:** each flight now has its own distant-traffic playlist in addition to its weather bed. Coastal and alpine runs prioritize rotor traffic, Storm Return uses a sparse fast-jet pass, and Frontier Link uses regional transport traffic; the existing animated aircraft silhouette follows the selected clip without affecting aircraft physics.

**Objective telemetry:** the mission card now shows the current director target, range, live-speed ETA, and compact scene/runway condition on every guided flight. It intentionally pauses the route readout when a training hold or no active director target applies.

**Go-around recovery:** clearly unsafe low-final states trigger an instructor call, and an eligible final also exposes a guarded **GO AROUND** control in the mission HUD so the pilot can make the decision early. Both paths use the same climb-out; full power, positive climb, safe airspeed, and 120 m AGL earn recovery XP before the normal route resumes. It is a training overlay only; aircraft forces stay unchanged.

**Scene gust feedback:** coastal, alpine, storm, desert, and frontier gust onsets have distinct, rate-limited haptic and short procedural-audio pulses. They are tied to the existing per-scene wind state and remain supplemental to the actionable flight alert; no local speech is synthesized.

**Scene-aware Aviator:** GPT Realtime receives structured active-level weather, visibility, gust, surface-grip/braking, and ambience telemetry along with the objective. Its coaching can therefore name the actual sand, snow, wet, or clear-surface procedure instead of inferring it from a scene title.

**Live scene strip:** the mission HUD now keeps current visibility, weather, and runway surface together on one compact telemetry line, so a player sees the actual low-visibility or low-grip condition while flying rather than only in the launch brief.

**Weather and energy training:** five deterministic regimes now change visibility, gusts, vertical air, sound, guidance, and density-aware aircraft performance. Storm Return layers near/far rain with wet rolling spray; Alpine and Desert missions teach the longer takeoff roll, reduced climb, and 75-90 kt energy discipline through the same HUD and GPT Realtime flight state.

**Flight Board conditions:** scene cards now show their runway surface alongside visibility, wind, weather, and XP multiplier before launch, making wet, snow, sand, and short-field handling differences visible at selection time.

**Route guidance:** enable **Route guidance** in `⚙` for one sparse centerline of moving chevrons to the same active waypoint, relay, go-around, or arrival target used by the mission system, plus a circular track-up topographic map with upcoming waypoints. Disable it for a clean visual flight while leaving the route, corridor brackets, and objectives unchanged. GPT Realtime Aviator receives the identical bearing, error, turn, and vertical correction data for short relaxed coaching.

**Scene launch cues:** each flight selection opens with its own short procedural cue, including dedicated Alpine Rescue and Frontier Link motifs. The cue follows the existing user-gesture-safe launch or level-selection path and stays separate from the GPT Realtime Aviator voice.

**Career recovery record:** successful go-arounds and dead-stick landings are counted separately in the persistent Flight Board record and the mission debrief. They are recorded achievements, not contract goals, so the normal proficiency loop never rewards creating an unsafe approach on purpose.

**Haptic calibration:** `⚙` now includes **TEST HAPTICS**. It reports whether feedback will use a controller actuator, browser vibration fallback, or no available haptic device, then sends a short calibration pulse without changing normal alert rate limits.

**Mission cargo:** relay packages now carry scene-specific 3D signatures throughout pickup, carriage, and release: a rescue ring, shelter roll, medical cross, or dispatch seal. Delivery rules and drop physics are unchanged.

**Engine-out training:** an airborne engine failure now suspends ordinary route guidance and locks the closest available runway as a dead-stick diversion. The objective, cue bar, alert, voice callout, director, and guide arrow name that runway and show a conservative glide-margin estimate. A centered, controlled touchdown on that strip earns recovery XP and a skill-chain event; a wrong, hard, or fast landing records a missed diversion. Flight forces and normal lesson completion remain unchanged.

**Landing procedure:** on final, set flaps **50**, maintain **65 kt**, and follow the four PAPI lamps: more white means high, more red means low, and two white/two red is on slope. When the localizer is materially off-center, the cue and alert specify a gentle left or right correction. Flare below **10 m**, then brake with **Space** after touchdown; the rollout cue names remaining runway distance when braking becomes urgent, including the opposite-direction Frontier Field arrival. Landing skill XP is held until the aircraft has remained centered and intact through a short stable rollout, so a gear-collapse crash cannot leave a false clean-landing reward on-screen. The mission card can be hovered to inspect the live objective, director data, and this procedure. Press `I` to show or hide compact localizer and glideslope bars in the attitude instrument; high/low deviations feed the existing corrective alert and stabilized-final check without changing the flight model.

**Rollout reference:** near the end of a rollout, the cue now pairs remaining runway with a surface-aware approximate stop distance. A late, unbraked rollout raises a `BRAKE POINT` alert. This is a training reference derived from the existing surface brake profile; it does not alter the force model.

`BRAKE POINT` also delivers one rate-limited haptic/procedural-audio prompt when the alert begins, matching the other actionable training feedback without vibrating continuously during rollout.

**Skills (Forza-style):** low passes, terrain skims, aileron rolls, close calls, and greaser landings build a **combo chain** with a rising multiplier. The chain banks when you stop stunting and forfeits if you crash. Your best skill score persists.

**Pilot career:** completed flights bank mission, skill, grade, and relay XP into one persistent pilot profile. A hideable top rank strip previews current-flight mission and skill XP, while the debrief remains the authoritative save point. The Flight Board shows exact rank progress and a local leaderboard built only from recorded scene scores; every scene stays selectable from the start.

**Vertical route planning:** select the compact route profile in a destination briefing to isolate a measured side view of the selected course. The chart uses the same `terrainH` samples as collision and AGL, overlays the planned climb/cruise/descent path, a 180 m terrain-clearance reference, weather and visibility, and live position/terrain/plan/margin readouts. Pointer movement or Left/Right/Home/End inspects individual samples; Escape restores the selected lesson without closing the Flight Board. The expanded view and its launch controls remain contained on mobile.

**Desert Run:** a sixth training flight adds a compacted-sand strip, thermal gusts, dust haze, a water-pod relay, procedural dunes and rock mesas, and a blinking solar outpost at the real delivery coordinate, plus sand-specific rollout guidance. It runs locally with no external image dependency. Optional Blockade Labs Skybox panoramas use the opt-in [skybox manifest](assets/skyboxes/README.md), so credentials stay off the client.

**Cold and desert terrain separation:** the green decorative ground-patch layer is suppressed in Alpine Rescue and Desert Run, leaving snow fields in the alpine level and sand-tinted dunes, rocks, dust, and outpost in the desert as their visible ground language.

**Optional Skybox panorama:** a declared local panorama now replaces the procedural dome without being multiplied by the scene tint. Missing, loading, invalid, and failed manifest entries retain the local sky; `SIM.skybox()` reports the active fallback or loaded state.

**Feedback:** haptics remain rate-limited and opt-in. Cargo pickup and delivery now use distinct audio/haptic acknowledgements, while lower-grip sand braking produces a short dust plume and the existing gentle brake feedback instead of continuous vibration.

**Precision release:** when a relay is inside its real altitude, speed, and zone window, both the guarded **RELEASE POD** control and `Q` invoke the exact same delivery route. Outside that window, either input keeps the cargo aboard and names the corrective condition.

**Surface instruction:** wet, snow, and compacted-sand scenes state the expected longer roll and smooth-rudder technique in departure checks. Once rolling, low-grip surfaces drive the same alert and cue guidance, while the GPT Realtime Aviator receives the matching instructor event.

**Relay instruction:** cargo objectives show live pickup range and exact drop distance, AGL, and airspeed windows. The mission text tells the pilot whether to navigate, climb/descend, slow/accelerate, or release, rather than relying on a bare drop ring. A guarded **Release Pod** command appears only inside the same safe window as `Q`.

**Realtime Aviator:** when connected, GPT Realtime Aviator receives the same read-only relay objective, pickup range, and drop-window telemetry. It can coach the next correction using the live simulator state; no browser TTS, prerecorded instructor voice, or legacy TTS generation path is retained.

**Visible outcomes:** successful Desert Run water delivery lights the real outpost's beacon, pad, and tank. Retrying the lesson or switching scenes clears that acknowledgement with the underlying delivery state.

**Scene lighting:** each flight profile now has its own sun direction for shadows and glare: neutral circuit light, cool coastal light, alpine high sun, storm-side light, low desert gold, and valley light at Frontier. These are render-only scene profiles; aircraft forces remain unchanged.

**Launch carousel:** the boot screen keeps the live 3D scene behind the flight brief and adds previous/next scene controls, a scene count, and XP multiplier. Selecting through the carousel or dropdown updates the real level state before launch.

**Camera control:** settings include persisted camera sensitivity for mouse orbit and wheel zoom, bounded from 50% to 180%. It changes only presentation controls, never flight inputs.

**Scene transitions:** boot-only scene changes use a short reduced-motion-aware transition over the live renderer. It is presentation-only and never runs during an active flight.

**Weather and crash presentation:** Storm Return now has a denser, wind-sheared rain field for better speed and depth perception. Terrain impact, gear collapse, and water ditching have separate render-only fire/smoke, scrape/spark, and vapor signatures. Reset clears the scene immediately and no effect changes aircraft physics.

**Realtime scope:** the Aviator bridge uses `gpt-realtime-2.1` with fixed `marin` voice output and one read-only flight-state tool. Civilian training is the active scope; multiplayer, dogfights, and fictional combat radio remain parked until authoritative networking exists.

**Staged island assets:** `assets/source-packs/kenney` contains the locally downloaded CC0 Kenney Nature and Survival source packs (409 GLBs). The runtime shortlist and integration rules live in [`ASSET_MANIFEST.md`](assets/source-packs/kenney/ASSET_MANIFEST.md). These archives are deliberately not included in the live browser load path.

## Built with the LOOPS method
Spec → contract of testable assertions → build → deterministic browser evaluation (`window.SIM.warp()`) → repair from the trace. The paper trail is in this repo: [contract.md](contract.md) (126 graded assertion rows), [log.md](log.md) (every bug and what it taught), [sprint-spec.md](sprint-spec.md), [progress.md](progress.md), [feature_list.json](feature_list.json), and [Island Alpha verification](docs/ISLAND_ALPHA_VERIFICATION.md).

## Credits
- Parked apron aircraft: ["Cartoon Plane"](https://sketchfab.com/3d-models/cartoon-plane-f312ec9f87794bdd83630a3bc694d8ea) by [antonmoek](https://sketchfab.com/antonmoek), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — converted from GLB to embedded JS (vertex-color bake, no runtime loaders) by `scripts` tooling.
- Airfield service set and control tower: authored locally in Blender 5.1. Run `scripts/build_airfield_props.py` to regenerate the editable `assets/fable-airfield-props.blend`, interoperable `.glb`, and loader-free `blender-airfield-props.js` runtime bake.
- Scene landmarks: a coast guard lighthouse/pier, alpine rescue station/heli pad, and storm emergency shelter/radio mast are authored locally in Blender 5.1. Run `scripts/build_scene_landmarks.py` to regenerate `assets/fable-scene-landmarks.blend`, `.glb`, and `blender-scene-landmarks.js`; the browser only shows the tagged landmark set for the active scene.
- Fable T-01 aircraft handoff: run `scripts/build_fable_t01_aircraft.py` to regenerate the original named-part Blender source, separate browser LOD/collision GLBs, PBR/UV manifest, and preview render. The asset mirrors the live aileron/flap/elevator/rudder/propeller/wheel boundaries but deliberately leaves the existing deterministic Three.js aircraft in charge of physics; see [`docs/FABLE_T01_BLENDER_HANDOFF.md`](docs/FABLE_T01_BLENDER_HANDOFF.md).
- Island scenery slices: 21 selected models from [Kenney Nature Kit](https://kenney.nl/assets/nature-kit), CC0. Run `scripts/build_island_runtime_pack.py` through Blender 5.1 to regenerate the normalized, loader-free `assets/runtime/island-runtime-pack.js` bake used by Alpine Rescue Ridge, Kauri Township, Shepherd Highlands, Breakwater Bay, Silver Lake, and Ember Ruins.
- Alpine terrain technique: the original runtime implementation is informed by Rune Skovbo Johansen's point-evaluable [Advanced Terrain Erosion Filter](https://blog.runevision.com/2026/03/advanced-terrain-erosion-filter-for.html), released under MPL-2.0; no shader source was copied. Thomas Schander's [Enscape Cube](https://www.shadertoy.com/view/4dSBDt) is a visual reference only and its shader code is not included because its reuse license has not been verified.
- Instructor voice: GPT Realtime Aviator only; legacy local voice files are not loaded by the game.
- External aircraft audio: `assets/audio/aeroprop-trainer.mp3`, `assets/audio/windgust-crosswind.mp3`, and `assets/audio/aerojet-distant-flyby.mp3` are user-supplied ElevenLabs renders. `assets/audio/helicopter-distant-flyby.ogg` is [Helicopter SFX by WuxiaScrub](https://opengameart.org/content/helicopter-sfx), CC0. The fourteen WAV sources in `assets/audio/library` are documented in `manifest.json`: aircraft traffic, scene wind/rain/thunder, plus nonverbal radio static, transmit, and interference for the GPT Realtime radio layer. The supplied sci-fi bed is intentionally excluded from the civilian trainer mix.
- Everything else (aircraft, terrain, instruments, and remaining audio) is procedural.

Authored with Claude Fable 5 in Claude Code, evaluated in a real browser at every step. MIT (code); the Sketchfab model retains its CC-BY license.
