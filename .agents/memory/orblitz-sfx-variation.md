---
name: Orblitz SFX variation boundary
description: Durable constraints for varying repeated procedural sound effects without destabilizing dense combat or audio lifecycle behavior.
---

Use bounded per-cue variation profiles with short anti-repeat history. Apply a
single coherent variation to all layers of one cue so pitch, filters, gain, and
decay move together rather than sounding randomly detuned.

**Why:** Independent random values on every oscillator make layered sounds lose
their identity, while unbounded history creates unnecessary long-session state.
Selecting variation before throttle admission also advances the audible sequence
for sounds that never play.

**How to apply:** Request variation only after the cue's existing throttle has
accepted it. Keep variation ranges subtle, key history by cue identity, preserve
shared noise buffers and master routing, and clear variation history whenever the
shared AudioContext is disposed.