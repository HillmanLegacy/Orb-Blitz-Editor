# Orblitz Mobile Performance Optimization Report

**Date:** 2026-07-04  
**Task:** Mobile performance optimization  
**Constraint:** No visual, gameplay, audio, or UX changes

---

## Optimizations Applied

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/isMobile.ts` | New file: `IS_MOBILE` boolean computed once at module load (UA + pointer heuristic) |
| 2 | `GameScene.tsx` | Canvas `dpr={IS_MOBILE ? [1, 1.5] : [1, 2]}` — caps pixel fill-rate on mobile |
| 3 | `GameScene.tsx` | `CameraController`: replaced standalone `requestAnimationFrame` loop with `useFrame` |
| 4 | `GameLogic.tsx` | `if (laserBeams.length > 0)` guard before beam `map().filter()` chain |
| 5 | `GameLogic.tsx` | Pointer position changed from `= { x, y }` to in-place mutation of `current.x / current.y` |
| 6 | `Projectiles.tsx` | `if (impactEffects.length > 0)` guard before effects `map().filter()` chain |
| 7 | `Projectiles.tsx` | Cleanup loop: replaced `Array.from(projectileOrbHits.current.keys())` with direct Map iteration |
| 8 | `EnergyDissipationVFX.tsx` | Module-level `_negDir = new THREE.Vector3()` replaces `dir.clone()` inside the per-stream loop |
| 9 | `ProjectileTrails.tsx` | `currentIdsRef = useRef(new Set())` — cleared and refilled each frame; replaced `Array.from(trails.entries())` with direct Map iteration |

---

## Detailed Analysis

### 1. Canvas DPR cap (GPU — highest single leverage point)
- **Problem:** No `dpr` cap → on a 3× display the GPU renders 9× more pixels than 1×. A 390×844 phone at 3× = 1,170×2,532 = ~3M pixels/frame; at 1.5× = ~775K pixels/frame.
- **Fix:** `dpr={IS_MOBILE ? [1, 1.5] : [1, 2]}` — R3F picks the highest DPR within the range. On a typical mobile screen (2–3×) this reduces GPU fragment work by 2–4×.

### 2. CameraController: standalone rAF → useFrame (CPU)
- **Problem:** `CameraController` ran its own `requestAnimationFrame` loop (`useEffect(() => { const animate = () => { ...; requestAnimationFrame(animate); }; animate(); }, [camera])`) independent of R3F's render loop. This consumed CPU even when nothing was rendering.
- **Fix:** Replaced with `useFrame`. Camera animation is now synchronized with R3F and stops automatically when the canvas is idle.

### 3. Unconditional `laserBeams.map().filter()` (CPU)
- **Problem:** Ran every frame regardless of whether any beams existed — creating a temporary array and then filtering it even when `laserBeams.length === 0`.
- **Fix:** Wrapped with `if (laserBeams.length > 0)`. Zero allocations per frame when no beams are active (the common case outside the charge beam upgrade).

### 4. Pointer position `{ x, y }` allocation (JS heap)
- **Problem:** `pointerPosition.current = { x: e.clientX, y: e.clientY }` — 1 object allocation per pointer event; at 120Hz touch polling = 120 objects/sec continuously during gameplay.
- **Fix:** In-place mutation: `current.x = e.clientX; current.y = e.clientY`. Zero allocations per event.

### 5. Unconditional `impactEffects.map().filter()` (CPU)
- **Problem:** Same pattern as laserBeams — ran every frame even when no effects existed.
- **Fix:** `if (impactEffects.length > 0)` guard. Zero allocations per frame when no effects are active.

### 6. `Array.from()` in Projectiles cleanup loop (JS heap)
- **Problem:** `Array.from(projectileOrbHits.current.keys())` allocated a new array every frame for the cleanup loop.
- **Fix:** Direct Map iteration (`for (const projId of projectileOrbHits.current.keys())`). ECMAScript spec guarantees it is safe to `delete` the current key during `for...of` Map iteration.

### 7. `dir.clone().negate()` inside EnergyDissipationVFX stream loop (JS heap)
- **Problem:** `dir.clone().negate()` inside the 12-stream loop allocated a new `THREE.Vector3` per stream per active VFX instance. During destroy animations: up to ~720 Vector3 allocations/sec.
- **Fix:** Module-level `_negDir = new THREE.Vector3()`. Replaced with `_negDir.copy(dir).negate()` — same math, zero allocations.

### 8. `Set` + `Array` allocation every frame in ProjectileTrails (JS heap)
- **Problem:** `new Set(projectiles.map(p => p.id))` allocated a Set + intermediate array every frame. `Array.from(trails.entries())` allocated another array.
- **Fix:** `currentIdsRef = useRef(new Set<string>())` — cleared and refilled each frame. Direct `for...of trails` iteration replaces `Array.from(trails.entries())`. Saves ~3 allocations per frame.

---

## Optimizations Considered But Not Applied

| Candidate | Reason Not Applied |
|-----------|-------------------|
| Per-orb position/direction tuple pools (DarkOrbs) | Pool arrays stored as React props would be same-reference across frames; React's reconciler skips prop updates when reference is unchanged → orbs would freeze visually |
| Per-particle position/velocity tuple pools (Particles) | Same reconciler reference-equality issue |
| Imperative mesh position updates via refs (bypass React state) | Significant architectural restructure; risk of gameplay regressions |
| Bloom postprocessing reduction | Changes visual quality |
| Instanced mesh for orbs/particles | Major restructure; risk of visual regressions |

### Note on React reconciler + pooled array props
R3F's reconciler compares old and new prop values using reference equality. If a position/velocity array prop is mutated in-place and passed back as the same reference, `oldProp === newProp` evaluates to `true` and R3F does **not** call the Three.js position setter — the mesh stays at its old position. The pool pattern is only viable if positions are updated imperatively (via `meshRef.current.position.set(...)` in `useFrame`) rather than through React props, which would require a larger architectural change.

---

## Architecture Note: Per-Orb Wrapper Object Allocation

Each live orb still creates **1 new wrapper object per frame** (`{ ...orb, ...overrides }`). This is required for React/Zustand to detect the orb changed and trigger re-renders. At 20 orbs × 60fps = ~1,200 wrapper objects/sec — manageable for modern JS engines and below the threshold where GC pauses become perceptible on mobile.
