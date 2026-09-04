---
name: Orblitz carousel transition sequencing
description: The world carousel must mount under a completed blackout before the reveal begins.
---

The ARCADE handoff is a staged transition: fade the current menu to full black, mount the world carousel while black remains opaque, wait for its mount animation to complete, then fade black away.

**Why:** Mounting the carousel and lowering the blackout in the same render exposes old menu layers and lets the carousel entrance compete with the reveal.

**How to apply:** Keep the transition state explicit (`fadeOut`, `mounting`, `fadeIn`) and do not use exit-presence delays for menu-only HUD elements that must be absent from the carousel. The blackout must also be explicitly `position: fixed` because the shell's direct-child positioning rule can override utility classes.