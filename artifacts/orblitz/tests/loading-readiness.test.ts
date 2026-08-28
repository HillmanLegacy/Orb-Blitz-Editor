import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSectionManifest,
  prepareGameSection,
  resetAssetPreloadCache,
  type LoadProgress,
} from "../src/lib/preloadAssets";

const okResponse = () => new Response(new Blob(["asset"]), { status: 200 });

describe("section-aware loading", () => {
  beforeEach(() => {
    resetAssetPreloadCache();
    vi.stubGlobal("fetch", vi.fn(async () => okResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("selects only the current arcade section's critical models", () => {
    const normal = getSectionManifest("arcade", 1.8);
    const boss = getSectionManifest("arcade", 1.9);
    const mechaWorld = getSectionManifest("arcade", 8.1);

    expect(normal.assets.map((asset) => asset.id)).not.toContain("boss-1-base");
    expect(normal.nextWarmAssets.map((asset) => asset.id)).toContain("boss-1-base");
    expect(boss.assets.map((asset) => asset.id)).toContain("boss-1-base");
    expect(mechaWorld.assets.map((asset) => asset.id)).toContain("boss-8");
  });

  it("includes GLTF-backed endless enemies without loading every boss", () => {
    const manifest = getSectionManifest("survival", null);
    const ids = manifest.assets.map((asset) => asset.id);

    expect(ids).toContain("boss-8");
    expect(ids).toContain("boss-9");
    expect(ids).not.toContain("boss-7");
  });

  it("deduplicates successful requests and reports honest completion", async () => {
    const progress: LoadProgress[] = [];
    const fetchMock = vi.mocked(fetch);
    const options = {
      gameMode: "arcade" as const,
      level: 1.1,
      loadGameplayCode: async () => undefined,
      minimumMs: 0,
      timeoutMs: 500,
      onProgress: (snapshot: LoadProgress) => progress.push(snapshot),
    };

    await prepareGameSection(options);
    const requestsAfterFirstLoad = fetchMock.mock.calls.length;
    await prepareGameSection(options);

    expect(fetchMock).toHaveBeenCalledTimes(requestsAfterFirstLoad);
    expect(progress.at(-1)).toMatchObject({
      completed: progress.at(-1)?.total,
      label: "Arena ready",
      stage: "ready",
    });
  });

  it("retries a failed request once before accepting it", async () => {
    const attempts = new Map<string, number>();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      if (url.includes("star_pickup") && count === 1) {
        return new Response(null, { status: 503 });
      }
      return okResponse();
    }));

    const result = await prepareGameSection({
      gameMode: "arcade",
      level: 1.1,
      loadGameplayCode: async () => undefined,
      minimumMs: 0,
      timeoutMs: 1000,
    });

    expect(attempts.get("/models/star_pickup.glb")).toBe(2);
    expect(result.failedAssets).toEqual([]);
  });

  it("continues with fallbacks after a repeated asset failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("star_pickup")) {
        return new Response(null, { status: 503 });
      }
      return okResponse();
    }));

    const result = await prepareGameSection({
      gameMode: "arcade",
      level: 1.1,
      loadGameplayCode: async () => undefined,
      minimumMs: 0,
      timeoutMs: 1000,
    });

    expect(result.failedAssets).toContain("Preparing reward effects");
  });

  it("does not request renderer warmup until critical work is ready", async () => {
    let releaseCode!: () => void;
    const codeReady = new Promise<void>((resolve) => {
      releaseCode = resolve;
    });
    const warmRenderer = vi.fn(async () => undefined);

    const preparation = prepareGameSection({
      gameMode: "arcade",
      level: 1.1,
      loadGameplayCode: () => codeReady,
      warmRenderer,
      minimumMs: 0,
      timeoutMs: 1000,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warmRenderer).not.toHaveBeenCalled();
    releaseCode();
    await preparation;
    expect(warmRenderer).toHaveBeenCalledTimes(1);
  });

  it("bounds preparation time when a request never settles", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const startedAt = performance.now();

    const options = {
      gameMode: "arcade",
      level: 1.1,
      loadGameplayCode: async () => undefined,
      minimumMs: 0,
      timeoutMs: 20,
    } as const;
    const result = await prepareGameSection(options);

    expect(result.timedOut).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(250);

    await prepareGameSection(options);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(2);
  });
});