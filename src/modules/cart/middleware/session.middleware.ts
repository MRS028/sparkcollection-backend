/**
 * Session Middleware
 * Handles session ID generation for guest users
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { randomBytes } from "crypto";

/**
 * Ensure session ID exists for guest users
 * For authenticated users, this middleware ensures they also have a session ID
 */
export const ensureSessionId = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Check for existing session ID in cookies first
    let sessionId = req.cookies?.sessionId;

    // Check for session ID in headers as fallback
    if (!sessionId) {
      sessionId = req.headers["x-session-id"] as string | undefined;
    }

    // Generate new session ID if not found
    if (!sessionId) {
      sessionId = `session_${randomBytes(16).toString("hex")}_${Date.now()}`;

      // Set session ID in response header for client to use
      res.setHeader("X-Session-ID", sessionId);

      // Set cookie for persistent session (7 days)
      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
        path: "/",
      });
    }

    // Attach session ID to request
    req.sessionId = sessionId;

    next();
  } catch (error) {
    next(error);
  }
};
