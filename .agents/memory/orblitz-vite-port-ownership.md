---
name: Orblitz Vite port ownership
description: How to prevent managed-workflow restarts from silently serving an older Orblitz dev process.
---

Use Vite's strict port mode for the Orblitz managed web workflow, and verify the configured artifact port after a restart.

**Why:** If an older Vite process survives, Vite's default behavior is to choose another free port. The artifact proxy remains attached to the configured port and can then serve stale code, making source fixes appear ineffective.

**How to apply:** After a web-workflow restart, confirm the Vite log reports the configured port and that only one Orblitz Vite process is listening. Treat a fallback port as a workflow/process cleanup issue, not a frontend behavior regression.