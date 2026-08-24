---
name: Orblitz runtime collision transforms
description: Ensuring collision systems stay aligned with imperative runtime transforms.
---

**Rule:** Systems that move a gameplay object in an imperative runtime must expose that object’s live transform to every collision and area-effect query. Store coordinates are structural spawn fallbacks, not authoritative moving positions.

**Why:** Rendering can correctly show a runtime-moved object while collision code still reads an unchanged store snapshot, producing invisible misses and hits at old coordinates.

**How to apply:** Before moving any active entity type out of per-frame Zustand updates, audit normal, swept, area-of-effect, and target-selection collision paths. Centralize the store-fallback lookup on the runtime and cover it with a regression test.