/**
 * Rate Limiting Middleware
 * Protects against abuse and DDoS attacks
 */

import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { config } from "../../config/index.js";
import { TooManyRequestsError } from "../errors/index.js";
import { redis } from "../../config/redis.js";

/**
 * Default rate limiter
 */
export const defaultLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests from this IP, please try again later.",
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  },
  skip: (_req: Request) => {
    return config.app.isTest;
  },
});

/**
 * Strict rate limiter for authentication routes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: {
      code: "TOO_MANY_ATTEMPTS",
      message:
        "Too many authentication attempts. Please try again in 15 minutes.",
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for password reset
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    error: {
      code: "TOO_MANY_RESET_ATTEMPTS",
      message: "Too many password reset attempts. Please try again in an hour.",
      statusCode: 429,
    },
  },
});

/**
 * Rate limiter for API endpoints (more generous)
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    success: false,
    error: {
      code: "API_RATE_LIMIT",
      message: "API rate limit exceeded. Please slow down.",
      statusCode: 429,
    },
  },
});

/**
 * Custom Redis-based rate limiter for distributed systems
 */
export const createRedisRateLimiter = (
  keyPrefix: string,
  maxRequests: number,
  windowSeconds: number,
) => {
  return async (req: Request, _res: Response, next: Function) => {
    if (!redis.isReady()) {
      // Fall back to allowing the request if Redis is unavailable
      return next();
    }

    const key = `ratelimit:${keyPrefix}:${req.ip}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (current && current > maxRequests) {
        const ttl = await redis.ttl(key);
        throw new TooManyRequestsError(
          ttl > 0 ? ttl : windowSeconds,
          `Rate limit exceeded. Try again in ${ttl} seconds.`,
        );
      }

      next();
    } catch (error) {
      if (error instanceof TooManyRequestsError) {
        next(error);
      } else {
        // Allow request on Redis error
        next();
      }
    }
  };
};

/**
 * Rate limiter for file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    error: {
      code: "UPLOAD_LIMIT",
      message: "Upload limit exceeded. Please try again later.",
      statusCode: 429,
    },
  },
});
