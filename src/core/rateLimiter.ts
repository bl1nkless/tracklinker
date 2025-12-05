export type AsyncFn<T> = () => Promise<T>;

export interface RateLimiter {
  <T>(fn: AsyncFn<T>): Promise<T>;
  readonly pending: number;
}

/**
 * Sliding window limiter that enforces `max` executions per `windowMs`.
 */
export function slidingWindowLimiter(
  max: number,
  windowMs: number,
): RateLimiter {
  const hits: number[] = [];

  const limiter = (async <T>(fn: AsyncFn<T>): Promise<T> => {
    const now = Date.now();

    while (hits.length > 0 && now - hits[0] > windowMs) {
      hits.shift();
    }

    if (hits.length >= max) {
      const waitMs = windowMs - (now - hits[0]);
      await new Promise((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }

    hits.push(Date.now());
    return fn();
  }) as RateLimiter;

  Object.defineProperty(limiter, 'pending', {
    get() {
      return hits.length;
    },
  });

  return limiter;
}
