import type { MagicOrbState } from "./useMagicOrb";

/**
 * Store boundaries are types/selectors rather than new stores so existing
 * gameplay callers and persisted progression remain compatible during the
 * incremental migration away from the historical monolithic state object.
 */
export type MagicOrbRunState = Pick<MagicOrbState,
  | "phase" | "loadingType" | "pendingLevel" | "gameMode" | "arcadeLevel"
  | "completedLevel" | "orbsDestroyedInLevel" | "orbsRequiredForLevel"
  | "arcadeTotalOrbs" | "boss" | "survivalBossTimer" | "survivalBossPending"
  | "bossDefeating" | "health" | "maxHealth" | "killSpeedBonus"
  | "killSpawnBonus" | "timeDifficultyBonus" | "lastDifficultyTick"
  | "score" | "stars" | "gameTime" | "gauntletOrbsDestroyed"
  | "startGame" | "startArcadeLevel" | "completeLevel" | "endGame"
  | "returnToMenu" | "tickGameTimers" | "takeDamage" | "damageBoss"
>;

export type MagicOrbProgressionState = Pick<MagicOrbState,
  | "highScore" | "bonusMaxHealth" | "defeatedBosses"
>;

export type MagicOrbUiState = Pick<MagicOrbState,
  | "phase" | "loadingType" | "pendingLevel" | "gameMode" | "selectedWeapon"
  | "setGameMode" | "setSelectedWeapon" | "pauseGame" | "resumeGame"
  | "startLoading" | "finishLoading"
>;

export type MagicOrbRuntimeState = Pick<MagicOrbState,
  | "playerPosition" | "darkOrbs" | "projectiles" | "powerUps" | "particles"
  | "impactEffects" | "laserBeams" | "starFlowEvents" | "defenseOrbs"
  | "addDarkOrb" | "removeDarkOrb" | "addProjectile" | "removeProjectile"
  | "addPowerUp" | "removePowerUp" | "hurtPowerUp" | "markPowerUpCollected"
  | "updatePowerUpState"
>;

// These selectors intentionally return the same store object. A component can
// compose a narrow selector against the typed boundary without allocating a
// fresh object on each Zustand notification.
export const selectMagicOrbRun = (state: MagicOrbState): MagicOrbRunState => state;
export const selectMagicOrbProgression = (state: MagicOrbState): MagicOrbProgressionState => state;
export const selectMagicOrbUi = (state: MagicOrbState): MagicOrbUiState => state;
export const selectMagicOrbRuntime = (state: MagicOrbState): MagicOrbRuntimeState => state;