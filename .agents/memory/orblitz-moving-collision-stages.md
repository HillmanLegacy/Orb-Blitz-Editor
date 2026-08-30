---
name: Orblitz moving collision stages
description: Collision rules for objects whose runtime movement is committed in a later simulation stage.
---

When one moving body is simulated before another, collision must use the earlier body's current-frame segment and a predicted segment for the later body that exactly matches the later runtime tick. Overcharged direct enemy contact and timed AOE are separate, intentional damage paths; power-up damage remains AOE-only.

**Why:** Orblitz projectiles run before power-ups. Treating power-ups as stationary can tunnel during opposing motion. Overcharged shots are designed to pierce and destroy enemies on contact while also detonating later, but direct power-up hits would bypass the intended outward-climax timing.

**How to apply:** Expose a non-mutating collision-segment prediction from the later runtime and keep it mathematically identical to its tick movement. Let Overcharged contact handle enemies/bosses with per-target dedupe and continued flight; route Overcharged power-up damage only through its outward-climax AOE.