---
name: Orblitz menu CSS cascade
description: How to keep the active menu presentation from being overridden by historical responsive selectors.
---

The active menu should use dedicated class hooks and one final geometry contract rather than relying only on broad legacy selectors.

**Why:** Orblitz’s menu stylesheet has accumulated several historical visual systems and responsive compatibility blocks. A later legacy rule can silently re-center or resize a newly designed menu even when the new rule looks correct in isolation.

**How to apply:** Give major active-menu regions isolated hooks, verify the stylesheet order at the actual file end, and preview desktop, short landscape, portrait mobile, and landscape mobile after any menu CSS change.

**Root menu veil:** Put a root-menu backdrop on the app layer behind the transparent shared WebGL canvas, while keeping the startup shell transparent.

**Why:** A veil painted by the startup shell sits above the canvas and dims the emissive boss-orb showcase.

**How to apply:** Scope the app-layer veil to the root menu state; do not move it onto the overlay shell when preserving the canvas colors.