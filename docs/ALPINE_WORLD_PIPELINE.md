# Alpine World Pipeline

## Runtime slice

The Alpine massif is an original deterministic implementation in `index.html`. One shared `terrainH(x, z)` function drives the rendered tile, terrain collision, AGL, glide calculations, fast travel, and landmark placement.

- Primary summit: 1,950.81 m at `[-3600, 2480]`.
- Four shoulder probes: 1,584.2 m, 1,624.6 m, 1,379.5 m, and 1,185.1 m.
- Glacial approach valley: carved from `[-1450, 900]` to `[-3250, 2500]`.
- Alpine tile: 4.4 x 3.8 km, 220x190 segments, 42,211 vertices.
- Surface language: grass, forest, slope-weighted rock, and deterministic dither around a 1,100 m snowline.
- Local weather: summit cap cloud, valley fog, 196-particle ridge plume, and denser camera-relative flurries.
- Cloud ownership: generic world clouds are excluded from the massif quadrant to prevent rock intersections.

All weather layers are render-only. They do not alter flight forces or deterministic mission state.

## Reference boundary

The ridge/gully approach is informed by Rune Skovbo Johansen's point-evaluable [Advanced Terrain Erosion Filter](https://blog.runevision.com/2026/03/advanced-terrain-erosion-filter-for.html), released under MPL-2.0. No source from that filter was copied; this project uses its own compact ridged-noise height term.

Thomas Schander's [Enscape Cube](https://www.shadertoy.com/view/4dSBDt) is used only as a visual reference for animated ocean, clouds, and mountain atmosphere. Its shader code is not imported because a reusable source license has not been verified.

## Verification snapshot

Measured on the local browser build:

- Repeated summit samples: exactly equal at 1,950.81 m.
- Summit flight probe: 240 m AGL, no crash.
- Alpine fast travel: 260 m AGL, cruise state, no crash.
- Rescue landmark: 0.02 m above sampled terrain.
- Academy circuit preservation: `terrainH(0, 0) = 0` and `terrainH(-800, 680) = 0`.
- Generic cloud intrusions: 0.
- Balanced 1440x900: 103 FPS, no blank frame.
- Mobile 390x844: 120 FPS, zero horizontal overflow.
- Browser console: zero errors; one known Three.js deprecation warning.

Visual proof: `artifacts/alpine-2km-final.png`.

## Production path

Do not export the island as one massive Blender GLB. Use Blender as a world compiler and Three.js as the runtime:

1. Author high-resolution terrain, erosion masks, splat maps, roads, rescue landmarks, and placement zones in Blender.
2. Bake height, slope, biome, snow, flow, and landmark metadata into versioned tiles and a manifest.
3. Export repeated props as optimized GLBs with shared materials, LODs, and instancing metadata.
4. Stream only nearby terrain/prop tiles; keep the deterministic runtime height source or a matching sampled heightfield for physics.
5. Validate height parity, landmark grounding, payload, culling, and FPS before promoting a tile.

This hybrid keeps Blender's authoring and automation strengths without turning a browser flight into a monolithic download.
