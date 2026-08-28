import { useSyncExternalStore } from "react";

export type GraphicsPreset = "low" | "standard" | "high";

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

/** Production always renders every feature. Development may disable one for A/B profiling. */
export function isPerformanceFeatureEnabled(feature: PerformanceFeature): boolean {
  if (disabledFeatures.has(feature)) return false;
  if (graphicsPreset === "low") {
    // Keep enemy cores and collision simulation active at every preset.
    return feature === "enemyVisuals" || feature === "collision"
      ? true
      : false;
  }
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