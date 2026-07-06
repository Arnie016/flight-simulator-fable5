# Progress — Flight Sim v4 "Training Platform"

**Updated:** 2026-07-06

## Where things stand
v3 graded (late, after the classifier outage — one real bug found: dead terrain hash, fixed) and the v4 leg is built and fully graded: 18/18 new assertions plus all regressions green (contract §A–C). The sim is now a training platform: real engine model with failures, weather and turbulence, night flying with a landing light, a lake you can ditch in, scored circuits with persistent best, contextual key cues, and a flight-path predictor.

## Working right now (machine-verified)
- Terrain: hills to 96 m that physics respects, flat airfield + pattern, carved lake basin, ditching crash
- Engine: RPM lag, windmilling on failure + instructor emergency guidance + recovery; vacuum failure corrupts only the gauge
- Weather: deterministic turbulence layers, thermals over sunlit hills, visibility control
- Night: full lighting switch at 61 FPS with landing-light cone and runway edge lights
- Training: scored circuit (alt/speed/sink/centerline → grade + best), cue bar with lit keycaps, predictor line, settings panel
- Fuzz with turbulence + mid-fuzz engine failure: zero NaNs; FPS 61–73

## Unverified by machine
- Voice audio and mouse feel (ears/hand); full 6-ring circuit in one continuous human flight (B21)

## Next action
Fly it: one full scored circuit (chase the grade), then one night circuit, then engine-failure practice (⚙ → Engine failure mid-climb). Report anything that feels wrong → /skill-repair-loop. Parked next wins in feature_list.json — audio remains #1.
