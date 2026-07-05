---
name: Orblitz background particle system
description: Architecture of the Background.tsx particle system — three particle types, HD instanced orbs, explosion impulse API, and shader conventions.
---

## Three particle types
- **NebulaDust** (4000): tiny blue-white spheres, spring-back to fixed rest pos, orb+explosion interaction.
- **IonicStreams** (1496): 8 sinusoidal bands, particles flow along wavy path via `_sT` parameter, 8 neon colors via instanceColor.
- **CosmicSparks** (400): large bright multi-color, free-floating with heavy drag, strong explosion blast radius (30 units).

## HD InstancedMesh orbs
- Main orb: `ShaderMaterial` with Fresnel rim (`pow(1-ndv, 2.5)`), 2-octave 3D noise shimmer, pulse. `uTime` uniform updated each frame.
- Corona orb: second `InstancedMesh` at 1.72× scale, rim-only shader (FrontSide, no uTime). **Do NOT set `side: BackSide`** — that inverts normals and kills the rim glow.
- `instanceColor` and `instanceMatrix` are injected into ShaderMaterial vertex prefix by Three.js — do NOT re-declare them.
- Colors set via `setColorAt` in `useEffect`; this runs before the first Three.js rAF frame so shader compiles with `USE_INSTANCING_COLOR` defined.

## Explosion impulse API
- `addExplosionImpulse(x, y, strength)` exported from Background.tsx — true overwrite-oldest ring buffer (`_impHead`, `_impTail`, `_impSize`).
- Called from DarkOrbs.tsx when `destroyTimer <= 0` (with `orb.position` guard).
- Impulses cleared at end of ParticleSystem's single unified `useFrame` (priority 0) after all three types have consumed them.

## Frame ordering
- `ShootingOrbs` runs at `useFrame` priority **-1** → writes `_orbPosX/_orbPosY/_orbVelX/_orbVelY`.
- `ParticleSystem` runs at priority **0** → reads those buffers, builds spatial grid, processes all particle types, clears impulse ring.

## Performance
- All particle state in module-level `Float32Array` buffers — zero allocation per frame.
- Spatial grid (cell=5, 25×19 cells) reduces orb-particle checks from O(N×M) to ~3 cells × 4 orbs/cell per particle.
- Inner force loops use primitive `let ax=0; let ay=0` accumulators — no tuple/array returns (zero GC pressure).
- `_dummy` Object3D reused for all `setMatrixAt` calls.

**Why:**
Vite Fast Refresh shows "addExplosionImpulse export is incompatible" warning when Background.tsx hot-reloads — this is expected (non-component export mixed with component exports) and causes a full page reload, not an error.
