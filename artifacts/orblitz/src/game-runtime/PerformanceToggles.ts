import { useSyncExternalStore } from "react";

export type GraphicsPreset = "low" | "standard" | "high";

export type GraphicsPresetProfile = Readonly<{
  renderTier: "low" | "medium" | "high";
  desktopPixelRatio: number;
  mobilePixelRatio: number;
  menuFps: number;
  gameplayFps: number;
  idleFps: number;
  trailDensity: number;
  enemyOrbitParticles: number;
  maxImpactParticles: number;
  impactShadows: boolean;
  impactShimmer: boolean;
  fireEmbers: number;
  fireSurgeSparks: number;
  volcanicLights: number;
  bloomIntensity: number;
  bloomRadius: number;
  bloomMipmap: boolean;
  chromaticAberration: boolean;
  antialiasPass: boolean;
}>;

/**
 * Player-authoritative render profiles. Every tier keeps complete gameplay
 * feedback; only presentation resolution, density, and optional GPU passes vary.
 */
export const GRAPHICS_PRESET_PROFILES: Record<GraphicsPreset, GraphicsPresetProfile> = {
  low: {
    renderTier: "low",
    desktopPixelRatio: 0.8,
    mobilePixelRatio: 0.75,
    menuFps: 12,
    gameplayFps: 60,
    idleFps: 24,
    trailDensity: 0.42,
    enemyOrbitParticles: 4,
    maxImpactParticles: 80,
    impactShadows: false,
    impactShimmer: false,
    fireEmbers: 64,
    fireSurgeSparks: 96,
    volcanicLights: 1,
    bloomIntensity: 0.38,
    bloomRadius: 0.4,
    bloomMipmap: false,
    chromaticAberration: false,
    antialiasPass: false,
  },
  standard: {
    renderTier: "medium",
    desktopPixelRatio: 1,
    mobilePixelRatio: 0.9,
    menuFps: 15,
    gameplayFps: 60,
    idleFps: 30,
    trailDensity: 0.72,
    enemyOrbitParticles: 8,
    maxImpactParticles: 160,
    impactShadows: true,
    impactShimmer: false,
    fireEmbers: 128,
    fireSurgeSparks: 180,
    volcanicLights: 2,
    bloomIntensity: 0.56,
    bloomRadius: 0.58,
    bloomMipmap: true,
    chromaticAberration: true,
    antialiasPass: false,
  },
  high: {
    renderTier: "high",
    desktopPixelRatio: 1.4,
    mobilePixelRatio: 1.15,
    menuFps: 24,
    gameplayFps: 60,
    idleFps: 45,
    trailDensity: 1,
    enemyOrbitParticles: 12,
    maxImpactParticles: 320,
    impactShadows: true,
    impactShimmer: true,
    fireEmbers: 200,
    fireSurgeSparks: 300,
    volcanicLights: 3,
    bloomIntensity: 0.66,
    bloomRadius: 0.72,
    bloomMipmap: true,
    chromaticAberration: true,
    antialiasPass: true,
  },
};

export type PerformanceFeature =
  | "background"
  | "postprocessing"
  | "vfx"
  | "enemyVisuals"
  | "collision";

const FEATURES: readonly PerformanceFeature[] = [
  "background",
  "postprocessing",
  "vfx",
  "enemyVisuals",
  "collision",
];

const disabledFeatures = new Set<PerformanceFeature>();
const listeners = new Set<() => void>();
let version = 0;
const GRAPHICS_PRESET_KEY = "orblitz_graphics_preset";

function readGraphicsPreset(): GraphicsPreset {
  if (typeof window === "undefined") return "standard";
  try {
    const stored = window.localStorage.getItem(GRAPHICS_PRESET_KEY);
    return stored === "low" || stored === "high" || stored === "standard"
      ? stored
      : "standard";
  } catch {
    return "standard";
  }
}

let graphicsPreset: GraphicsPreset = readGraphicsPreset();

function notify(): void {
  version++;
  for (const listener of listeners) listener();
}

function isFeature(value: string): value is PerformanceFeature {
  return (FEATURES as readonly string[]).includes(value);
}

function loadQueryOverrides(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;

  const value = new URLSearchParams(window.location.search).get("orblitzPerf");
  if (!value) return;

  for (const item of value.split(",")) {
    const feature = item.trim();
    if (feature === "all") {
      for (const knownFeature of FEATURES) disabledFeatures.add(knownFeature);
    } else if (isFeature(feature)) {
      disabledFeatures.add(feature);
    }
  }
}

loadQueryOverrides();

/** Player presets preserve complete visual feedback; dev overrides support A/B profiling. */
export function isPerformanceFeatureEnabled(feature: PerformanceFeature): boolean {
  if (disabledFeatures.has(feature)) return false;
  return true;
}

export function setPerformanceFeatureEnabled(feature: PerformanceFeature, enabled: boolean): void {
  if (!import.meta.env.DEV) return;
  const changed = enabled ? disabledFeatures.delete(feature) : !disabledFeatures.has(feature);
  if (!enabled) disabledFeatures.add(feature);
  if (changed) notify();
}

export function getGraphicsPreset(): GraphicsPreset {
  return graphicsPreset;
}

export function getGraphicsPresetProfile(
  preset: GraphicsPreset = graphicsPreset,
): GraphicsPresetProfile {
  return GRAPHICS_PRESET_PROFILES[preset];
}

export function setGraphicsPreset(preset: GraphicsPreset): void {
  if (graphicsPreset === preset) return;
  graphicsPreset = preset;
  try {
    window.localStorage.setItem(GRAPHICS_PRESET_KEY, preset);
  } catch {
    // Settings still apply for this session when storage is unavailable.
  }
  notify();
}

export function performanceFeatureSnapshot(): Record<PerformanceFeature, boolean> {
  return {
    background: isPerformanceFeatureEnabled("background"),
    postprocessing: isPerformanceFeatureEnabled("postprocessing"),
    vfx: isPerformanceFeatureEnabled("vfx"),
    enemyVisuals: isPerformanceFeatureEnabled("enemyVisuals"),
    collision: isPerformanceFeatureEnabled("collision"),
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePerformanceFeature(feature: PerformanceFeature): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isPerformanceFeatureEnabled(feature),
    () => true,
  );
}

export function usePerformanceToggleVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

export function useGraphicsPreset(): GraphicsPreset {
  return useSyncExternalStore(subscribe, getGraphicsPreset, () => "standard");
}