---
name: Orblitz weapon progression
description: Durable rules for weapon levels, XP awards, and combat tuning.
---

Weapon progression should have one pure configuration source for every level. Live projectiles must capture level-dependent combat values when admitted, while HUD and inventory read the same source for presentation.

**Why:** Equipment and progression can change outside the render loop, and reading mutable store state during a projectile’s lifetime can retune or visually reassign an already-fired shot.

**How to apply:** Award XP only from authoritative level/run result boundaries, guard each boundary against duplicate payout, cap progression explicitly at Lv3, and add regression coverage whenever a qualitative upgrade is converted into numeric balance.