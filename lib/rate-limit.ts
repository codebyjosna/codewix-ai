import "server-only";

// Simple in-memory sliding-window rate limiter.
// Suitable for single-instance deployments. For multi-instance, swap with
// Redis/Upstash. Entries expire after the window.

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

// Prune expired entries every 5 minutes to bound memory.
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastPrune = Date.now();

function prune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitOptions {
  // Identifier (usually IP or IP+email).
  key: string;
  // Max requests in the window.
  limit: number;
  // Window size in ms.
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds, 0 if allowed
}

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(opts.key) ?? { timestamps: [] };
  // Keep only timestamps within the window.
  bucket.timestamps = bucket.timestamps.filter(
    (t) => now - t < opts.windowMs,
  );
  if (bucket.timestamps.length >= opts.limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = opts.windowMs - (now - oldest);
    buckets.set(opts.key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  bucket.timestamps.push(now);
  buckets.set(opts.key, bucket);
  return {
    allowed: true,
    remaining: opts.limit - bucket.timestamps.length,
    retryAfter: 0,
  };
}

// Extract a client identifier from the request. Falls back to a constant
// if no IP can be determined (shouldn't happen behind Amplify/CloudFront).
export function getClientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
