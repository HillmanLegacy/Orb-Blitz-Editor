import type { BossType } from "@/lib/stores/useMagicOrb";

export interface BossDefeatPalette {
  primary: string;
  secondary: string;
  glow: string;
  highlight: string;
  shadow: string;
  rainbow?: boolean;
}

export type MainBossType = Exclude<BossType, "bird">;

export const MAIN_BOSS_TYPES: readonly MainBossType[] = [
  "circle",
  "star",
  "triangle",
  "trapezoid",
  "cube",
  "cloud",
  "arrow",
  "tentacle",
  "monster",
];

export const BOSS_DEFEAT_DURATION = 3.5;
export const BOSS_DEFEAT_SIZE_SCALE = 1.7;

/**
 * Canonical palettes for the nine authored main bosses. These colors mirror
 * the corresponding live boss/skin renderers and are consumed by the shared
 * 1.9 defeat animation.
 */
export const BOSS_DEFEAT_PALETTES: Record<MainBossType, BossDefeatPalette> = {
  circle: {
    primary: "#ff4400",
    secondary: "#ff8800",
    glow: "#ffaa00",
    highlight: "#ffcc00",
    shadow: "#8a1800",
  },
  star: {
    primary: "#cc8800",
    secondary: "#ffcc00",
    glow: "#fff066",
    highlight: "#fff8c0",
    shadow: "#8a5200",
  },
  triangle: {
    primary: "#008877",
    secondary: "#00ffcc",
    glow: "#aaffee",
    highlight: "#eeffff",
    shadow: "#00554d",
  },
  trapezoid: {
    primary: "#228800",
    secondary: "#44ff22",
    glow: "#66ff44",
    highlight: "#ccff88",
    shadow: "#124800",
  },
  cube: {
    primary: "#2244cc",
    secondary: "#4488ff",
    glow: "#aa44ff",
    highlight: "#bbccff",
    shadow: "#121b66",
  },
  cloud: {
    primary: "#88aaff",
    secondary: "#aaddff",
    glow: "#ffccee",
    highlight: "#ffffff",
    shadow: "#3d506b",
  },
  arrow: {
    primary: "#ff0000",
    secondary: "#00ffff",
    glow: "#ff00ff",
    highlight: "#ffffff",
    shadow: "#4400aa",
    rainbow: true,
  },
  tentacle: {
    primary: "#2266aa",
    secondary: "#44bbff",
    glow: "#cfefff",
    highlight: "#ffffff",
    shadow: "#12334f",
  },
  monster: {
    primary: "#440088",
    secondary: "#8800ff",
    glow: "#cc55ff",
    highlight: "#ee99ff",
    shadow: "#210044",
  },
};

export function getBossDefeatPalette(bossType: BossType): BossDefeatPalette {
  return bossType === "bird" ? BOSS_DEFEAT_PALETTES.circle : BOSS_DEFEAT_PALETTES[bossType];
}