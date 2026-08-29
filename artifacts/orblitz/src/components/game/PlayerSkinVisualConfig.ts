import type { OrbSkin } from "@/lib/stores/useShop";

export const PLAYER_SKIN_MODEL_PATHS: Record<OrbSkin, string> = {
  default: "/models/player_orb_texture.glb",
  fire: "/models/boss_orb_1_texture.glb",
  star: "/models/boss_orb_2_star_texture.glb",
  crystal: "/models/boss_orb_3_crystal_texture.glb",
  toxic: "/models/boss_orb_4_toxic_texture.glb",
  plasma: "/models/boss_orb_5_plasma_texture.glb",
  diamond: "/models/boss_orb_6_diamond_texture.glb",
  rainbow: "/models/boss_orb_7_rainbow_texture.glb",
  mecha: "/models/boss_orb_8_mecha_texture.glb",
  monster: "/models/boss_orb_9_shadow_texture.glb",
};

const PLAYER_SKIN_ROTATION_ARC = 0.18;
const PLAYER_SKIN_ROTATION_SPEED = 0.55;

/**
 * Keep the authored front of every player skin facing the camera while adding
 * a subtle, fluid yaw. A bounded arc avoids rotating a texture atlas seam into
 * view, which a continuous 360-degree spin would inevitably do.
 */
export function getPlayerSkinVisualYaw(_skin: OrbSkin, elapsedSeconds: number): number {
  return Math.sin(elapsedSeconds * PLAYER_SKIN_ROTATION_SPEED) * PLAYER_SKIN_ROTATION_ARC;
}

const PLAYER_SKIN_TRAIL_COLORS: Record<OrbSkin, string> = {
  default: "#ffffff",
  fire: "#ff6600",
  star: "#ffcc00",
  crystal: "#00ffcc",
  toxic: "#44ff22",
  plasma: "#6688ff",
  diamond: "#aaddff",
  rainbow: "#ff00ff",
  mecha: "#44bbff",
  monster: "#aa33ff",
};

export function getPlayerSkinModelPath(skin: OrbSkin): string {
  return PLAYER_SKIN_MODEL_PATHS[skin];
}

export function getPlayerSkinTrailColor(skin: OrbSkin): string {
  return PLAYER_SKIN_TRAIL_COLORS[skin];
}

export type PlayerSkinTrailPalette = {
  base: string;
  head: string;
  tail: string;
  strands: readonly [string, string, string];
};

function mixHex(left: string, right: string, amount: number): string {
  const parse = (value: string) => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const [lr, lg, lb] = parse(left);
  const [rr, rg, rb] = parse(right);
  const channel = (a: number, b: number) =>
    Math.round(a + (b - a) * amount).toString(16).padStart(2, "0");
  return `#${channel(lr, rr)}${channel(lg, rg)}${channel(lb, rb)}`;
}

export function getPlayerSkinTrailPalette(skin: OrbSkin): PlayerSkinTrailPalette {
  const base = getPlayerSkinTrailColor(skin);
  return {
    base,
    head: mixHex(base, "#ffffff", 0.45),
    tail: mixHex(base, "#000000", 0.45),
    strands: [
      base,
      mixHex(base, "#000000", 0.12),
      mixHex(base, "#000000", 0.25),
    ],
  };
}