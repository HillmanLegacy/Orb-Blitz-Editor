---
name: Orblitz authoritative rewards
description: Star rewards are reserved at defeat, credited on visual arrival, and settled before transitions.
---

All coin rewards represented by star-flow events must be reserved exactly once when the gameplay event is created. Visible stars credit the reserved balance as they reach the player; every gameplay transition and reset must atomically settle any remainder before clearing presentation state.

**Why:** The counter should track visible collection, but rendering availability is not authoritative gameplay state. A bounded pending ledger prevents quality limits, disabled VFX, scene unmounts, or transition races from losing or double-paying rewards.

**How to apply:** New reward bursts reserve their full snapshotted value first. Presentation may report absorbed amounts, but the store caps credits against the pending balance; transition/reset paths settle the balance before clearing events. Empty settlement must be a no-op.