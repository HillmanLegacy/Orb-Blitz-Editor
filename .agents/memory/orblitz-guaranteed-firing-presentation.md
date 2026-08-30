---
name: Orblitz guaranteed firing presentation
description: Presentation required for every admitted shot needs bounded but non-dropping admission semantics.
---

When a firing effect is required for every successfully admitted projectile, route it through a dedicated bounded presentation admission path and clear both pending events and visual pools on runtime reset.

**Why:** Optional spawn-event queues may drop on overflow, which silently violates every-shot presentation guarantees. Component-local pools can also leak stale particles into a new run if only simulation state resets.

**How to apply:** Keep rendering allocation-bounded, replace the oldest pending presentation event only under pathological backlog, and tie queue and pool lifecycle to the gameplay runtime session.