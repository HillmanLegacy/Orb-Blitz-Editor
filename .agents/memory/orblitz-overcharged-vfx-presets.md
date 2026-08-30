---
name: Orblitz overcharged VFX presets
description: Preset behavior required for the Overcharged Blaster detonation presentation.
---

The Overcharged Blaster detonation and its existing shockwave must remain visible on every graphics preset. Low should use its reduced particle profile rather than disabling the presentation through the global VFX feature switch.

**Why:** Gating the pooled renderer with the global VFX switch made the entire detonation effect disappear for users with a persisted Low preset, despite the renderer already defining a bounded Low particle budget.

**How to apply:** Keep detonation gameplay independent from presentation, always admit the bounded Overcharged presentation event, and use graphics profiles only to scale its particle counts and GPU work.

Presentation admission must also occur before any collision-feature early return. Collision profiling may skip gameplay hit work, but it must not prevent the timed visual event from reaching the pool.

Pooled R3F effects that hide inactive instances with zero-scale matrices must not also declare a parent `visible={false}` and imperatively toggle it in `useFrame`. React reconciliation can restore the false prop when the detonation removes its projectile, hiding the entire pool.

The guaranteed detonation core uses ordinary persistent meshes, while optional particles use bounded `Points` buffers. Pool generations remain monotonic across resets so immediate reset/re-emission cannot reuse a mounted view's cached generation.