# OpenAI Build Week scope

Submission window: July 13–21, 2026.

## Build Week implementation

All capabilities presented in this submission were built during the July 13–21 Build Week window. Earlier repository shells, references, or unrelated experiments are not part of the judged claim. Git commits preserve the implementation and proof as it evolved during the event.

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

- Use `build-week:` commit subjects for the post–July 13 implementation.
- Commit product changes, representative proof, and verification scripts together when they describe one coherent capability.
- Do not commit API keys, `.env` files, private prompts, raw microphone data, or the full generated screenshot directory.
- Tag the final judged state after the human Realtime test, README verification, and demo recording.

## Submission language

The demo and Devpost description must say that every submitted capability was built after July 13. Do not describe unrelated repository context as submitted work. The final description remains human-authored.
