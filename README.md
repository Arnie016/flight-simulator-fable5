# Fable Flight — browser flight trainer

A single-file flight simulator with a voice instructor, scored training circuits, real(ish) trainer physics, procedural terrain, night flying, and practice failures. No build step, no assets — one HTML file plus Three.js from a CDN.

**Fly it: https://arnie016.github.io/fable-flight/** (or just open `index.html`)

## How to fly
Hold **W** for full throttle → pull **↓** at 55 kt → follow the voice instructor and the cyan rings around the circuit → land gently (~65 kt, flaps **F**, flare below 10 m) → brake with **Space**. Your circuit gets scored.

The on-screen cue bar always shows the exact key to press next. **H** opens the full controls. **⚙** has night mode, wind, turbulence, visibility, and practice failures (engine out, vacuum failure).

## Built with the LOOPS method
Spec → contract of testable assertions → build → deterministic browser evaluation (`window.SIM.warp()`) → repair from the trace. The paper trail is in this repo: [contract.md](contract.md) (63 graded assertions), [log.md](log.md) (every bug and what it taught), [sprint-spec.md](sprint-spec.md), [progress.md](progress.md), [feature_list.json](feature_list.json).

Authored with Claude Fable 5 in Claude Code, evaluated in a real browser at every step. MIT.
