# Fable Flight — browser flight trainer

A single-file flight simulator with a voice instructor, scored training circuits, real(ish) trainer physics, procedural terrain, night flying, and practice failures. No build step, no assets — one HTML file plus Three.js from a CDN.

**Fly it: https://arnie016.github.io/flight-simulator-fable5/** (or just open `index.html`)

## How to fly
Hold **W** for full throttle → pull **↓** at 55 kt → follow the voice instructor and the cyan rings around the circuit → land gently (~65 kt, flaps **F**, flare below 10 m) → brake with **Space**. Your circuit gets scored.

The on-screen cue bar always shows the exact key to press next. **H** opens the full controls. **⚙** has night mode, wind, turbulence, visibility, and practice failures (engine out, vacuum failure).

**Gamepad:** plug in a controller — sticks fly, right trigger is throttle, A brakes, X flaps, Y camera. It rumbles on touchdown, stalls, and skill awards.

**Skills (Forza-style):** low passes, terrain skims, aileron rolls, close calls, and greaser landings build a **combo chain** with a rising multiplier. The chain banks when you stop stunting and forfeits if you crash. Your best skill score persists.

## Built with the LOOPS method
Spec → contract of testable assertions → build → deterministic browser evaluation (`window.SIM.warp()`) → repair from the trace. The paper trail is in this repo: [contract.md](contract.md) (63 graded assertions), [log.md](log.md) (every bug and what it taught), [sprint-spec.md](sprint-spec.md), [progress.md](progress.md), [feature_list.json](feature_list.json).

## Credits
- Parked apron aircraft: ["Cartoon Plane"](https://sketchfab.com/3d-models/cartoon-plane-f312ec9f87794bdd83630a3bc694d8ea) by [antonmoek](https://sketchfab.com/antonmoek), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — converted from GLB to embedded JS (vertex-color bake, no runtime loaders) by `scripts` tooling.
- Instructor voice: pre-generated with Deepgram Aura.
- Everything else (aircraft, terrain, instruments, audio) is procedural — no other assets.

Authored with Claude Fable 5 in Claude Code, evaluated in a real browser at every step. MIT (code); the Sketchfab model retains its CC-BY license.
