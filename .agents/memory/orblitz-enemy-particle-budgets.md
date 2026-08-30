---
name: Orblitz enemy particle budgets
description: Particle-count separation between regular enemy visuals and boss visuals
---

Regular enemies and bosses reuse the same Mini*Orb components. Particle reductions must be passed as optional per-instance counts from standard enemy render paths; changing module-level defaults would also weaken bosses.

Standard-enemy defeat enhancements must be gated from boss-orb slots. Faceted cores, volumetric shock rings, or other generic breakup layers belong to regular enemies; authored boss defeats stay visually independent.

**Why:** Enemy count scales the cost of each attached particle system, while boss visuals are intentionally protected from reductions.

**How to apply:** Keep default mini-orb particle counts as the boss/projectile baseline, pass lower counts only from WorldXEnemyMesh components, and classify pooled defeat slots before adding generic 3D layers.