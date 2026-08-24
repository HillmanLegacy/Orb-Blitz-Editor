---
name: Orblitz discontinuous collision transforms
description: Rules for maintaining reliable continuous projectile collision across teleports and orbital motion.
---

Continuous collision must only describe real continuous movement. When an actor
teleports, set its prior and current collision transforms to the destination in
the same frame. For projectiles with independently animated collision parts,
sweep each part from its prior transform/phase to its next transform/phase,
not merely the parent's movement.

**Why:** Treating a teleport as travel creates a phantom hit path, while using
an old orbital phase at the sweep endpoint makes fast sub-parts tunnel or hit
where they are not rendered.

**How to apply:** Whenever movement has a discontinuity or child animation
changes the collision position, update collision history explicitly before any
swept test. Keep the collision endpoints aligned with the transforms committed
for rendering that frame.

Spatial broad phases must obey the same sweep contract as the narrow phase.
Index every grid cell touched between an enemy's previous and current transform,
then restore deterministic source ordering and deduplicate candidates before
testing hits.

**Why:** Indexing only an actor's current cell silently drops valid crossings
when a fast enemy ends beyond the projectile path despite a correct swept
intersection test.

**How to apply:** Any acceleration structure added ahead of swept collision
must conservatively cover both motion endpoints; optimization is invalid if it
can exclude a candidate the narrow phase would otherwise test.