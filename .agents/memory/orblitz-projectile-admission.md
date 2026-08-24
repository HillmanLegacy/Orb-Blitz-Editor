---
name: Orblitz projectile admission
description: Capacity and event rules that preserve weapon behavior under projectile-pool saturation.
---

## Rule
The projectile store, runtime, and instanced renderer share one fixed capacity. Weapon code must preflight the full requested volley before creating any projectile, and must advance cooldowns, recoil, audio, and presentation only after admission succeeds. Spawn visuals consume a bounded queue of successful spawn snapshots rather than inferring new shots from a later structural state.

**Why:** A partial scatter volley or a rejected shot with recoil/audio feels broken under high load. Short-lived projectiles can also collide before React observes the structural array, which previously made some spawn effects disappear.

**How to apply:** When adding a multi-shot weapon or autonomous firing source, ask for its complete capacity up front, avoid consuming its retry window on rejection, and enqueue its presentation event only after the structural projectile is accepted.