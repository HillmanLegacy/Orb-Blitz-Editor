export type GameplayGateMode = "hidden" | "chunk-loading" | "ready";

/**
 * The blue player placeholder represents JavaScript chunk loading only.
 * Runtime model suspension is handled by local visual boundaries.
 */
export function getGameplayGateMode(
  gameplayActive: boolean,
  gameplayChunkLoaded: boolean,
): GameplayGateMode {
  if (!gameplayActive) return "hidden";
  return gameplayChunkLoaded ? "ready" : "chunk-loading";
}