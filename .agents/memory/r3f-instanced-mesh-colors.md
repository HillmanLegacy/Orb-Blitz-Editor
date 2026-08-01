---
name: R3F InstancedMesh per-instance colors
description: Why vertexColors on module-level materials silently fails for InstancedMesh, and the working pattern.
---

# R3F InstancedMesh per-instance colors

## The rule
Never use `vertexColors: true` on a **module-level** `MeshBasicMaterial` for an `InstancedMesh`. The shader is compiled on first draw; if `instanceColor` doesn't exist yet on the mesh at that moment, `USE_INSTANCING_COLOR` is omitted and colors never show — silently, with no errors.

## Why
Three.js compiles the WebGL program once and caches it. `instanceColor` is a `BufferAttribute` created lazily by `setColorAt`. If `setColorAt` hasn't been called before the first draw, `instanceColor` is null, the shader compiles without the define, and subsequent `setColorAt` calls are ignored even after `instanceColor.needsUpdate = true`.

## Working pattern (matches HealAura, DistortField)
1. Create materials with `useState(() => new THREE.MeshBasicMaterial({ ... }))` — one per instanced mesh, no `vertexColors`.
2. Pass the material directly in `args={[geo, mat, count]}`.
3. Control per-instance brightness via **scale** (`_dummy.scale.setScalar(flickerValue)`), not per-instance color.
4. Set material `opacity` or `color` for the overall tint.

## What does NOT work
- `args={[geo, undefined, count]}` with `<meshBasicMaterial>` child — Three.js may not accept undefined material.
- `vertexColors: true` on a module-level material — shader compiled before `instanceColor` exists.
- Pre-initializing `instanceColor` in `useEffect` — runs after first draw in some R3F frame ordering scenarios.

## How to apply
Any time you need an `InstancedMesh` in this codebase, use the useState + no-vertexColors pattern. If you genuinely need per-instance color variation, pre-initialize `instanceColor` synchronously before the mesh's first render (e.g. in a `useLayoutEffect` or by seeding colors in the constructor).
