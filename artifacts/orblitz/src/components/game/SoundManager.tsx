import { useEffect, useRef } from "react";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { useAudio } from "@/lib/stores/useAudio";

/**
 * Mounts invisibly in App.tsx and drives arcade BGM lifecycle:
 *   - Starts shuffled playlist when arcade gameplay begins
 *   - Continues through pause/levelComplete/gameOver (no interruption)
 *   - Fades out when returning to menu or exiting
 */
export function SoundManager() {
  const phase    = useMagicOrb((s) => s.phase);
  const gameMode = useMagicOrb((s) => s.gameMode);
  const startArcadeBgm = useAudio((s) => s.startArcadeBgm);
  const stopArcadeBgm  = useAudio((s) => s.stopArcadeBgm);

  // Track whether we're currently in an arcade session so we know when to
  // stop — even if gameMode changes before phase returns to "menu".
  const inArcadeSession = useRef(false);

  useEffect(() => {
    if (gameMode === "arcade" && phase === "playing") {
      inArcadeSession.current = true;
      startArcadeBgm();
    } else if (phase === "menu") {
      if (inArcadeSession.current) {
        inArcadeSession.current = false;
        stopArcadeBgm();
      }
    }
    // paused, levelComplete, gameOver, loading — leave BGM untouched
  }, [phase, gameMode, startArcadeBgm, stopArcadeBgm]);

  return null;
}
