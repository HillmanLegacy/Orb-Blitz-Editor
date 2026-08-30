---
name: Orblitz moving collision stages
description: Collision rules for objects whose runtime movement is committed in a later simulation stage.
---

When one moving body is simulated before another, collision must use the earlier body's current-frame segment and a predicted segment for the later body that exactly matches the later runtime tick. Timed AOE weapons must not also use direct-contact damage paths.

**Why:** Orblitz projectiles run before power-ups. Treating power-ups as stationary can tunnel during opposing motion, while allowing Overcharged direct hits before its climax applies damage early or twice.

**How to apply:** Expose a non-mutating collision-segment prediction from the later runtime and keep it mathematically identical to its tick movement. Route Overcharged enemy, boss, and power-up damage only through its outward-climax AOE.