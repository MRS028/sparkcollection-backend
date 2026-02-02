/**
 * JWT Service
 * Handles JWT token generation and verification
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../../../config/index.js";
import { JwtPayload, UserRole } from "../../../shared/types/index.js";
import {
  InvalidTokenError,
  TokenExpiredError,
} from "../../../shared/errors/index.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface DecodedToken extends JwtPayload {
  iat: number;
  exp: number;
}

class JWTService {
  /**
   * Generate access token
   */
  public generateAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });
  }

  /**
   * Generate refresh token
   */
  public generateRefreshToken(): string {
    return crypto.randomBytes(64).toString("hex");
  }

  /**
   * Generate token pair (access + refresh)
   */
  public generateTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    tenantId?: string,
  ): TokenPair {
    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      userId,
      email,
      role,
      tenantId,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();

    // Calculate expiration dates
    const accessTokenExpiresAt = this.getExpirationDate(
      config.jwt.accessExpiry,
    );
    const refreshTokenExpiresAt = this.getExpirationDate(
      config.jwt.refreshExpiry,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Verify access token
   */
  public verifyAccessToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(
        token,
        config.jwt.accessSecret,
      ) as DecodedToken;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError("Access token has expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenError("Invalid access token");
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for expired tokens)
   */
  public decodeToken(token: string): DecodedToken | null {
    try {
      return jwt.decode(token) as DecodedToken;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  public isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    return Date.now() >= decoded.exp * 1000;
  }

  /**
   * Get expiration date from duration string
   */
  private getExpirationDate(duration: string): Date {
    const now = Date.now();
    const ms = this.parseDuration(duration);
    return new Date(now + ms);
  }

  /**
   * Parse duration string to milliseconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  /**
   * Extract token from Authorization header
   */
  public extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    return authHeader.substring(7);
  }
}

export const jwtService = new JWTService();
