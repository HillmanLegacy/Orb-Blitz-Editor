---
name: R3F pooled prop pitfall
description: Why mutating array props in-place silently breaks mesh position updates in React Three Fiber
---

## Rule
Never pass a mutated-in-place array (e.g. `[x,y,z]`) as a React prop to an R3F element across frames. If the array reference is the same, React's reconciler skips the prop update, so the Three.js mesh never moves.

**Why:** R3F's reconciler uses reference equality to diff props. `oldProps.position === newProps.position` → `true` → R3F does not call `instance.position.set(...)`. The mesh stays frozen at its old position, silently.

**How to apply:** Any time you try to pool position/velocity/direction tuples stored as React props:
- Creating `poolPos`, setting `.current.get(id)`, mutating in-place, then passing `position: poolPos` to a JSX element — this will break rendering.
- Safe alternative: mutate imperatively via `meshRef.current.position.set(x, y, z)` inside `useFrame`, bypassing React props entirely (requires refactor away from declarative position props).
- Also safe: always create a new array literal `[x, y, z]` for each frame's prop value (original approach).

**Discovered:** Orblitz mobile perf optimization task. Code review caught this before it shipped.
