---
name: Orblitz DarkOrbs imperative refactor
description: Architecture for separating React structural concerns from Three.js per-frame animation in DarkOrbs — the orbPhysicsMap pattern.
---

## Rule
DarkOrbs must never call `updateDarkOrbs` for position-only changes. Position/direction/speed/age live in the module-level `orbPhysicsMap`; Zustand only carries structural state (frozen, hurtTimer, destroying, destroyTimer, spawn/despawn).

**Why:** updateDarkOrbs every frame → Zustand fires → DarkOrbs re-renders → all N orb components reconcile. With 20-50 orbs this dominated frame time. The `time` prop pattern additionally defeated `memo` on every child.

**How to apply:**
- `orbPhysicsMap: Map<string, { position, direction, speed, age }>` is module-level, never triggers React.
- `DarkOrbs.useFrame` reads/writes `orbPhysicsMap` for physics. Calls `updateDarkOrbs` only when `structuralChanged` (frozen toggle, hurtTimer delta, destroying start/end, orb addition/removal). Pushes same object reference for unchanged orbs so memo fast-paths.
- Every mesh component (`BossOrbMesh`, `World1-9EnemyMesh`, `UnifiedDarkOrbMesh`) has a `groupRef` + `useFrame` that reads `orbPhysicsMap.get(orb.id)` and calls `position.set` / `scale.setScalar` imperatively — no `time` prop.
- `UnifiedDarkOrbMesh` has feature-specific ref arrays (`featureRefs`, `flameMat0Refs`, `eyeGroupRefs`, `eyePupilRefs`, `eyeHighRefs`) updated in a single `useFrame` for all inner animations (horns, teeth, tentacles, spines, ears, flames, eye blink, pupil look).
- Frozen overlay in `OrbRouter` uses `overlayRef` + `useFrame` to follow physics position imperatively. Initial position snapshotted in the Zustand orb at the structural-change moment.
- `orbMemoEqual` comparator checks: `arcadeLevel`, `gameMode`, `orb === orb` (reference fast-path), then `id`, `frozen`, `destroying`, `destroyTimer`, `hurtTimer`. Skips all position/speed/age fields.
- `DarkOrbsClock` component (priority -1 `useFrame`) updates module-level `_clockTime` before the main physics loop (priority 0). Pattern switch cases read `_clockTime` instead of calling `state.clock.getElapsedTime()` per-orb.
- `destroyTimer` DOES stay in Zustand (decrements each frame while destroying) — VFX progress depends on it. Acceptable since only 1-3 destroying orbs at a time.
- `useEffect` cleanup in `DarkOrbs` calls `orbPhysicsMap.clear()` on unmount to prevent stale state on game restart.
- `speedChanged` must be compared BEFORE writing `phy.speed = currentSpeed`, otherwise always false.
