---
name: Orblitz overcharged VFX presets
description: Preset behavior required for the Overcharged Blaster detonation presentation.
---

The Overcharged Blaster detonation and its existing shockwave must remain visible on every graphics preset. Low should use its reduced particle profile rather than disabling the presentation through the global VFX feature switch.

**Why:** Gating the pooled renderer with the global VFX switch made the entire detonation effect disappear for users with a persisted Low preset, despite the renderer already defining a bounded Low particle budget.

**How to apply:** Keep detonation gameplay independent from presentation, always admit the bounded Overcharged presentation event, and use graphics profiles only to scale its particle counts and GPU work.

Presentation admission must also occur before any collision-feature early return. Collision profiling may skip gameplay hit work, but it must not prevent the timed visual event from reaching the pool.

Pooled R3F effects that hide inactive instances with zero-scale matrices must not also declare a parent `visible={false}` and imperatively toggle it in `useFrame`. React reconciliation can restore the false prop when the detonation removes its projectile, hiding the entire pool.

The guaranteed detonation core and all optional particle layers use persistent pooled meshes. Build motes, plasma, sparks, and shards are bounded instanced 3D geometry rather than point sprites. Pool generations remain monotonic across resets so immediate reset/re-emission cannot reuse a mounted view's cached generation.

Each detonation event must capture the equipped player-skin palette when admitted to the pool; pooled slot materials derive all core, halo, ring, and debris colors from that captured palette rather than global hard-coded colors.

The pre-flash phase is a continuity handoff from the departing projectile: begin near projectile volume, spiral particles inward to a compressed seed, then expand the climax from that exact terminal scale to avoid a visual pop.