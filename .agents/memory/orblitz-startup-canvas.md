---
name: Orblitz startup canvas
description: Startup boss previews must share the main Orblitz WebGL renderer.
---

The startup boss intro must render inside the existing GameScene Canvas rather than creating a nested R3F Canvas.

**Why:** The browser preview can reject an additional WebGL context, which causes the Vite runtime-error overlay even though the app's primary renderer is healthy.

**How to apply:** Pass startup visual phase into the existing scene and keep the startup DOM layer transparent during the 3D intro; use separate Canvas elements only for intentionally optional UI previews.