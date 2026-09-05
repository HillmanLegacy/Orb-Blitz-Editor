---
name: Three.js async compile readiness
description: Compatibility constraint for Orblitz shader warmup with Three.js r170.
---

Three.js r170's `WebGLRenderer.compileAsync()` can poll a material whose `currentProgram` has not been created yet, causing an uncaught `undefined.isReady` error during its internal material set loop.

**Why:** The runtime-error plugin reports the browser exception, but it is not the source of the failure; the async compile polling path is unsafe for this scene's mixed warmup materials.

**How to apply:** Use `WebGLRenderer.compile(scene, camera)` for Orblitz warmup. If async compilation is reconsidered after a Three.js upgrade, verify that every collected material has a current program before calling `isReady()`.