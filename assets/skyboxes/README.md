# Optional Blockade Skybox assets

`Desert Run` already ships with a local procedural dune field, dust haze, and sand-strip handling. A Blockade Labs panorama is an optional visual replacement for its sky dome.

1. Generate an equirectangular 360-degree panorama in Skybox AI using this prompt:

   `Cinematic realistic desert flight training range, compact sand airstrip in foreground, wind-carved orange dunes and low mesas, sparse dark volcanic rocks, distant desert outpost, late-afternoon golden sun, warm dust haze, clear horizon, no aircraft, no buildings near camera, no text, no watermark, seamless 360 equirectangular panorama`

2. Export a web-sized JPG or WebP, preferably 4096x2048 or lower.
3. Place it at `assets/skyboxes/desert-run.jpg`.
4. Replace `manifest.json` with:

   ```json
   { "version": 1, "scenes": { "desert": "assets/skyboxes/desert-run.jpg" } }
   ```

The app only requests images declared in this manifest. Keep Blockade API credentials server-side; do not put them in this static client.
