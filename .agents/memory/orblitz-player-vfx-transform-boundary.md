---
name: Orblitz player VFX transform boundary
description: Rotation and weapon reactions must not distort VFX attached around the player.
---

Keep the player world anchor stable. Apply continuous model rotation, recoil, squash, stretch, and other weapon reactions only to a visual-model child; mount shields, auras, particles, rings, power-up effects, and charge effects outside that child.

Shared boss and mini-orb renderers must retain their bounded seam-safe yaw by default. Disable their internal yaw only when the player wrapper owns model rotation.

**Why:** Shared renderers also draw enemies and bosses, so globally removing their yaw changes unrelated visuals. Applying weapon reactions at the player root scales and rotates every attached effect.

**How to apply:** When adding a player reaction or renderer animation, identify whether it belongs to the model or the surrounding VFX anchor. Preserve non-player defaults on shared renderers.