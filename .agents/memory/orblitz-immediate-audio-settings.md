---
name: Orblitz immediate audio settings
description: Mute and volume changes must update every active output immediately while preserving safe music scheduling.
---

Mute is an output-state change, not just a music transition. Apply it directly
to the master Web Audio output, active synthesized music gains, and HTML audio
elements; keep fade transitions for track switching. Preserve the requested
volume independently so changing volume while muted does not unmute audio, and
so a later AudioContext initialization uses the persisted setting.

**Why:** A fade-only mute leaves a short period of audible output and lets
volume changes race pending fade timers. Initializing the audio graph with its
hard-coded default also makes a saved Options value appear ineffective until
another audio event updates the graph.

**How to apply:** Keep an explicit output mute path that cancels conflicting
automation/timers and restores the current music at the stored volume. Track
the master volume before the graph exists, and apply it when the master bus is
created.