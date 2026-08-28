---
name: Orblitz power-up scheduling
description: Durable lifecycle and boundary rules for random power-up spawning.
---

Power-up spawn cooldown state belongs to the persistent gameplay runtime, not a component that unmounts during pause. It advances only during active, non-dying gameplay and resets when the run runtime is reset.

**Why:** Gameplay components unmount while paused, so component-owned cooldowns lose elapsed progress. Power-ups were also being created outside the runtime despawn envelope and removed on their first simulation tick.

**How to apply:** Keep randomized spawn timing in the persistent runtime, preserve it across pause/resume, reset it only with the run lifecycle, and ensure authored entry coordinates begin inside the runtime removal bounds.