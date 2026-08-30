---
name: Orblitz Rapid Blaster overheat
description: Input listeners must read Rapid Blaster lock state from the live store.
---

Long-lived pointer and keyboard firing listeners must resolve Rapid Blaster overheat from current runtime state at projectile admission, not from a render-captured boolean.

**Why:** The firing listener can outlive the render that created it, so a closure over the initial non-overheated state lets the weapon fire through its cooldown penalty.

**How to apply:** Keep the overheat lock in the authoritative projectile-admission path and anchor warning VFX to the HUD heat meter rather than the player model.