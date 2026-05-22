/**
 * In-memory sliding-window rate limiter for API routes.
 *
 * Each instance tracks requests per key (e.g. user UID) using a sliding
 * time window. Old entries are pruned automatically on each check.
 *
 * Note: In a multi-instance deployment (e.g. multiple Vercel serverless
 * functions), this provides per-instance limiting only. For strict global
 * limiting, use an external store like Upstash Redis.
 */

interface RateLimitEntry {
  timestamps: number[];
}

export interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  /**
   * Check if a key is rate-limited. Returns an object indicating whether
   * the request is allowed, and how many requests remain.
   */
  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Prune expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const remaining = Math.max(0, this.maxRequests - entry.timestamps.length);
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow ? oldestInWindow + this.windowMs - now : 0;

    if (entry.timestamps.length >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetMs };
    }

    entry.timestamps.push(now);
    return { allowed: true, remaining: remaining - 1, resetMs: this.windowMs };
  }

  /** Remove all entries (useful for testing). */
  reset(): void {
    this.store.clear();
  }

  /** Get the current number of tracked keys. */
  get size(): number {
    return this.store.size;
  }
}

// ─── Pre-configured instances ──────────────────────────────────────────────

/** Rate limiter for AI task generation: 10 requests per 60 seconds per user */
export const aiRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
});
