import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
  });

  it("allows requests under the limit", () => {
    const r1 = limiter.check("user1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("user1");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("user1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");

    const r4 = limiter.check("user1");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");

    // user1 is at limit
    expect(limiter.check("user1").allowed).toBe(false);

    // user2 should still be allowed
    expect(limiter.check("user2").allowed).toBe(true);
  });

  it("allows requests after window expires", async () => {
    // Use a very short window
    const fastLimiter = new RateLimiter({ maxRequests: 1, windowMs: 50 });

    const r1 = fastLimiter.check("user1");
    expect(r1.allowed).toBe(true);

    const r2 = fastLimiter.check("user1");
    expect(r2.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const r3 = fastLimiter.check("user1");
    expect(r3.allowed).toBe(true);
  });

  it("reset() clears all entries", () => {
    limiter.check("user1");
    limiter.check("user2");
    expect(limiter.size).toBe(2);

    limiter.reset();
    expect(limiter.size).toBe(0);

    // Should be allowed again after reset
    expect(limiter.check("user1").allowed).toBe(true);
  });

  it("returns correct resetMs for the caller", () => {
    limiter.check("user1");
    limiter.check("user1");
    limiter.check("user1");

    const blocked = limiter.check("user1");
    expect(blocked.resetMs).toBeGreaterThan(0);
    expect(blocked.resetMs).toBeLessThanOrEqual(1000);
  });

  it("handles rapid sequential calls correctly", () => {
    const results = Array.from({ length: 5 }, () => limiter.check("user1"));

    const allowedCount = results.filter((r) => r.allowed).length;
    const blockedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(3);
    expect(blockedCount).toBe(2);
  });
});
