---
name: Orblitz viewport-safe overlays
description: Full-screen result and menu overlays need viewport-bounded content columns.
---

Full-screen Orblitz overlays should use `100dvh`-based bounds, responsive vertical spacing, and an internal scroll fallback; centered `overflow-hidden` stacks are unsafe on short landscape screens.

**Why:** Result screens combine variable progression content, grades, leaderboards, and controls, so fixed centered stacks can clip at both the top and bottom.

**How to apply:** Keep decorative layers fixed and non-scrolling, while the content card or column owns `maxHeight` and `overflowY: auto`; compact dense summaries before reducing essential information.

Wide browser windows can still be short enough to overflow center-positioned command decks, so desktop rules must cap the deck against `100dvh` and scale both button rows together.

**Why:** Width-based responsive breakpoints do not catch split-screen or short-height desktop windows, where the primary menu button can push the lower action row below the browser edge.

**How to apply:** For wide short viewports, anchor the command deck from a bottom-safe `100dvh` position and reduce primary and secondary button heights as one layout unit.

For the embedded main-menu Settings deck, changing only the parent's `max-height` or `bottom` reserve does not visibly reposition the controls; the inline top anchor must move and the deck must be compacted as a unit.

**Why:** The absolute command layer stretches between its top and bottom bounds while the visible options deck remains flow-positioned at the layer's top edge, so boundary-only changes can leave the deck visually unchanged.

**How to apply:** Adjust the Settings command-layer top and bottom together, then use scoped desktop-height overrides for the options deck and its control rows when the available height is tight.