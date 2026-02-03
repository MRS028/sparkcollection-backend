/**
 * Session Middleware
 * Handles session ID generation for guest users
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { randomBytes } from "crypto";

/**
 * Ensure session ID exists for guest users
 * For authenticated users, this middleware does nothing
 * For guest users, it generates or retrieves session ID from headers/cookies
 */
export const ensureSessionId = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // If user is authenticated, skip session ID handling
    if (req.user?.userId) {
      return next();
    }

    // Check for existing session ID in headers
    let sessionId = req.headers["x-session-id"] as string | undefined;

    // Check for session ID in cookies as fallback
    if (!sessionId && req.cookies?.sessionId) {
      sessionId = req.cookies.sessionId;
    }

    // Generate new session ID if not found
    if (!sessionId) {
      sessionId = `guest_${randomBytes(16).toString("hex")}_${Date.now()}`;

      // Set session ID in response header for client to use
      res.setHeader("X-Session-ID", sessionId);

      // Optionally set cookie for persistent session (7 days)
      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
      });
    }

    // Attach session ID to request
    req.sessionId = sessionId;

    next();
  } catch (error) {
    next(error);
  }
};
