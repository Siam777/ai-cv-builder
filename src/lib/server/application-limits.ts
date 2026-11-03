import type { RateLimitConfig } from "./rate-limiter";

/** Tracker writes: 60 a minute per account (plan §4). Reads are more generous. */
export const APPLICATION_WRITE_LIMIT: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 60,
  errorCode: "APPLICATION_RATE_LIMIT",
  errorMessage:
    "Too many changes in a minute. Wait a moment and try again; nothing was lost.",
};
export const APPLICATION_READ_LIMIT: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 240,
  errorCode: "APPLICATION_RATE_LIMIT",
  errorMessage: "Too many requests in a minute. Wait a moment and try again.",
};
