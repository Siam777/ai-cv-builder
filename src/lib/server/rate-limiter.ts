import { HttpError } from "./http";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  errorCode?: string;
  errorMessage?: string;
}

interface WindowRecord {
  timestamps: number[];
}

const rateLimitStores = new Map<string, Map<string, WindowRecord>>();

/**
 * Enforces in-memory sliding-window rate limiting per identifier (e.g. user ID or client IP).
 * Automatically cleans up expired windows to bound memory usage.
 */
export function checkRateLimit(
  bucket: string,
  key: string,
  config: RateLimitConfig,
): void {
  const now = Date.now();
  let store = rateLimitStores.get(bucket);
  if (!store) {
    store = new Map<string, WindowRecord>();
    rateLimitStores.set(bucket, store);
  }

  // Memory hygiene: periodically clear stale entries
  if (store.size > 2000) {
    for (const [k, v] of store.entries()) {
      if (
        v.timestamps.length === 0 ||
        v.timestamps[v.timestamps.length - 1] < now - config.windowMs
      ) {
        store.delete(k);
      }
    }
  }

  let record = store.get(key);
  if (!record) {
    record = { timestamps: [] };
    store.set(key, record);
  }

  // Keep only timestamps within the active sliding window
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= config.maxRequests) {
    throw new HttpError(
      429,
      config.errorCode ?? "RATE_LIMIT_EXCEEDED",
      config.errorMessage ??
        "Too many requests. Please wait a moment before trying again.",
    );
  }

  record.timestamps.push(now);
}

export function resetRateLimits(): void {
  rateLimitStores.clear();
}
