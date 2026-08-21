---
name: Orblitz gameplay mount boundary
description: Lifecycle rule for mounting heavy Orblitz gameplay GPU systems.
---

## Rule
Gameplay systems that allocate enemies, projectiles, particles, effects, physics maps, or gameplay loops are mounted only when the phase is `loading` or `playing`. They unmount for menus, mode selection, pauses, transitions, and end screens. Lightweight background visuals may remain mounted.

**Why:** Mounting heavy systems before gameplay unnecessarily allocates GPU buffers, Three.js objects, typed arrays, and frame callbacks during screens where they cannot contribute to gameplay.

**How to apply:** Keep the shared Canvas and lightweight background outside the gate. Place gameplay-only components inside the gated subtree so they mount during gameplay loading and remain alive through play. Preserve gameplay-specific backgrounds inside that subtree.