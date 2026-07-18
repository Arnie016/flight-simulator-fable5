# Sprint spec — Flight Sim Vertical Core

**The vague sentence this came from:** "build a fully fledged flight simulator as a browser-based web game — single self-contained HTML file, Three.js via CDN, open it in any browser and it works instantly."

## What done looks like
A single `index.html` that opens from disk in any modern browser and delivers a complete flying experience: a low-poly aircraft that takes off from a runway, flies with believable physics (lift, drag, thrust, gravity, stability, stall), lands or crashes, and resets — with a real instrument panel (ASI, artificial horizon, altimeter, VSI, heading, throttle), three camera modes, and a readable world, at 60 fps.

## In scope
- Flight dynamics: forces + moments, self-trimming stability, stall, ground roll/steering/braking
- Aircraft: low-poly model built from primitives, spinning prop
- Controls: keyboard (throttle/pitch/roll/yaw/brakes) + mouse camera orbit/zoom
- Cameras: chase, cockpit, free
- HUD: six-instrument panel drawn on canvas + status strip + crash/stall/pause banners
- World: runway with markings, grass with motion-perception patches, trees, hangars, mountains, clouds, blob shadow
- Collision (ground + obstacles), crash states with reasons, landing detection, reset
- Fixed-timestep physics, NaN guard, FPS counter
- Test API (`window.SIM`) so the evaluator can run assertions deterministically

## Out of scope (parked in feature_list.json)
Audio, weather/wind, AI traffic, missions, mobile/touch, multiplayer, damage model, night lighting, flaps/gear animations, multiple aircraft.

## Constraints
Single HTML file. One dependency: Three.js via CDN (pinned version). No build step. Clean sectioned code with comments. 60 fps on an ordinary laptop.

## Open questions for the human
None blocking — control convention chosen: stick convention (↓ pulls nose up), documented in the help overlay.

→ Contract negotiated in [contract.md](contract.md) before any code.
