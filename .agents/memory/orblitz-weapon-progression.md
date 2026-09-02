---
name: Orblitz weapon progression
description: Durable rules for weapon levels, XP awards, and combat tuning.
---

Weapon progression should have one pure configuration source for every level and every weapon’s XP pacing. XP is level-relative like Pokémon: the visible bar measures only the current level, subtracts a completed target on level-up, and carries overflow into the next level.

**Why:** Equipment and progression can change outside the render loop, and reading mutable store state during a projectile’s lifetime can retune or visually reassign an already-fired shot. A cumulative bar also synchronized every weapon’s milestones and made a single completion feel like an automatic level-up.

**How to apply:** Keep weapon-specific level targets and completion awards centralized; award only from authoritative level/run result boundaries; guard each boundary against duplicate payout; migrate old cumulative saves proportionally; cap progression explicitly at Lv3; and animate both ordinary XP gain and level-up transitions from the same result payload.