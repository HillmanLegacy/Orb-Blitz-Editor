---
name: Orblitz gameplay mount boundary
description: Lifecycle rule for mounting heavy Orblitz gameplay GPU systems.
---

## Rule
Gameplay systems that allocate enemies, projectiles, particles, effects, physics maps, or gameplay loops are mounted only when the phase is `loading` or `playing`. They unmount for menus, mode selection, pauses, transitions, and end screens. Lightweight background visuals may remain mounted.

**Why:** Mounting heavy systems before gameplay unnecessarily allocates GPU buffers, Three.js objects, typed arrays, and frame callbacks during screens where they cannot contribute to gameplay.

**How to apply:** Keep the shared Canvas and lightweight background outside the gate. Place gameplay-only components inside the gated subtree so they mount during gameplay loading and remain alive through play. Preserve gameplay-specific backgrounds inside that subtree. The gate's blue placeholder is only for loading the gameplay JavaScript chunk; never wrap the mounted scene in that fallback. GLTF consumers need local Suspense boundaries around visual branches so late model loading cannot hide or pause unrelated gameplay systems.

## Loading readiness
Gameplay reveal waits on the selected section's critical assets through the same loader cache consumed by its GLTF components, plus a bounded renderer warmup. The branded sweep may hold opaque beyond its normal duration, but must always have a maximum wait and safe local visual fallbacks.

**Why:** Measuring only network fetches can report readiness while GLTF parsing still suspends the scene, and fixed-duration transitions expose first-frame decode or shader stalls on slower devices.

**How to apply:** Count completion from awaitable cache work, evict timed-out entries so future attempts are fresh, keep progress honest, and warm likely next-section assets only after gameplay becomes responsive.

## Gameplay reveal curtain
After a loading transition completes, keep a topmost opaque black curtain for at least one painted frame, then fade that curtain out over two seconds. Do not use the loading sweep canvas alone as the reveal barrier.

**Why:** The gameplay Canvas can mount or change phase in the same React commit as the transition completion; relying on the sweep's final frame lets the new background clip through the menu.

**How to apply:** Keep the curtain above both the sweep and gameplay layers, trigger it only for entering/next-level gameplay (not return-to-menu transitions), and cancel stale reveal timers when another transition begins.