---
name: Orblitz carousel transition sequencing
description: The world carousel must mount under a completed blackout before the reveal begins.
---

The ARCADE handoff is a staged transition: keep the current menu visible underneath a blackout that is fading out, pre-mount the world carousel hidden during that fade, switch to the ready carousel at full black, then fade black away.

**Why:** Mounting the carousel only after the blackout creates a visible loading gap; mounting it during fade-out avoids that gap while the blackout protects the transition.

**How to apply:** Keep the fade phases explicit (`fadeOut`, `fadeIn`) and track pre-mounted carousel content separately; do not use exit-presence delays for menu-only HUD elements that must be absent from the carousel. The blackout must be explicitly `position: fixed` and rendered above the shell's stacking context, because a child z-index cannot outrank the shared canvas when its parent sits below the canvas.