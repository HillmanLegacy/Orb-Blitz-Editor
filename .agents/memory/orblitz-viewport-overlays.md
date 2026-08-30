---
name: Orblitz viewport-safe overlays
description: Full-screen result and menu overlays need viewport-bounded content columns.
---

Full-screen Orblitz overlays should use `100dvh`-based bounds, responsive vertical spacing, and an internal scroll fallback; centered `overflow-hidden` stacks are unsafe on short landscape screens.

**Why:** Result screens combine variable progression content, grades, leaderboards, and controls, so fixed centered stacks can clip at both the top and bottom.

**How to apply:** Keep decorative layers fixed and non-scrolling, while the content card or column owns `maxHeight` and `overflowY: auto`; compact dense summaries before reducing essential information.