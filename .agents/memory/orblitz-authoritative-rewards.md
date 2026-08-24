---
name: Orblitz authoritative rewards
description: Rewards are granted by the gameplay event and visual star flow is presentation only.
---

All coin rewards represented by star-flow events must be committed exactly once when the gameplay event is created. The rendered star sequence may be delayed, skipped, pooled out, quality-disabled, or unmounted without changing the payout.

**Why:** Rendering availability is not authoritative gameplay state; tying earnings to particle absorption made rewards dependent on VFX capacity and lifecycle.

**How to apply:** New reward bursts should use the authoritative event path and must not award currency from R3F frame callbacks or particle-arrival logic.