let generation = 0;
const listeners = new Set<() => void>();
const waiters = new Map<number, () => void>();

export function subscribeRendererWarmup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRendererWarmupGeneration(): number {
  return generation;
}

/**
 * Requests a fresh compile pass. The generation change re-renders
 * ShaderPrewarm after critical model promises have populated the Drei cache.
 */
export function requestRendererWarmup(timeoutMs = 1800): Promise<void> {
  const requestedGeneration = ++generation;
  listeners.forEach((listener) => listener());

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      waiters.delete(requestedGeneration);
      resolve();
    };
    waiters.set(requestedGeneration, finish);
    window.setTimeout(finish, timeoutMs);
  });
}

export function markRendererWarmupComplete(completedGeneration: number): void {
  waiters.get(completedGeneration)?.();
}