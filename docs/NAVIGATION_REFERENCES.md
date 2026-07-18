# Navigation and World Reference Ledger

Reviewed 2026-07-12. A reference is not a runtime dependency unless explicitly
stated below.

## Applied

- [Apple design skill](https://github.com/emilkowalski/skills/tree/main/skills/apple-design): immediate pointer feedback, spatial consistency, restrained motion, and reduced-motion fallbacks informed the atlas interaction. No package was copied or loaded.
- [Kinetics motion library](https://kinetics.colorion.co/): used only to compare spring/magnet/press behavior. The simulator keeps local CSS transitions and no Kinetics runtime.
- [Threenity Game UI post](https://x.com/i/status/2075944597944238540): used as a modular-HUD comparison. Its heavy mobile-game panel style was deliberately not copied.

## World Pipeline Candidates

- [Three.js Water Pro post](https://x.com/i/status/2075625736212254890): candidate for later water rendering evaluation; not integrated or licensed into this build.
- [VegetationGeneratorThreeJS](https://github.com/achrefelouafi/VegetationGeneratorThreeJS): candidate source study for WebGPU instancing and procedural vegetation; not integrated.
- [Blender MCP and Video2MotionCapture post](https://x.com/i/status/2074852539720454610): candidate workflow for future rigged ground characters; current island activity remains lightweight procedural motion.

## Not Used

The mobile-robotics textbook post, ShipSwift SwiftUI library, Atlas Explore app
crawler, Cycle Double Cover prompt PDF, and supplied wallet address do not solve
a current Fable Flight runtime or navigation requirement. They introduce no code,
asset, network, or payment dependency.
