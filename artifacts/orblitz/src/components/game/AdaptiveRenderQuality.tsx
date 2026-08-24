import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useMagicOrb } from "@/lib/stores/useMagicOrb";
import { IS_MOBILE } from "@/lib/isMobile";
import { runtimeDiagnostics } from "@/game-runtime/RuntimeDiagnostics";

export type RenderQualityTier = "high" | "medium" | "low";

type QualityListener = () => void;

const MIN_PIXEL_RATIO = 0.75;
const MAX_PIXEL_RATIO = 1.5;
const WINDOW_MS = 750;
const WARMUP_FRAMES = 45;
const SLOW_WINDOWS_TO_DOWNGRADE = 2;
const GOOD_WINDOWS_TO_UPGRADE = 6;
const SLOW_FRAME_MS = 20.5;
const GOOD_FRAME_MS = 17.5;
const TRANSITION_COOLDOWN_MS = 6000;

const TIER_ORDER: RenderQualityTier[] = ["low", "medium", "high"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDeviceMemory(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
}

function getInitialTier(): RenderQualityTier {
  const memory = getDeviceMemory();
  const cores = typeof navigator === "undefined" ? undefined : navigator.hardwareConcurrency;

  // Mobile devices start one tier below desktop so the first gameplay frames
  // do not pay for a high-DPR render before the controller has measurements.
  if (IS_MOBILE) return "medium";
  if ((memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4)) {
    return "medium";
  }
  return "high";
}

function getTierPixelRatio(tier: RenderQualityTier): number {
  const nativeRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const desktopRatio = clamp(Math.max(1, nativeRatio), MIN_PIXEL_RATIO, MAX_PIXEL_RATIO);

  if (tier === "high") return IS_MOBILE ? 1.15 : desktopRatio;
  if (tier === "medium") return IS_MOBILE ? 1 : Math.min(1.2, desktopRatio);
  return MIN_PIXEL_RATIO;
}

/**
 * Renderer-only quality governor.
 *
 * It deliberately does not use React state or Zustand for its high-frequency
 * sampling. React subscribers are notified only when the quality tier changes.
 */
class AdaptiveRenderQualityController {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly listeners = new Set<QualityListener>();
  private tier: RenderQualityTier = getInitialTier();
  private pixelRatio = getTierPixelRatio(this.tier);
  private activeGameplay = false;
  private warmupFrames = 0;
  private windowElapsedMs = 0;
  private frameEmaMs = 16.67;
  private slowWindows = 0;
  private goodWindows = 0;
  private cooldownRemainingMs = 0;
  private transitionCount = 0;
  private lastTransitionReason = "initial";

  readonly subscribe = (listener: QualityListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): RenderQualityTier => this.tier;
  readonly getServerSnapshot = (): RenderQualityTier => "high";

  attach(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.applyPixelRatio();
    this.recordDiagnostics();
  }

  detach(): void {
    this.renderer = null;
    this.activeGameplay = false;
    this.resetSampling();
    this.tier = getInitialTier();
    this.pixelRatio = getTierPixelRatio(this.tier);
    this.lastTransitionReason = "unmounted";
  }

  setGameplayActive(active: boolean): void {
    if (this.activeGameplay === active) return;
    this.activeGameplay = active;
    this.resetSampling();
    this.reapply();
  }

  reapply(): void {
    this.pixelRatio = getTierPixelRatio(this.tier);
    this.applyPixelRatio();
    this.recordDiagnostics();
  }

  sample(deltaSeconds: number): void {
    if (!this.renderer || !this.activeGameplay || !Number.isFinite(deltaSeconds)) return;

    const frameMs = deltaSeconds * 1000;
    // Ignore background-tab/debugger gaps. A single delayed callback should
    // never downgrade a device that is otherwise rendering well.
    if (frameMs <= 0 || frameMs > 100) return;

    if (this.warmupFrames < WARMUP_FRAMES) {
      this.warmupFrames += 1;
      return;
    }

    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - frameMs);
      return;
    }

    this.frameEmaMs = this.frameEmaMs * 0.9 + frameMs * 0.1;
    this.windowElapsedMs += frameMs;
    if (this.windowElapsedMs < WINDOW_MS) return;
    this.windowElapsedMs = 0;

    if (this.frameEmaMs > SLOW_FRAME_MS) {
      this.slowWindows += 1;
      this.goodWindows = 0;
    } else if (this.frameEmaMs < GOOD_FRAME_MS) {
      this.goodWindows += 1;
      this.slowWindows = 0;
    } else {
      this.slowWindows = 0;
      this.goodWindows = 0;
    }

    if (this.slowWindows >= SLOW_WINDOWS_TO_DOWNGRADE) {
      this.shiftQuality(-1, `sustained frame pressure (${this.frameEmaMs.toFixed(1)}ms)`);
    } else if (this.goodWindows >= GOOD_WINDOWS_TO_UPGRADE) {
      this.shiftQuality(1, `sustained frame headroom (${this.frameEmaMs.toFixed(1)}ms)`);
    }
  }

  private shiftQuality(direction: -1 | 1, reason: string): void {
    const currentIndex = TIER_ORDER.indexOf(this.tier);
    const nextTier = TIER_ORDER[clamp(currentIndex + direction, 0, TIER_ORDER.length - 1)];

    this.slowWindows = 0;
    this.goodWindows = 0;
    if (nextTier === this.tier) return;

    this.tier = nextTier;
    this.pixelRatio = getTierPixelRatio(nextTier);
    this.transitionCount += 1;
    this.lastTransitionReason = reason;
    this.cooldownRemainingMs = TRANSITION_COOLDOWN_MS;
    this.applyPixelRatio();
    this.recordDiagnostics();
    for (const listener of this.listeners) listener();
  }

  private resetSampling(): void {
    this.warmupFrames = 0;
    this.windowElapsedMs = 0;
    this.frameEmaMs = 16.67;
    this.slowWindows = 0;
    this.goodWindows = 0;
    this.cooldownRemainingMs = 0;
  }

  private applyPixelRatio(): void {
    if (this.renderer) {
      this.renderer.setPixelRatio(clamp(this.pixelRatio, MIN_PIXEL_RATIO, MAX_PIXEL_RATIO));
    }
  }

  private recordDiagnostics(): void {
    runtimeDiagnostics.setRenderQuality({
      tier: this.tier,
      pixelRatio: this.pixelRatio,
      transitionCount: this.transitionCount,
      lastTransitionReason: this.lastTransitionReason,
    });
  }
}

export const adaptiveRenderQuality = new AdaptiveRenderQualityController();

export function useRenderQuality(): RenderQualityTier {
  return useSyncExternalStore(
    adaptiveRenderQuality.subscribe,
    adaptiveRenderQuality.getSnapshot,
    adaptiveRenderQuality.getServerSnapshot,
  );
}

export function AdaptiveRenderQuality() {
  const { gl } = useThree();

  useEffect(() => {
    adaptiveRenderQuality.attach(gl);

    const reapply = () => adaptiveRenderQuality.reapply();
    window.addEventListener("resize", reapply);
    window.addEventListener("orientationchange", reapply);
    window.visualViewport?.addEventListener("resize", reapply);

    const unsubscribePhase = useMagicOrb.subscribe(
      (state) => state.phase,
      (phase) => adaptiveRenderQuality.setGameplayActive(phase === "playing"),
      { fireImmediately: true },
    );

    return () => {
      unsubscribePhase();
      window.removeEventListener("resize", reapply);
      window.removeEventListener("orientationchange", reapply);
      window.visualViewport?.removeEventListener("resize", reapply);
      adaptiveRenderQuality.detach();
    };
  }, [gl]);

  useFrame((_, delta) => {
    adaptiveRenderQuality.sample(delta);
  }, -100);

  return null;
}