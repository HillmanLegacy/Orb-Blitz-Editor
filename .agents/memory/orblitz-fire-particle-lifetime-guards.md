---
name: Orblitz fire particle lifetime guards
description: Prevent seeded fire-particle ages from producing invalid palette indices or crashing the render loop.
---

Normalize particle age to the inclusive 0–1 range before using it for palette interpolation, fade, scale, or any array index.

**Why:** Fire particles are intentionally seeded at random ages so the aura is populated immediately. A seeded age can be older than its randomly chosen lifetime, which otherwise creates negative or out-of-range palette indices and stops the VFX loop.

**How to apply:** Clamp lifetime ratios at every presentation boundary, including initial buffer seeding and per-frame updates, not only when respawning expired particles.