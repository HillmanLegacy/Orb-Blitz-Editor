---
name: Orblitz Diamond texture legibility
description: World 6.9 Diamond boss uses a pale authored map that needs restrained presentation effects.
---

The Diamond boss's authored base map is intentionally pale and facet-rich. Keep its texture multiplier slightly blue-gray and its additive shimmer low enough to preserve facet contrast; a white multiplier plus strong additive alpha clips the artwork toward solid white.

**Why:** The GLB map is valid, but its light base values leave little headroom for additive overlays. Full-bright rendering can therefore erase the color and facet detail even when the texture is loaded correctly.

**How to apply:** Treat Diamond's tint and shimmer as a deliberate exception within the shared unlit texture system. Preserve the map; reduce overlay energy before changing asset loading or reintroducing uncontrolled scene lighting.