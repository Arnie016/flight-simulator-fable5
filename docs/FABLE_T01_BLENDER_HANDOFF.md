# Fable T-01 Blender handoff

`scripts/build_fable_t01_aircraft.py` generates an original trainer-aircraft source and browser-ready handoff under `assets/aircraft/`.

## Contract

- Units: metres. Blender is `+Y` forward / `+Z` up; Three.js is `-Z` forward / `+Y` up.
- The current procedural Three.js aircraft and deterministic 120 Hz simulation remain physics authority.
- LOD0 exposes separate ailerons, flaps, elevators, rudder, propeller, wheels, cockpit panel, and camera/cargo/light sockets.
- Control-surface origins are their hinge pivots. glTF extras record hinge axes and travel limits.
- Collision geometry is exported separately and stays simple. It is evidence for a future visual migration, not a second flight model.
- LOD0, LOD1, and LOD2 are separate GLBs. This avoids stacking meshes and lets the browser choose distance thresholds explicitly.

## Generate and validate

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup --background --python scripts/build_fable_t01_aircraft.py
python3 scripts/validate_fable_t01_glb.py
```

The validator checks GLB headers, required node names, UV0 coverage, PBR material assignment, triangle budgets, collision proxies, scale, and a 5 MB per-file ceiling. Its report is `artifacts/fable-t01-aircraft-validation.json`; the Blender render proof is `artifacts/fable-t01-aircraft-handoff.png`.

## Browser migration boundary

1. Load `fable-t01-aircraft.glb` only after the existing procedural plane is flying correctly.
2. Parent the visual root to the existing `plane` group; do not move physics state into GLTF nodes.
3. Bind existing `surf.*`, propeller, wheel-spin, cockpit visibility, and light updates to the named nodes.
4. Compare attitude, control deflection, contact points, cockpit camera, and crash/reset behavior before hiding the procedural visual mesh.
5. Add a reviewed high-poly source and baked normal/ORM textures before calling the aircraft production-realistic. The current UV/PBR asset is a deterministic animation and integration baseline, not photogrammetry.
