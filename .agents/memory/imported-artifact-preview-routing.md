---
name: Imported artifact preview routing
description: Artifact catalog helpers may fail for imports even when the real HTTPS preview route is healthy.
---

Imported web projects may not resolve through artifact catalog helpers even while their actual browser preview works normally. Do not equate a helper's “artifact not found” result with a broken application route.

**Why:** The imported Orblitz project served HTTP 200 locally and through its HTTPS `.replit.dev` route, and a real browser loaded the menu, while artifact screenshot/catalog helpers still could not resolve its imported ID.

**How to apply:** Check workflow status, bind address, localhost HTTP, the HTTPS development URL, and a real browser run. Use HTTPS for `.replit.dev`; do not diagnose forwarding failure from a plain-HTTP check or catalog-helper failure alone.