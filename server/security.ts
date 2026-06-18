import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  name: string;
  windowMs: number;
  max: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
let cleanupCounter = 0;

export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
    ].join("; "),
  );
  next();
}

export function createRateLimiter({ name, windowMs, max }: RateLimitOptions) {
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${name}:${clientIp(request)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      cleanupExpiredBuckets(now);
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

function clientIp(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const firstForwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0];
  return (firstForwardedIp || request.ip || request.socket.remoteAddress || "unknown")
    .trim()
    .replace(/^::ffff:/, "");
}

function cleanupExpiredBuckets(now: number) {
  cleanupCounter += 1;
  if (cleanupCounter % 500 !== 0) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
