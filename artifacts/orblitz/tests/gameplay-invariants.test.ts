import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RUNTIME_PROJECTILES,
  ProjectileRuntime,
} from "../src/game-runtime/ProjectileRuntime";
import { ProjectileSpawnEvents } from "../src/game-runtime/ProjectileSpawnEvents";
import { RuntimeClock } from "../src/game-runtime/RuntimeClock";
import { useMagicOrb, type Projectile } from "../src/lib/stores/useMagicOrb";
import { useShop } from "../src/lib/stores/useShop";

const makeProjectile = (id: string): Projectile => ({
  id,
  position: [0, 0, 0],
  direction: [1, 0, 0],
  isCharged: false,
  size: 1,
});

describe("gameplay runtime invariants", () => {
  beforeEach(() => {
    useShop.setState({ coins: 0 });
    useMagicOrb.setState({
      hasDoubleCoins: false,
      projectiles: [],
      starFlowEvents: [],
    });
  });

  afterEach(() => {
    useMagicOrb.setState({ projectiles: [], starFlowEvents: [] });
  });

  it("commits star rewards when the gameplay event is created", () => {
    useMagicOrb.getState().addStarFlowEvent([1, 2, 0], 5);

    expect(useShop.getState().coins).toBe(5);
    expect(useMagicOrb.getState().starFlowEvents).toHaveLength(1);
    expect(useMagicOrb.getState().starFlowEvents[0]).toMatchObject({
      fromPos: [1, 2, 0],
      count: 5,
      coinsPerStar: 1,
    });

    useMagicOrb.setState({ hasDoubleCoins: true });
    useMagicOrb.getState().addStarFlowEvent([3, 4, 0], 5);

    expect(useShop.getState().coins).toBe(15);
    expect(useMagicOrb.getState().starFlowEvents[1].coinsPerStar).toBe(2);
  });

  it("admits complete volleys only when capacity is available", () => {
    const existing = Array.from(
      { length: MAX_RUNTIME_PROJECTILES - 2 },
      (_, index) => makeProjectile(`existing-${index}`),
    );
    useMagicOrb.setState({ projectiles: existing });

    expect(useMagicOrb.getState().canAddProjectiles(2)).toBe(true);
    expect(useMagicOrb.getState().canAddProjectiles(3)).toBe(false);
  });

  it("keeps runtime projectile slots bounded and reusable", () => {
    const pool = new ProjectileRuntime(2);

    const first = pool.getOrCreate(makeProjectile("one"));
    const second = pool.getOrCreate(makeProjectile("two"));

    expect(pool.active).toBe(2);
    expect(() => pool.getOrCreate(makeProjectile("overflow"))).toThrow(/capacity/);

    pool.release("one");
    const reused = pool.getOrCreate(makeProjectile("three"));

    expect(pool.active).toBe(2);
    expect(reused.slot).toBe(first.slot);
    expect(second.slot).not.toBe(reused.slot);
  });

  it("drops only presentation spawn events when their bounded queue is full", () => {
    const events = new ProjectileSpawnEvents(1);
    const source = makeProjectile("visual-one");

    expect(events.enqueue(source)).toBe(true);
    expect(events.enqueue({ ...source, id: "visual-two" })).toBe(false);

    const consumed: string[] = [];
    events.consume((event) => consumed.push(event.id));

    expect(consumed).toEqual(["visual-one"]);
  });

  it("does not advance the runtime clock while paused", () => {
    const clock = new RuntimeClock();

    expect(clock.tick(0.25)).toBe(0.25);
    clock.paused = true;

    expect(clock.tick(0.25)).toBe(0);
    expect(clock.elapsed).toBe(0.25);
    expect(clock.frame).toBe(2);
  });
});