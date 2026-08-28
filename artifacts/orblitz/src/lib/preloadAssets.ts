/**
 * Section-aware asset preparation.
 *
 * Critical assets are fetched into the browser cache and GLTF parsing is
 * started before gameplay is revealed. Future-section warming uses the same
 * deduplicated cache without changing gameplay state.
 */
import { useGLTF } from "@react-three/drei";
import { suspend } from "suspend-react";
import { DRACOLoader, GLTFLoader, MeshoptDecoder } from "three-stdlib";
import type { GameMode } from "./stores/useMagicOrb";

export type LoadStage = "code" | "models" | "renderer" | "ready" | "fallback";

export interface SectionAsset {
  id: string;
  url: string;
  label: string;
  kind: "gltf" | "audio";
}

export interface SectionManifest {
  key: string;
  assets: SectionAsset[];
  nextWarmAssets: SectionAsset[];
}

export interface LoadProgress {
  completed: number;
  total: number;
  label: string;
  stage: LoadStage;
}

export interface SectionPreparationResult {
  timedOut: boolean;
  failedAssets: string[];
}

interface PrepareOptions {
  gameMode: GameMode;
  level: number | null;
  loadGameplayCode: () => Promise<void>;
  warmRenderer?: () => Promise<void>;
  minimumMs?: number;
  timeoutMs?: number;
  onProgress?: (progress: LoadProgress) => void;
}

interface PreparationWork {
  label: string;
  stage: Exclude<LoadStage, "ready" | "fallback">;
  run: () => Promise<void>;
}

const PLAYER_MODEL: SectionAsset = {
  id: "player-model",
  url: "/models/player_orb_texture.glb",
  label: "Loading player systems",
  kind: "gltf",
};

const REWARD_MODEL: SectionAsset = {
  id: "reward-model",
  url: "/models/star_pickup.glb",
  label: "Preparing reward effects",
  kind: "gltf",
};

const MENU_AUDIO: SectionAsset[] = [
  { id: "menu-select", url: "/sounds/menu_select.wav", label: "Loading menu audio", kind: "audio" },
  { id: "level-select", url: "/sounds/level_select.wav", label: "Loading menu audio", kind: "audio" },
  { id: "exit-menu", url: "/sounds/exit_to_menu.wav", label: "Loading menu audio", kind: "audio" },
  { id: "tap-start", url: "/sounds/tap_to_start.wav", label: "Loading menu audio", kind: "audio" },
];

const BOSS_MODELS: Record<number, SectionAsset[]> = {
  1: [
    { id: "boss-1-base", url: "/models/boss_orb_1.glb", label: "Preparing fire guardian", kind: "gltf" },
    { id: "boss-1-texture", url: "/models/boss_orb_1_texture.glb", label: "Preparing fire guardian", kind: "gltf" },
  ],
  2: [{ id: "boss-2", url: "/models/boss_orb_2_star_texture.glb", label: "Preparing star guardian", kind: "gltf" }],
  3: [{ id: "boss-3", url: "/models/boss_orb_3_crystal_texture.glb", label: "Preparing crystal guardian", kind: "gltf" }],
  4: [{ id: "boss-4", url: "/models/boss_orb_4_toxic_texture.glb", label: "Preparing toxic guardian", kind: "gltf" }],
  5: [{ id: "boss-5", url: "/models/boss_orb_5_plasma_texture.glb", label: "Preparing plasma guardian", kind: "gltf" }],
  6: [{ id: "boss-6", url: "/models/boss_orb_6_diamond_texture.glb", label: "Preparing diamond guardian", kind: "gltf" }],
  7: [{ id: "boss-7", url: "/models/boss_orb_7_rainbow_texture.glb", label: "Preparing prism guardian", kind: "gltf" }],
  8: [{ id: "boss-8", url: "/models/boss_orb_8_mecha_texture.glb", label: "Preparing mecha systems", kind: "gltf" }],
  9: [{ id: "boss-9", url: "/models/boss_orb_9_shadow_texture.glb", label: "Preparing shadow systems", kind: "gltf" }],
};

const requestCache = new Map<string, Promise<void>>();

function isBossLevel(level: number): boolean {
  return Math.round((level % 1) * 10) === 9;
}

function uniqueAssets(assets: readonly SectionAsset[]): SectionAsset[] {
  const byUrl = new Map<string, SectionAsset>();
  for (const asset of assets) byUrl.set(asset.url, asset);
  return [...byUrl.values()];
}

export function getSectionManifest(gameMode: GameMode, level: number | null): SectionManifest {
  const currentLevel = level ?? 1.1;
  const world = Math.max(1, Math.min(9, Math.floor(currentLevel)));
  const assets: SectionAsset[] = [PLAYER_MODEL, REWARD_MODEL];

  // Worlds 8 and 9 reuse their boss GLTF for standard enemy visuals.
  if (gameMode === "arcade" && (world >= 8 || isBossLevel(currentLevel))) {
    assets.push(...(BOSS_MODELS[world] ?? []));
  }

  // Endless modes can draw enemy shapes from every world. Their only
  // GLTF-backed standard enemies are the mecha and monster variants.
  if (gameMode !== "arcade") {
    assets.push(...BOSS_MODELS[8], ...BOSS_MODELS[9]);
  }

  // Warm the current world's boss while normal arcade levels are played.
  // It is the next large model most likely to be needed.
  const nextWarmAssets =
    gameMode === "arcade" && !isBossLevel(currentLevel)
      ? BOSS_MODELS[world] ?? []
      : gameMode === "arcade" && world < 9
        ? BOSS_MODELS[world + 1] ?? []
        : [];

  return {
    key: `${gameMode}:${currentLevel.toFixed(1)}`,
    assets: uniqueAssets(assets),
    nextWarmAssets: uniqueAssets(nextWarmAssets),
  };
}

let gltfLoader: GLTFLoader | null = null;
let dracoLoader: DRACOLoader | null = null;

function loadGltfIntoDreiCache(url: string): Promise<void> {
  const load = async (_Loader: typeof GLTFLoader, input: string) => {
    if (!gltfLoader) {
      gltfLoader = new GLTFLoader();
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
      gltfLoader.setDRACOLoader(dracoLoader);
      gltfLoader.setMeshoptDecoder(
        typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder,
      );
    }
    return Promise.all([gltfLoader.loadAsync(input)]);
  };

  try {
    // useGLTF/useLoader uses this exact suspend-react cache key. Catching and
    // awaiting the thrown promise makes its cache readiness observable.
    suspend(load, [GLTFLoader, url]);
    return Promise.resolve();
  } catch (pendingOrError) {
    if (pendingOrError instanceof Promise) {
      return pendingOrError.then(() => undefined);
    }
    return Promise.reject(pendingOrError);
  }
}

async function fetchAttempt(asset: SectionAsset): Promise<void> {
  if (asset.kind === "gltf" && typeof document !== "undefined") {
    await loadGltfIntoDreiCache(asset.url);
    return;
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 2400);
  try {
    const response = await fetch(asset.url, { cache: "force-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${asset.url}`);
    await response.blob();
  } finally {
    clearTimeout(deadline);
  }
}

async function fetchWithRetry(asset: SectionAsset): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fetchAttempt(asset);
      return;
    } catch (error) {
      lastError = error;
      if (asset.kind === "gltf") useGLTF.clear(asset.url);
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }
  throw lastError;
}

function loadAsset(asset: SectionAsset): Promise<void> {
  const cached = requestCache.get(asset.url);
  if (cached) return cached;

  const request = fetchWithRetry(asset);
  request.catch(() => {
    if (requestCache.get(asset.url) === request) requestCache.delete(asset.url);
  });
  requestCache.set(asset.url, request);
  return request;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settleWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  if (timeoutMs <= 0) return false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const completed = await Promise.race([
    promise.then(() => true),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timer !== null) clearTimeout(timer);
  return completed;
}

/**
 * Loads the selected section's critical set and waits for renderer warmup.
 * The timeout is a safety valve: local visual fallbacks remain authoritative.
 */
export async function prepareGameSection({
  gameMode,
  level,
  loadGameplayCode,
  warmRenderer,
  minimumMs = 1100,
  timeoutMs = 6500,
  onProgress,
}: PrepareOptions): Promise<SectionPreparationResult> {
  const manifest = getSectionManifest(gameMode, level);
  const criticalWork: PreparationWork[] = [
    { label: "Loading gameplay systems", stage: "code" as const, run: loadGameplayCode },
    ...manifest.assets.map((asset) => ({
      label: asset.label,
      stage: "models" as const,
      run: () => loadAsset(asset),
    })),
  ];
  const total = criticalWork.length + (warmRenderer ? 1 : 0);
  let completed = 0;
  const failedAssets: string[] = [];
  const startedAt = performance.now();

  onProgress?.({ completed, total, label: criticalWork[0]?.label ?? "Preparing arena", stage: "code" });

  const runWork = (items: PreparationWork[]) => Promise.all(items.map(async (item) => {
    onProgress?.({ completed, total, label: item.label, stage: item.stage });
    try {
      await item.run();
    } catch (error) {
      failedAssets.push(item.label);
      console.warn("[loading] preparation step failed", item.label, error);
    } finally {
      completed += 1;
      onProgress?.({ completed, total, label: item.label, stage: item.stage });
    }
  }));

  // Critical code/model cache promises must settle before requesting the
  // renderer pass. This guarantees ShaderPrewarm's generation is post-model.
  const criticalReady = await settleWithin(runWork(criticalWork), timeoutMs);
  let timedOut = !criticalReady;

  if (criticalReady && warmRenderer) {
    const elapsed = performance.now() - startedAt;
    const rendererItem: PreparationWork = {
      label: "Warming graphics pipeline",
      stage: "renderer" as const,
      run: warmRenderer,
    };
    const rendererReady = await settleWithin(runWork([rendererItem]), timeoutMs - elapsed);
    timedOut = !rendererReady;
  }

  if (timedOut) {
    for (const asset of manifest.assets) {
      requestCache.delete(asset.url);
      if (asset.kind === "gltf") useGLTF.clear(asset.url);
    }
  }

  const remainingMinimum = minimumMs - (performance.now() - startedAt);
  if (remainingMinimum > 0) await delay(remainingMinimum);

  onProgress?.({
    completed: timedOut ? completed : total,
    total,
    label: timedOut || failedAssets.length > 0
      ? "Continuing with safe visual fallbacks"
      : "Arena ready",
    stage: timedOut || failedAssets.length > 0 ? "fallback" : "ready",
  });

  return { timedOut, failedAssets };
}

export function preloadMenuAssets(): Promise<void> {
  return Promise.allSettled(MENU_AUDIO.map(loadAsset)).then(() => undefined);
}

export function warmNextGameSection(gameMode: GameMode, level: number): () => void {
  const assets = getSectionManifest(gameMode, level).nextWarmAssets;
  if (assets.length === 0) return () => undefined;

  let cancelled = false;
  let timer: number | null = null;
  let idleId: number | null = null;
  const run = () => {
    if (cancelled) return;
    void Promise.allSettled(assets.map(loadAsset));
  };

  timer = window.setTimeout(() => {
    if (cancelled) return;
    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(run, { timeout: 2500 });
    } else {
      run();
    }
  }, 1200);

  return () => {
    cancelled = true;
    if (timer !== null) window.clearTimeout(timer);
    if (idleId !== null && typeof cancelIdleCallback !== "undefined") cancelIdleCallback(idleId);
  };
}

/** Test-only reset for deterministic cache-path coverage. */
export function resetAssetPreloadCache(): void {
  requestCache.clear();
}