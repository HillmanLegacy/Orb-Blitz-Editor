/**
 * Central asset preload manifest.
 *
 * Importing this module fires all useGLTF.preload() calls immediately —
 * before any React component renders — so Drei's GLTF cache is primed
 * as early as possible.
 *
 * Call preloadAllAssets() once on startup to also fetch audio and FBX
 * files into the browser's HTTP cache, eliminating first-play hitches.
 */
import { useGLTF } from "@react-three/drei";

// ─── 3D model paths ───────────────────────────────────────────────────────────
const GLTF_MODELS = [
  "/models/star_pickup.glb",
  "/models/player_orb_texture.glb",
  "/models/boss_orb_1.glb",
  "/models/boss_orb_1_texture.glb",
  "/models/boss_orb_4_toxic_texture.glb",
  "/models/boss_orb_5_plasma_texture.glb",
  "/models/boss_orb_6_diamond_texture.glb",
  "/models/boss_orb_7_rainbow_texture.glb",
  "/models/boss_orb_8_mecha_texture.glb",
  "/models/boss_orb_9_shadow_texture.glb",
];

// ─── Audio paths ──────────────────────────────────────────────────────────────
const AUDIO_ASSETS: string[] = [
  ...Array.from({ length: 14 }, (_, i) =>
    `/audio/arcade/track_${String(i + 1).padStart(2, "0")}.mp3`,
  ),
  "/audio/chipper_doodle.mp3",
  "/sounds/menu_select.wav",
  "/sounds/level_select.wav",
  "/sounds/exit_to_menu.wav",
  "/sounds/tap_to_start.wav",
  "/sounds/boss_explosion.wav",
];

// ─── Non-GLTF binary assets (FBX + audio) ────────────────────────────────────
const HTTP_ASSETS = ["/models/player.fbx", ...AUDIO_ASSETS];

// Kick off GLTF cache population at module-import time (side-effect)
GLTF_MODELS.forEach((url) => useGLTF.preload(url));

/**
 * Fetches all audio and FBX assets into the browser HTTP cache.
 * Call once on startup; the returned Promise resolves when every
 * asset has been downloaded (errors are suppressed — non-critical).
 */
export function preloadAllAssets(): Promise<void> {
  const fetches = HTTP_ASSETS.map((url) =>
    fetch(url, { cache: "force-cache" })
      .then((r) => r.blob())
      .catch(() => undefined), // never let a missing asset fail the gate
  );
  return Promise.all(fetches).then(() => undefined);
}
