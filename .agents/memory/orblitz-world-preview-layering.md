---
name: Orblitz world preview layering
description: Shared WebGL boss previews in the world carousel must stay in front of and aligned with the responsive DOM cards.
---

World-select boss previews belong to the existing shared WebGL canvas, rendered as a transparent pointer-through foreground above the carousel. Position each actor from the live transformed card bounds rather than fixed screen offsets.

**Why:** The carousel is responsive and animated, while a later opaque selection overlay can hide canvas content or hardcoded 3D offsets can drift away from the cards. Keeping the canvas transparent and pointer-through preserves both visual layering and DOM interaction.

**How to apply:** Limit the foreground canvas mode to world select, disable background/postprocessing layers that would cover the UI, and convert each card's screen-space center to the actor's depth-corrected 3D coordinate on every render tick or equivalent responsive update.