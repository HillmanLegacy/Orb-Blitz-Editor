---
name: Orblitz graphics presets
description: Contract for player-controlled graphics quality and gameplay-safe visual reductions.
---

Low, Standard, and High are explicit player choices, persisted between sessions. The selected preset is authoritative rather than being silently replaced by automatic adaptation.

**Why:** Players need predictable control over visual quality, while performance reductions must never alter weapon behavior, collisions, enemy simulation, rewards, or defensive mechanics.

**How to apply:** New presentation systems should consume the shared graphics preset or render-quality budget. Low may reduce resolution and optional decoration; gameplay-critical visuals and all simulation systems must remain functional.