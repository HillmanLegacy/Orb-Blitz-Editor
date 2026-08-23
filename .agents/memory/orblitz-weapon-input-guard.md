---
name: Orblitz weapon input guard
description: Input handling distinction between selected weapon action and actual shop equipment.
---

## Rule
`selectedWeapon` defaults to `normal` intentionally. A player with no shop weapon equipped must still be able to fire the default projectile. Do not block input solely because `equippedWeapon` is `"none"`.

**Why:** The default projectile is the baseline weapon. The earlier equipment guard incorrectly disabled all firing for new players.

**How to apply:** Keep the input path's performance optimizations independent of weapon ownership. Fix projectile/streak performance in the motion registry and structural-update boundary, not by disabling default firing.