---
name: Orblitz title refraction
description: Title glass lighting must stay synchronized with the moving title-screen bosses.
---

The title’s kaleidoscopic glass should be driven by the same normalized boss motion used by the WebGL title-screen actors. Update per-letter CSS refraction variables imperatively at animation-frame rate, using distance falloff plus depth/scale falloff; avoid adding duplicate DOM aura objects because they read as colored glass overlays rather than light interacting with the title.

**Why:** The desired visual is boss light changing an otherwise clear glass title as each orb passes from letter to letter, not a permanent rainbow fill or a second set of colored auras.

**How to apply:** When changing title-screen boss motion or title material, keep the shared normalized trajectory as the source of truth and preserve the distance/depth response inside the letter masks.