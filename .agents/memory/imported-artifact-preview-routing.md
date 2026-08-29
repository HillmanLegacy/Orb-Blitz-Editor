---
name: Imported artifact preview routing
description: Imported web artifacts can have healthy managed workflows while preview catalog helpers cannot resolve the artifact.
---

Imported web projects may expose the expected port and serve successfully locally while the preview/catalog layer still reports that the app cannot be reached. This is a forwarding or registration problem, not evidence that the frontend process failed.

**Why:** The imported Orblitz project served HTTP 200 on its configured port and its workflow reported the port open, but preview resolution could not find the imported artifact.

**How to apply:** Check workflow status, bind address, and localhost HTTP response before changing app code or repeatedly restarting. If all three are healthy, avoid port/config churn and treat the remaining issue as platform-side artifact forwarding.