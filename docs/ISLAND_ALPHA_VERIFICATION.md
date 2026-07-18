# Island Alpha Verification

Verified 2026-07-13 against `http://127.0.0.1:8643`.

| Scope | Evidence | Result |
| --- | --- | --- |
| W01-W05 world, travel, assets, population, budgets | `artifacts/island-world-verification.json` | 25/25 checks; 10 destinations; 2.61 MB critical load; 0.208 MB runtime pack |
| W06-W08 weather, rain, density, energy | `artifacts/weather-energy-verification.json` | 17/17 checks; five deterministic regimes |
| W10 missions | `artifacts/story-missions-verification.json` | 14/14 checks; 12 missions across six archetypes |
| W13 Black Box and microphone privacy | `artifacts/black-box-verification.json` | 12/12 checks; no stored microphone audio |
| W09, W11, W12, W14 | `artifacts/remaining-acceptance-verification.json` | 19/19 checks; three crash profiles; read-only Realtime; fixed voice; civilian scope |
| Balanced Mac performance | `artifacts/mac-balanced-performance.json` | Metal; 188.7 median FPS; 123.5 p10; nonblank frame |

All browser suites report zero console errors and include 1440x900 plus 390x844 fit checks where applicable. Source archives stay outside the runtime path; Kenney CC0, Sketchfab CC BY 4.0, user-supplied audio, WuxiaScrub CC0, and Mixkit sources are recorded in the repository manifests and README.
