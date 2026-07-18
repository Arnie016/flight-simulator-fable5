# OpenAI Build Week scope

Submission window: July 13–21, 2026.

This file separates the pre-existing Fable Flight simulator from the meaningful Build Week extension. Git history and the demo should use the same boundary.

## Pre-existing foundation

- Browser-based Three.js flight simulation.
- Basic flight controls, missions, scenery, and scoring.
- Existing public GitHub Pages deployment.

These capabilities provide the environment but are not presented as new Build Week work.

## Post–July 13 extension

- Physical Blender-authored cockpit instrument, yoke, compass, engine-quadrant, systems-console, and flight-control assets.
- Direct manipulation of cockpit controls with authoritative simulator-state parity.
- GPT Realtime Aviator with a same-origin session bridge, read-only state/tool contracts, microphone pause, and receive-only coaching.
- Black Box telemetry and evidence-grounded debrief state without microphone-audio storage.
- Spatial cockpit guide and measured control lessons.
- Voice-driven cold-start, pitot-icing, alternator, and related recovery instruction that requires the learner to operate the actual control.
- Expanded island atlas, lesson progression, route/weather/traffic evidence, and mobile/desktop verification.
- Deterministic verification scripts for cockpit, lesson, Realtime, map, accessibility, and release behavior.

## Current proof and known failure

- Current local app: `node server/fable-flight-server.mjs`, then open `http://127.0.0.1:8643`.
- Curated proof: `artifacts/devpost-screenshots/`.
- Built-in WebM recording was exercised on July 18 and produced a real five-second cockpit clip.
- `scripts/verify_training_release.cjs` initially exposed a one-to-three-pixel desktop balance mismatch. After accepting a three-pixel rendering tolerance, the rerun passed all nine checks on July 18. The denser cockpit/Realtime composition still needs human visual review before it is used as a final hero frame.

## Commit policy

- Use `build-week:` commit subjects for the post–July 13 extension.
- Commit product changes, representative proof, and verification scripts together when they describe one coherent capability.
- Do not commit API keys, `.env` files, private prompts, raw microphone data, or the full generated screenshot directory.
- Tag the final judged state after the human Realtime test, README verification, and demo recording.

## Submission language

The demo and Devpost description must say that the simulator is the pre-existing foundation and that the adaptive physical-cockpit teaching layer is the Build Week extension. The final description remains a human-authored submission.
