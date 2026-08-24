/**
 * Phase-aware asset preloading.
 *
 * Importing this module has no network side effects.  In particular, do not
 * add an "all assets" preload here: arcade music is shuffled by the audio
 * store and boss art is only needed when its boss level is entered.
 */
import { useGLTF } from "@react-three/drei";

// ─── 3D model paths ───────────────────────────────────────────────────────────
const CORE_GLTF_MODELS = [
  "/models/player_orb_texture.glb",
  "/models/star_pickup.glb",
];

const MENU_AUDIO = [
  "/sounds/menu_select.wav",
  "/sounds/level_select.wav",
  "/sounds/exit_to_menu.wav",
  "/sounds/tap_to_start.wav",
];

const GAMEPLAY_AUDIO = ["/sounds/boss_explosion.wav"];

const BOSS_MODELS: Partial<Record<BossType, readonly string[]>> = {
  circle: ["/models/boss_orb_1.glb", "/models/boss_orb_1_texture.glb"],
  star: ["/models/boss_orb_2_star_texture.glb"],
  triangle: ["/models/boss_orb_3_crystal_texture.glb"],
  trapezoid: ["/models/boss_orb_4_toxic_texture.glb"],
  cube: ["/models/boss_orb_5_plasma_texture.glb"],
  cloud: ["/models/boss_orb_6_diamond_texture.glb"],
  arrow: ["/models/boss_orb_7_rainbow_texture.glb"],
  tentacle: ["/models/boss_orb_8_mecha_texture.glb"],
  monster: ["/models/boss_orb_9_shadow_texture.glb"],
};

type BossType = "circle" | "star" | "arrow" | "triangle" | "trapezoid" | "cube" | "cloud" | "tentacle" | "monster";
type GameMode = "survival" | "chill" | "arcade" | "gauntlet";

const BOSS_BY_WORLD: Record<number, BossType> = {
  1: "circle", 2: "star", 3: "triangle", 4: "trapezoid", 5: "cube",
  6: "cloud", 7: "arrow", 8: "tentacle", 9: "monster",
};

const requestedUrls = new Set<string>();

function fetchIntoCache(url: string): Promise<void> {
  if (requestedUrls.has(url)) return Promise.resolve();
  requestedUrls.add(url);

  return fetch(url, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${url}`);
      return response.blob();
    })
    .then(() => undefined)
    .catch((error: unknown) => {
      // A retry can succeed after an intermittent network/cache failure. Keep
      // successful requests deduplicated, but never permanently poison a URL.
      requestedUrls.delete(url);
      // Preloading is an optimization. The owning renderer/audio element still
      // gets its normal request path, while this makes a failed warmup diagnosable.
      console.warn("[assets] preload failed", error);
    });
}

function fetchAssets(urls: readonly string[]): Promise<void> {
  return Promise.all(urls.map(fetchIntoCache)).then(() => undefined);
}

/**
 * Warm only menu interaction sounds after the startup overlay disappears.
 */
export function preloadMenuAssets(): Promise<void> {
  return fetchAssets(MENU_AUDIO);
}

/**
 * Begin loading assets used by the run that is about to start. This deliberately
 * excludes the shuffled arcade playlist and other worlds' boss models.
 */
export function preloadImminentGameAssets({
  gameMode,
  level,
}: {
  gameMode: GameMode;
  level: number | null;
}): Promise<void> {
  CORE_GLTF_MODELS.forEach((url) => useGLTF.preload(url));

  const urls = ["/models/player.fbx", ...GAMEPLAY_AUDIO];
  // A selected arcade boss level is the only time its model is imminent.
  if (gameMode === "arcade" && level !== null && Math.round(level * 10) % 10 === 9) {
    const models = BOSS_MODELS[BOSS_BY_WORLD[Math.floor(level)]];
    models?.forEach((model) => useGLTF.preload(model));
  }
  return fetchAssets(urls);
}
