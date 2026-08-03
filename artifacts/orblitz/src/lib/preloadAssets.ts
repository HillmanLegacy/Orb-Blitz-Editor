/**
 * Central asset preload manifest.
 *
 * Importing this module no longer fires side-effects.
 * Call prewarmGLTFCache() and preloadAllAssets() explicitly after the
 * startup loading screen has faded so heavy network traffic does not
 * compete with the initial render.
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

/**
 * Prime Drei's GLTF cache for all game 3D models.
 * Call this AFTER the startup loading screen fades out (player is in menu)
 * so it doesn't compete with initial page render bandwidth.
 */
export function prewarmGLTFCache(): void {
  GLTF_MODELS.forEach((url) => useGLTF.preload(url));
}

/**
 * Fetches all audio and FBX assets into the browser HTTP cache.
 * Call once on startup (after the loading screen); the returned Promise
 * resolves when every asset has been downloaded (errors are suppressed).
 */
export function preloadAllAssets(): Promise<void> {
  const fetches = HTTP_ASSETS.map((url) =>
    fetch(url, { cache: "force-cache" })
      .then((r) => r.blob())
      .catch(() => undefined), // never let a missing asset fail the gate
  );
  return Promise.all(fetches).then(() => undefined);
}
