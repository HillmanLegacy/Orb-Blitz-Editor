# Gameplay Performance Inventory

## Scope and constraints

This inventory covers active gameplay only. The target is consistent frame pacing during held fire, rapid clicking, dense Chill and Survival waves, projectile trails, and boss encounters without reducing visual density, fire cadence, enemy counts, background effects, or weapon behavior. In particular, the default `normal` action remains available when no shop weapon is equipped.

## Gameplay lifecycle boundary

`GameplayScene` mounts heavy gameplay systems only while the game is loading or playing. The menu keeps the lightweight background and post-processing stack mounted, but does not retain projectile, enemy, particle, boss, or gameplay-input systems. The runtime must reset its pools at this boundary and must not cause gameplay resources to survive into menu, pause, or a subsequent run.

## Frame-loop inventory

| System | Current hot work | Runtime direction |
| --- | --- | --- |
| `GameLogic` | Input cadence, spawning, gameplay timers, raycast direction | Retain event-driven spawning and reusable raycast objects; clock owns frame timing and UI timer publication is throttled. |
| `Projectiles` | Central projectile movement, homing, hit tests, temporary VFX detection, impact countdown | Runtime owns mutable projectile positions, directions, timers, and slot lifecycle; React receives structural add/remove events only. |
| `ProjectileTrails` | Per-projectile geometry/material creation and line-buffer rewrites | Trail runtime owns reusable typed histories and slot lifecycle; renderer reads live projectile coordinates. |
| `DarkOrbs` | Mutable enemy motion plus player/barrier collision, destruction effects, and a second projectile collision scan | Enemy runtime owns live transforms; the duplicated projectile scan is removed so projectile collision has one authoritative path. |
| Per-enemy visual components | Imperative mesh animation and some decorative frame loops | Preserve unique boss and world visuals; feed their group transforms from the runtime rather than publishing transforms through Zustand. |
| Background, rings, fire, star flow and player effects | Imperative/instanced visual animation | Remain specialized systems, coordinated by the shared clock only where a single elapsed time is sufficient. |

## Store publication inventory

The gameplay store is appropriate for structural entries (spawn/remove, hit/destroy, score, power-up state, phase, and boss state). It is not appropriate for position, direction, trail history, animation phase, or other transform-only data.

Existing issues to address:

- The timer batch currently publishes every gameplay frame even when its consumer is UI-only.
- Projectile movement publishes copied projectile arrays after structural changes and retains a separate mutable map.
- Enemy motion is mostly imperative, but structural countdowns can still publish at render cadence.
- The enemy system independently scans structural projectile positions, which can disagree with the projectile system’s live motion data.

## Allocation and resource inventory

Hot-path allocations observed before the runtime change:

- Projectile active-ID sets, removed-ID sets, copied projectile snapshots, volley filtering, and temporary position tuples.
- One `BufferGeometry`, `LineBasicMaterial`, and `Line` per projectile trail, disposed and recreated as projectiles churn.
- Per-frame effect-array mapping/filtering while impacts are active.
- Repeated enemy/projectile nested collision scans and some per-enemy temporary vectors/colors in visual components.

The runtime uses stable numeric slots and free-list reuse for projectiles, enemies, particles, and trails. Renderer-specific geometries remain owned by their renderer and are disposed only when that renderer unmounts.

## Collision inventory

Projectile collision is authoritative for projectile-to-enemy, projectile-to-boss, and projectile-to-power-up results. It currently includes weapon-specific rules for homing, spiral sub-spheres, scatter volleys, overcharged explosions, piercing, miss tracking, boss shields, and charged radii. These rules must remain unchanged while candidate lookup changes to live runtime data and squared-distance broad-phase filtering.

Enemy motion remains authoritative for enemy-to-player and enemy-to-barrier collisions. It must not independently remove enemies for projectile hits.

## Development diagnostics

Development builds expose a read-only runtime diagnostics snapshot containing:

- frame, simulation, collision, and render timing;
- active and high-water slot counts for projectiles, enemies, particles, and trails;
- structural store writes attributed to the runtime in the current frame;
- render counters for projectile and enemy renderers.

Diagnostics are development-only and are sampled without placing performance measurements in React state.