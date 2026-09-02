---
name: Orblitz presentation spin
description: Shared clockwise visual roll for player, boss, and standard enemy presentation groups.
---

The player, boss, boss-projectile, and standard-enemy presentation groups share one continuous negative-Z roll using `PLAYER_MODEL_ROTATION_SPEED` and a clamped frame delta. Keep this rotation on visual groups only; never rotate gameplay anchors or collision state.

**Why:** Consistent authored-texture motion makes player, bosses, and enemies feel like one visual system, while isolating the roll preserves gameplay transforms and prevents frame spikes from causing visible jumps.

**How to apply:** Reuse the shared presentation-spin helper for new orb visual groups. Preserve each renderer's existing position, scale, effect animation, and local shape rotation.