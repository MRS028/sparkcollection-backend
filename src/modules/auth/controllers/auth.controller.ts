/**
 * Authentication Controller
 * Thin controller - delegates all logic to services
 */

import { Response, NextFunction } from "express";
// import { Role } from "@prisma/client";
import { AuthRequest, Role } from "../../../shared/types/index.js";
import { authService } from "../services/auth.service.js";
import { jwtService } from "../services/jwt.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../../../shared/utils/apiResponse.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "../validators/auth.validator.js";

/**
 * Get client IP address
 */
const getClientIp = (req: AuthRequest): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const register = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const input: RegisterInput = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.register(
      {
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: input.role as Role | undefined,
      },
      ipAddress,
      userAgent,
    );

    // Set refresh token in HTTP-only cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken);

    sendCreated(
      res,
      {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: result.tokens.accessTokenExpiresAt,
        },
      },
      "Registration successful",
    );
  },
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
export const login = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const input: LoginInput = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const result = await authService.login(input, ipAddress, userAgent);

    // Set refresh token in HTTP-only cookie
    setRefreshTokenCookie(res, result.tokens.refreshToken);

    sendSuccess(
      res,
      {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt: result.tokens.accessTokenExpiresAt,
        },
      },
      { message: "Login successful" },
    );
  },
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
export const refreshToken = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    // Get refresh token from Authorization header (Bearer token), cookie, or body (fallback)
    let token: string | undefined;

    // First priority: Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Fallback to cookie or body
    if (!token) {
      token =
        req.cookies?.refreshToken ||
        (req.body as RefreshTokenInput).refreshToken;
    }

    if (!token) {
      throw new Error("Refresh token is required");
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    const tokens = await authService.refreshTokens(token, ipAddress, userAgent);

    // Set new refresh token in cookie
    setRefreshTokenCookie(res, tokens.refreshToken);

    sendSuccess(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.accessTokenExpiresAt,
      },
      { message: "Token refreshed successfully" },
    );
  },
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (revoke refresh token)
 * @access  Private
 */
export const logout = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    const ipAddress = getClientIp(req);

    // Get access token to blacklist it
    const accessToken =
      jwtService.extractTokenFromHeader(req.headers.authorization) || undefined;

    if (token) {
      await authService.logout(token, ipAddress, accessToken);
    }

    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    sendSuccess(res, null, { message: "Logged out successfully" });
  },
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
export const logoutAll = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const ipAddress = getClientIp(req);

    await authService.logoutAll(userId, ipAddress);

    // Clear refresh token cookie
    clearRefreshTokenCookie(res);

    sendSuccess(res, null, { message: "Logged out from all devices" });
  },
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
export const forgotPassword = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { email } = req.body as ForgotPasswordInput;

    await authService.requestPasswordReset(email);

    sendSuccess(res, null, {
      message: "If the email exists, a password reset link will be sent",
    });
  },
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
export const resetPassword = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { token, password } = req.body as ResetPasswordInput;
    const ipAddress = getClientIp(req);

    await authService.resetPassword(token, password, ipAddress);

    sendSuccess(res, null, { message: "Password reset successful" });
  },
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
export const changePassword = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const ipAddress = getClientIp(req);

    await authService.changePassword(
      userId,
      currentPassword,
      newPassword,
      ipAddress,
    );

    sendSuccess(res, null, { message: "Password changed successfully" });
  },
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
export const getCurrentUser = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const user = await authService.getUserById(userId);

    sendSuccess(res, { user }, { message: "User retrieved successfully" });
  },
);

// Helper functions

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/v1/auth",
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
  });
}
