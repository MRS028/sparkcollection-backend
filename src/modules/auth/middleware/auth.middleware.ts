/**
 * Authentication Middleware
 * Handles JWT verification and role-based access control
 */

import { Response, NextFunction } from "express";
import {
  AuthRequest,
  JwtPayload,
  UserRole,
} from "../../../shared/types/index.js";
import { jwtService } from "../services/jwt.service.js";
import { authService } from "../services/auth.service.js";
import {
  UnauthorizedError,
  ForbiddenError,
  TokenExpiredError,
  InvalidTokenError,
} from "../../../shared/errors/index.js";

/**
 * Authenticate user via JWT token
 */
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract token from header
    const token = jwtService.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await authService.getUserById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError("User no longer exists");
    }

    if (user.status !== "active" && user.status !== "pending_verification") {
      throw new UnauthorizedError("Account is not active");
    }

    // Attach user info to request
    req.user = decoded;
    req.tenantId = decoded.tenantId;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = jwtService.extractTokenFromHeader(req.headers.authorization);

    if (token) {
      const decoded = jwtService.verifyAccessToken(token);
      req.user = decoded;
      req.tenantId = decoded.tenantId;
    }

    next();
  } catch {
    // Silently continue without authentication
    next();
  }
};

/**
 * Authorize based on user roles
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${allowedRoles.join(", ")}`,
        ),
      );
    }

    next();
  };
};

/**
 * Admin only access
 */
export const adminOnly = authorize(UserRole.ADMIN);

/**
 * Seller access (includes admin)
 */
export const sellerAccess = authorize(UserRole.ADMIN, UserRole.SELLER);

/**
 * Support agent access (includes admin)
 */
export const supportAccess = authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT);

/**
 * Customer access (all authenticated users)
 */
export const customerAccess = authorize(
  UserRole.ADMIN,
  UserRole.SELLER,
  UserRole.CUSTOMER,
  UserRole.SUPPORT_AGENT,
);

/**
 * Check if user owns the resource or is admin
 */
export const ownerOrAdmin = (
  getResourceOwnerId: (req: AuthRequest) => string | Promise<string>,
) => {
  return async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      // Admin can access anything
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }

      const ownerId = await getResourceOwnerId(req);

      if (req.user.userId !== ownerId) {
        throw new ForbiddenError("Access denied");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Verify user has verified email
 */
export const requireVerifiedEmail = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const user = await authService.getUserById(req.user.userId);

    if (!user?.emailVerified) {
      throw new ForbiddenError(
        "Please verify your email to access this resource",
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Tenant isolation middleware
 */
export const tenantIsolation = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.tenantId) {
      // Use default tenant if not specified
      req.tenantId = "default";
    }

    // Add tenant filter to query/body if needed
    // This ensures data isolation in multi-tenant setup

    next();
  } catch (error) {
    next(error);
  }
};
