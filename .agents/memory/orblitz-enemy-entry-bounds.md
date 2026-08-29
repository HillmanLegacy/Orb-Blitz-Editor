---
name: Orblitz enemy entry bounds
description: Camera-relative spawn and cleanup rules for regular enemies, with boss attack exemptions.
---

Regular enemies must spawn beyond a live perspective-camera edge and use a larger camera-relative cleanup envelope. Boss attack orbs remain on their authored boss spawn paths and fixed world cleanup bounds.

**Why:** Fixed-radius world spawns can appear inside the view at some camera positions, zoom levels, and aspect ratios. Camera-relative spawns paired with absolute cleanup bounds can also be deleted before entering. Applying camera-relative cleanup to boss attacks changes their lifetime.

**How to apply:** Derive the visible rectangle at the enemy plane from live camera position, FOV, depth, and aspect. Spawn regular enemies beyond an edge, retain them with camera-relative margins, and explicitly exempt boss attack orbs.