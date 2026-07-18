# Cockpit Asset Manifest

## Flight control yoke

- Runtime file: `flight_control_yoke_textured.glb`
- Source: `/Users/arnav/Desktop/higgfield/outputs/framecrawler-loops-five-assets/glb_textured/flight_control_yoke_textured.glb`
- SHA-256: `32b21547ad4099b5e931d59121464ee826b4d5ec0fcb49761420dff1b3d9bd61`
- Generator: Blender 5.1 glTF exporter
- Size: 2,727,172 bytes
- Structure: seven named mesh parts, four PBR materials, one embedded PNG texture
- Rights: user-supplied project asset; do not redistribute outside this project without confirming the upstream generation inputs and rights.

The browser loads this GLB on demand for the cockpit and Control Lab. If loading fails, the existing procedural yoke remains visible and the lesson continues in fallback mode.

## Astrolabe compass

- Runtime file: `pirate_astrolabe_compass_textured.glb`
- Source: `/Users/arnav/Desktop/higgfield/outputs/framecrawler-loops-five-assets/glb_textured/pirate_astrolabe_compass_textured.glb`
- SHA-256: `421d93d3cdfccd0da95bb14dba0b49cb109ea95df06b675714160c1f0f84d330`
- Generator: Blender 5.1 glTF exporter
- Size: 3,023,812 bytes
- Structure: named case, face, cardinal markers, north/south needles, pivot, glow, and outer ring with embedded PBR textures
- Rights: user-supplied project asset; do not redistribute outside this project without confirming the upstream generation inputs and rights.

The compass is mounted in the 3D cockpit and its named needle pivot follows live aircraft heading. A failed load leaves the main in-panel heading instrument available.

## Primary instrument pack

- Runtime file: `primary_instrument_pack.glb`
- Editable source: `source/primary_instrument_pack.blend`
- Builder: `../../scripts/build_cockpit_instrument_pack.py`
- SHA-256: `a2ed6d686808ee57bf0a3ff60546f9d489e2f5b9f74236124da57d651c208133`
- Generator: Blender 5.1 glTF exporter
- Size: 1,464,720 bytes
- Structure: five named physical instruments, 90 inspectable meshes, and six live pivots for airspeed, attitude roll/pitch, altitude, vertical speed, and heading
- Rights: authored for this project from Blender primitives and generated text geometry; no third-party geometry or texture is included.

The cockpit drives every pivot from the deterministic simulation state. Hovering or tapping a gauge lifts its named assembly forward and exposes the same value, operating range, and modeled failure boundary sent to GPT Realtime. A failed load restores the prior live canvas face.

## Engine control quadrant

- Runtime file: `engine_control_quadrant.glb`
- Editable source: `source/engine_control_quadrant.blend`
- Builder: `../../scripts/build_cockpit_engine_quadrant.py`
- SHA-256: `6d8768875ea424172573af82e3b983f65fcbc1c852aef30bcfb39930dde09223`
- Generator: Blender 5.1 glTF exporter
- Size: 851,844 bytes
- Structure: 24 inspectable meshes, named throttle and mixture assemblies, and two live lever pivots
- Rights: authored for this project from Blender primitives and generated text geometry; no third-party geometry or texture is included.

The quadrant mounts directly in cockpit view. Its black throttle and red mixture controls track the deterministic engine state, lift on hover, and accept vertical pointer or touch drags. The compact cockpit mount keeps both controls reachable on narrow screens. A failed GLB load leaves the existing systems dock fully operable.

## Flight systems console

- Runtime file: `flight_systems_console.glb`
- Editable source: `source/flight_systems_console.blend`
- Builder: `../../scripts/build_cockpit_systems_console.py`
- SHA-256: `4f76a55e0c2f977bd6129d495790cde1a6010b5684eff8f4fc2beca2bb36797b`
- Generator: Blender 5.1 glTF exporter
- Size: 1,722,396 bytes
- Structure: 35 inspectable meshes, four named control assemblies, one five-position ignition pivot, three live rocker pivots, and three annunciator lamps
- Rights: authored for this project from Blender primitives and generated text geometry; no third-party geometry or texture is included.

The console mounts opposite the engine quadrant. Its keyed magneto selector supports OFF, left, right, BOTH, and spring-loaded START; the BAT, ALT, and PITOT rockers call the same deterministic system controls as the fallback dock. Hover or touch exposes measured values, operating ranges, starter blockers, and failure consequences. The narrow-screen mount keeps all four controls reachable above the engine quadrant.

## Flight controls pedestal

- Runtime file: `flight_controls_pedestal.glb`
- Editable source: `source/flight_controls_pedestal.blend`
- Builder: `../../scripts/build_cockpit_flight_controls.py`
- SHA-256: `69e5061eec6cbb184cae8aa32f760e3d4dc9fc6cb0a337d04ce01b0f740bd01f`
- Generator: Blender 5.1 glTF exporter
- Size: 2,444,360 bytes
- Structure: 40 inspectable meshes, three named control assemblies, and live flap-selector, trim-wheel, and brake-paddle pivots
- Rights: authored for this project from Blender primitives and generated text geometry; no third-party geometry or texture is included.

The pedestal completes the physical lower cockpit control set. Flaps snap to 0, 50, and FULL; elevator trim moves continuously through its measured -25% to +25% range; and the wheel-brake paddle remains active only while held. Every direct mouse or touch action writes the authoritative simulation control, drives the visible pivot and pilot hand, records a Black Box event, and publishes command, actual, runway-surface, range, and failure-boundary state to GPT Realtime. The HTML dock remains the keyboard and asset-load fallback.
