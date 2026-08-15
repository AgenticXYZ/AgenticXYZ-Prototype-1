# Canonical screenshots

The English images in this directory and the Simplified Chinese images in `zh-CN/` are generated from the deterministic Replay path by `npm run screenshots`. Both sets use a 1920 × 1080 (16:9) viewport so the navigation, application, Agent workspace, and Runtime retain their intended wide-screen proportions. The page scroll is reset before every capture.

The browser clock, UUID source, viewport, device scale, replay data, font readiness, focus state, GPU path, caret, and animations are controlled. Integer-aligned progress markers avoid subpixel circular-edge raster drift. Each language directory has its own SHA-256 manifest.

The article and README may use a smaller subset, but automated browser testing generates the complete visual narrative in both languages from system overview through final human governance.
