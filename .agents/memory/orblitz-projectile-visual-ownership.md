---
name: Orblitz projectile visual ownership
description: Stable visual ownership rules for projectile render batches and trails.
---

## Rule
Projectile visuals and cosmetic trails must keep a stable runtime identity for
their whole visible lifetime. Drive transforms from the authoritative live
runtime, and assign GPU instance ranges by that identity rather than by the
current order of store records.

**Why:** Structural projectile arrays change whenever a shot is spawned or
removed. Reusing a compacted render index can make an existing trail or visual
briefly display another projectile's transform, appearing as flicker or a
teleport.

**How to apply:** Simulation may publish structural additions and removals, but
high-frequency render passes should read live transforms. Clear an identity's
GPU range only when it is released, and preserve a short position history when
a continuous trail is needed.