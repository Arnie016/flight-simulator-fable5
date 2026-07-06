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
- [ ] A18 mouse orbit/zoom — manual check on first flight (unchanged)
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
- [ ] B21 full guided circuit end-to-end — legs verified individually (gate pass, approach calls, landing, completion logic); the complete 6-ring flight is the human's first training flight

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

## Determinism guarantee (unchanged)
Everything inside `step()` — physics, wind gusts, phase detection, mission gates, instruction *emission* — depends only on state + `S.simTime`. Speech synthesis, effects, camera shake, and UI run render-side and never touch physics.

## Non-goals
Certified-accurate aerodynamics; audio (parked); envelope protection (zoom climbs are permitted energy-consistent aerobatics).

## Amendment rule
Changes only by renegotiation, recorded in [log.md](log.md).
