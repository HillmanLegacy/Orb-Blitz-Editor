---
name: Orblitz World1FireBackground
description: Architecture and key patterns for the World 1 fire backdrop VFX system.
---

## Activation condition
`gameMode === "arcade" && Math.floor(arcadeLevel) === 1`
Mounts/unmounts cleanly when world changes; dispose runs in useEffect cleanup.

## Module-level public API
`setWorldFireIntensity(0.1..2.0)` and `magmaSurge()` are module-level functions.
Surge uses a `_surgeRequested` boolean flag stamped to clock time inside `useFrame` — you cannot get elapsed time outside useFrame.

## GPU-particle pattern (InstancedBufferGeometry)
Pre-allocate `Float32Array` buffers at module load. Build geometry once in `useMemo`:
```
const base = new THREE.PlaneGeometry(1, 1);
const geo  = new THREE.InstancedBufferGeometry();
geo.index  = base.index;
geo.setAttribute('position', base.getAttribute('position'));
geo.setAttribute('uv',       base.getAttribute('uv'));
geo.setAttribute('aOrigin',  new THREE.InstancedBufferAttribute(buffer, 3));
geo.instanceCount = N;
base.dispose();
```
Render with `<mesh geometry={geo} material={mat} frustumCulled={false} />`.
All physics loop in vertex shader from seeds + uTime — zero CPU writes per frame.

## Billboard trick in vertex shader
```glsl
vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
vec3 wPos  = pos + right * (position.x * sz) + up * (position.y * sz);
```
Pass quad UV as `out vec2 vQuadUv = uv` for the soft-circle alpha in fragment shader.

## Coordinator pattern
Single `World1FireScene` component holds all useMemo/useRef hooks plus ONE useFrame
that updates all uniforms and light intensities imperatively. Sub-meshes receive
material via props not via Zustand — zero extra subscriptions.

## Color palette (Level 1.9 Boss)
- `#120300` Obsidian Charcoal (N·V < 0.20)
- `#8B0000` Deep Molten Red   (N·V 0.20–0.50)
- `#FF2200` Magma Orange-Red  (N·V 0.50–0.75)
- `#FF8800` Solar Flame       (N·V 0.75–0.90)
- `#FFF5CC` Plasma White      (N·V > 0.90)

**Why:** Using both fBm noise value and displaced N·V together (heat = noise*0.62 + ndv*0.58)
means ridge crests glow white-hot while valleys stay obsidian — the lava crack look.
