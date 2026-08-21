---
name: Orblitz enemy particle budgets
description: Particle-count separation between regular enemy visuals and boss visuals
---

Regular enemies and bosses reuse the same Mini*Orb components. Particle reductions must be passed as optional per-instance counts from standard enemy render paths; changing module-level defaults would also weaken bosses.

**Why:** Enemy count scales the cost of each attached particle system, while boss visuals are intentionally protected from reductions.

**How to apply:** Keep default mini-orb particle counts as the boss/projectile baseline and pass lower counts only from WorldXEnemyMesh components.