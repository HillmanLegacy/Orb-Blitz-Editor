---
name: Orblitz weapon input guard
description: Input handling distinction between selected weapon action and actual shop equipment.
---

## Rule
Never use `selectedWeapon` alone to decide whether firing is allowed. It defaults to `normal` even when the user has no weapon equipped. Input handling must check the actual shop `equippedWeapon` first.

**Why:** Without the equipment guard, a click with no weapon falls through to the normal projectile branch, causing a Zustand write, React projectile reconciliation, mesh creation, and audio per click. Rapid clicks create severe input lag.

**How to apply:** Put the `equippedWeapon === "none"` early return before raycasting and before the held-pointer fire loop. Keep the check in a ref so the event handler does not need to resubscribe.