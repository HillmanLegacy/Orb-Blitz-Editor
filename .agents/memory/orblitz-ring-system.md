---
name: Orblitz Ring System
description: Architecture of the 10 new orbital ring cosmetics — where they live, how they animate, and the key pitfalls.
---

## Architecture

- **`OrbitalRings.tsx`** — new self-contained component; exports `<OrbitalRings style={RingStyle} scale={number} />`.
  - 10 named sub-components (`EclipseHorizon`, `SingularityEvent`, …, `AstralNebula`), each fully self-contained.
  - Module-level shared geometries (`_geo_xs`, `_geo_sm`, `_geo_tri`, `_geo_cone`) and shared vertexColors materials (`_mat_void`, `_mat_beam`, etc.) — **never dispose these**.
  - Per-component materials (e.g. `shardMat`, `solarMat`) are created with `useMemo` and disposed via `useEffect` cleanup.
  - `ZeroTesla` uses imperative `THREE.Line` objects added to its `groupRef` via `useEffect`; `useMemo` creates the arcs + shared `LineBasicMaterial`, cleanup removes them from the group and disposes.

- **`PlayerOrb.tsx`** — renders `<OrbitalRings style={equippedRing} scale={scale} />` inside the player group. The old `getRingConfig` / `ringRefs` / ring useFrame block were dead code (ringRefs was always `[]`) and have been removed.

- **`useShop.tsx`** — `RingStyle` now has 10 new values. Old values (`"double"`, `"triple"`, `"spiral"`, `"pulse"`, `"orbit"`, `"halo"`, `"shield"`, `"hex"`, `"prism"`) are migrated to `"none"` and legacy `ring_*` owned-item IDs are stripped from localStorage on first load.

## Ring Radius Convention

All rings use `r = scale * 2.0` as the base orbital radius (scale ≈ 0.72 at full health → r ≈ 1.44 world units). Geometry inner radii are expressed as fractions of `r`.

**Why:** Player orb radius is ~0.72 world units at full health; rings at 2× provide clear separation without obscuring the orb or enemies.

## Key Pitfalls

- `_dummy` and `_col` are shared module-level helpers for InstancedMesh updates — never allocate new `THREE.Object3D` / `THREE.Color` inside useFrame.
- `ZeroTesla` arc count (`_N_ARCS = 12`) × segments (`_N_SEGS = 10`) must stay low — each arc's position buffer is rewritten every frame.
- `SolarCorona` ShaderMaterial's `u_time` uniform is a shared object ref (`useRef({ value: 0 })`); setting `uTime.current.value = t` in useFrame propagates automatically.
- `AstralNebula` `starData` useMemo depends on `r` (and thus `scale`) — recalculates when player health changes scale. This is acceptable and intentional.
