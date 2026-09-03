---
name: Orblitz menu CSS cascade
description: How to keep the active menu presentation from being overridden by historical responsive selectors.
---

The active menu should use dedicated class hooks and one final geometry contract rather than relying only on broad legacy selectors.

**Why:** Orblitz’s menu stylesheet has accumulated several historical visual systems and responsive compatibility blocks. A later legacy rule can silently re-center or resize a newly designed menu even when the new rule looks correct in isolation.

**How to apply:** Give major active-menu regions isolated hooks, verify the stylesheet order at the actual file end, and preview desktop, short landscape, portrait mobile, and landscape mobile after any menu CSS change.