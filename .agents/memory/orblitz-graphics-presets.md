---
name: Orblitz graphics presets
description: Contract for player-controlled graphics quality and gameplay-safe visual reductions.
---

Low, Standard, and High are explicit player choices, persisted between sessions. The selected preset is authoritative rather than being silently replaced by automatic adaptation.

All three presets keep the complete presentation stack active. They differ through centralized live budgets for pixel ratio, postprocessing passes, particle density, trail density, background effects, dynamic lights, and non-gameplay frame scheduling.

**Why:** Players need predictable control over visual quality, while performance reductions must never alter weapon behavior, collisions, enemy simulation, rewards, or defensive mechanics.

**How to apply:** New presentation systems should consume the centralized preset profile or render-quality budget. Never make Standard and High aliases, and never use a quality reduction to disable gameplay-critical feedback or simulation.