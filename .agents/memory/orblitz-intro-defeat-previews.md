---
name: Orblitz intro defeat previews
description: The startup reveal reuses authored defeat VFX through a presentational preview path.
---

Startup-only orb entrances should feed stable presentational DarkOrb inputs into the shared EnemyDefeatVFX component rather than synthesizing gameplay events or mutating the gameplay store.

**Why:** The intro must match gameplay defeat colors, particle profiles, and reverse timing while remaining outside rewards, collisions, and gameplay lifecycle state.

**How to apply:** Keep preview positions and identities stable, advance only the preview timeline, and mount the path only for the staged startup reveal.