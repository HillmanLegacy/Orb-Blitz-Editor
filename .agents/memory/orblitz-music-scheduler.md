---
name: Orblitz Web Audio music scheduler pattern
description: Correct lifecycle for the step-sequencer music nodes in SynthSounds.ts — prevents silent scheduler leaks when fading out.
---

## The Rule
Both `createMenuMusicNode` and `createBossMusicNode` use an `active` boolean gate inside their recursive scheduler:
- `active = true` → scheduler creates AudioNodes each tick
- `active = false` → scheduler loop keeps running but skips note creation; `nextT` is advanced to avoid a catch-up burst on resume

**Why:** `useAudio.tsx` calls `fadeOut()` (not `stop()`) for mute/switch transitions. If note scheduling continued at gain=0, it would create thousands of AudioNodes silently over a long session — real CPU/memory pressure.

## How to Apply
- `fadeOut()`: ramp mgain to 0, then `active = false` after FADE_TIME (setTimeout).
- `fadeIn()`: set `active = true` + reset `nextT = ctx.currentTime + 0.05` BEFORE ramping gain up, so music resumes immediately without a burst of catch-up notes.
- `stop()`: sets `running = false` to kill the loop entirely + disconnects mgain.
- `start()`: no-op — scheduler starts at construction.

## Parameter Order Pitfall
`useAudio.tsx` calls `playComboSound(comboCount, volume)` (count first).
`SynthSounds.ts` signature must match: `playComboSound(comboCount = 1, volume = 0.25)`.
The old file had them swapped — fixed by checking the call site, not assuming standard order.

## Architecture
Each music node gets its own `mgain: GainNode` (starts at 0) inserted between scheduled notes and `dst(ctx)`. This is the fade handle — all oscillators connect to `mgain`, not to `dst` directly. Reverb send connects `mgain → reverbNode`. This keeps the SFX master bus completely separate from music fading.
