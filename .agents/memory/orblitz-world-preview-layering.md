---
name: Orblitz world preview layering
description: Shared WebGL boss previews in the world carousel must stay in front of and aligned with the responsive DOM cards.
---

World-select boss previews belong to the existing shared WebGL canvas, rendered as a transparent pointer-through foreground above the carousel. Position each actor from the live transformed card bounds rather than fixed screen offsets.

**Why:** The carousel is responsive and animated, while a later opaque selection overlay can hide canvas content or hardcoded 3D offsets can drift away from the cards. Keeping the canvas transparent and pointer-through preserves both visual layering and DOM interaction.

**How to apply:** Limit the foreground canvas mode to world select, disable background/postprocessing layers that would cover the UI, and convert each card's screen-space center to the actor's depth-corrected 3D coordinate on every render tick or equivalent responsive update.

**World-select reveal:** Pre-mount the boss roster during the blackout, but start its opacity/scale clock when the selection screen begins its fade-in.

**Why:** Starting the roster clock on navigation begins the animation behind the blackout; the menu can then appear after the orbs are already partway through loading or finish before them.

**How to apply:** Carry a separate world-preview-visible signal through the shared scene boundary. Keep actors at zero reveal while it is false, then use the same short reveal window as the DOM selection screen once it becomes true.

**Portal constraint:** The selection portal must render into `.orblitz-app-shell`, not merely resolve that element as a ref. A body-level portal creates a separate stacking context that can paint the dark selection surface over the foreground canvas.

**Why:** The shared canvas is also inside the app shell's brightness/filter stacking context; matching the portal's actual mount point is required for the canvas z-index to win.