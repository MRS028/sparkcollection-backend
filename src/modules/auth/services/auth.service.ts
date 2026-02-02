/**
 * Authentication Service
 * Handles all authentication business logic
 */

import { Types } from "mongoose";
import { User } from "../../user/models/User.model.js";
import { RefreshToken, IRefreshToken } from "../models/RefreshToken.model.js";
import { jwtService, TokenPair } from "./jwt.service.js";
import {
  UnauthorizedError,
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../../../shared/errors/index.js";
import { IUser, UserRole, UserStatus } from "../../../shared/types/index.js";
import { redis } from "../../../config/redis.js";
import { logger } from "../../../shared/utils/logger.js";
import { config } from "../../../config/index.js";

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Partial<IUser>;
  tokens: TokenPair;
}

class AuthService {
  /**
   * Register a new user
   */
  public async register(
    input: RegisterInput,
    ipAddress: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const { email, password, firstName, lastName, phone, role } = input;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError("Email already registered");
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phone,
      role: role || UserRole.CUSTOMER,
      status: UserStatus.PENDING_VERIFICATION,
    });

    // Generate tokens
    const tokens = jwtService.generateTokenPair(
      user._id.toString(),
      user.email,
      user.role,
      user.tenantId,
    );

    // Store refresh token
    await this.storeRefreshToken(
      user._id,
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
      ipAddress,
      userAgent,
    );

    logger.info(`New user registered: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Login user
   */
  public async login(
    input: LoginInput,
    ipAddress: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const { email, password } = input;

    // Find user with password
    const user = await User.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Check if account is active
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedError("Account has been suspended");
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedError("Account is inactive");
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = jwtService.generateTokenPair(
      user._id.toString(),
      user.email,
      user.role,
      user.tenantId,
    );

    // Store refresh token
    await this.storeRefreshToken(
      user._id,
      tokens.refreshToken,
      tokens.refreshTokenExpiresAt,
      ipAddress,
      userAgent,
    );

    logger.info(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshTokens(
    refreshToken: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    // Find the refresh token
    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (!storedToken) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Check if token is active
    if (!storedToken.isActive) {
      // Token reuse detected - revoke all tokens for this user
      if (storedToken.isRevoked) {
        await this.revokeAllUserTokens(storedToken.userId, ipAddress);
        logger.warn(
          `Refresh token reuse detected for user: ${storedToken.userId}`,
        );
      }
      throw new UnauthorizedError("Invalid refresh token");
    }

    // Get user
    const user = await User.findById(storedToken.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError("User not found or inactive");
    }

    // Generate new tokens
    const newTokens = jwtService.generateTokenPair(
      user._id.toString(),
      user.email,
      user.role,
      user.tenantId,
    );

    // Revoke old token and store new one
    storedToken.revokedAt = new Date();
    storedToken.revokedByIp = ipAddress;
    storedToken.replacedByToken = newTokens.refreshToken;
    await storedToken.save();

    await this.storeRefreshToken(
      user._id,
      newTokens.refreshToken,
      newTokens.refreshTokenExpiresAt,
      ipAddress,
      userAgent,
    );

    return newTokens;
  }

  /**
   * Logout user (revoke refresh token)
   */
  public async logout(refreshToken: string, ipAddress: string): Promise<void> {
    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (storedToken && storedToken.isActive) {
      storedToken.revokedAt = new Date();
      storedToken.revokedByIp = ipAddress;
      await storedToken.save();

      // Invalidate user cache
      await this.invalidateUserCache(storedToken.userId.toString());
    }

    logger.info("User logged out");
  }

  /**
   * Logout from all devices
   */
  public async logoutAll(userId: string, ipAddress: string): Promise<void> {
    await this.revokeAllUserTokens(new Types.ObjectId(userId), ipAddress);
    await this.invalidateUserCache(userId);
    logger.info(`User logged out from all devices: ${userId}`);
  }

  /**
   * Verify email
   */
  public async verifyEmail(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    if (user.emailVerified) {
      throw new BadRequestError("Email already verified");
    }

    user.emailVerified = true;
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      user.status = UserStatus.ACTIVE;
    }
    await user.save();

    logger.info(`Email verified for user: ${user.email}`);
  }

  /**
   * Request password reset
   */
  public async requestPasswordReset(email: string): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists
      return "If the email exists, a reset link will be sent";
    }

    // Generate reset token
    const resetToken = jwtService.generateRefreshToken();

    // Store in Redis with 1 hour expiry
    await redis.set(`password_reset:${resetToken}`, user._id.toString(), 3600);

    // TODO: Send email with reset link
    logger.info(`Password reset requested for: ${email}`);

    return resetToken; // In production, don't return this - send via email
  }

  /**
   * Reset password
   */
  public async resetPassword(
    resetToken: string,
    newPassword: string,
    ipAddress: string,
  ): Promise<void> {
    // Get user ID from Redis
    const userId = await redis.get<string>(`password_reset:${resetToken}`);
    if (!userId) {
      throw new BadRequestError("Invalid or expired reset token");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Delete reset token
    await redis.del(`password_reset:${resetToken}`);

    // Revoke all refresh tokens
    await this.revokeAllUserTokens(user._id, ipAddress);

    logger.info(`Password reset completed for: ${user.email}`);
  }

  /**
   * Change password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress: string,
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new NotFoundError("User");
    }

    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new BadRequestError("Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Revoke all refresh tokens except current session
    await this.revokeAllUserTokens(user._id, ipAddress);

    logger.info(`Password changed for user: ${user.email}`);
  }

  /**
   * Get user by ID
   */
  public async getUserById(userId: string): Promise<IUser | null> {
    // Try cache first
    const cacheKey = `user:${userId}`;
    const cached = await redis.get<IUser>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await User.findById(userId);
    if (user) {
      await redis.set(cacheKey, user.toJSON(), 300); // 5 min cache
    }

    return user;
  }

  // Private helper methods

  private async storeRefreshToken(
    userId: Types.ObjectId,
    token: string,
    expiresAt: Date,
    ipAddress: string,
    userAgent?: string,
  ): Promise<IRefreshToken> {
    return RefreshToken.create({
      userId,
      token,
      expiresAt,
      createdByIp: ipAddress,
      userAgent,
    });
  }

  private async revokeAllUserTokens(
    userId: Types.ObjectId,
    ipAddress: string,
  ): Promise<void> {
    await RefreshToken.updateMany(
      { userId, revokedAt: { $exists: false } },
      { revokedAt: new Date(), revokedByIp: ipAddress },
    );
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    await redis.del(`user:${userId}`);
  }

  private sanitizeUser(user: IUser): Partial<IUser> {
    const userObj = user.toJSON();
    delete (userObj as Record<string, unknown>).password;
    return userObj;
  }
}

export const authService = new AuthService();
