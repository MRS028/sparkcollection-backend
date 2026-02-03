/**
 * Refresh Token Model
 * Stores refresh tokens for JWT authentication
 */

import mongoose, { Schema, Document, Types } from "mongoose";

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdByIp: string;
  revokedAt?: Date;
  revokedByIp?: string;
  replacedByToken?: string;
  userAgent?: string;
  isExpired: boolean;
  isRevoked: boolean;
  isActive: boolean;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      // index: true, // Removed - using TTL index below instead
    },
    createdByIp: {
      type: String,
      required: true,
    },
    revokedAt: {
      type: Date,
    },
    revokedByIp: {
      type: String,
    },
    replacedByToken: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

// Virtual to check if token is expired
refreshTokenSchema.virtual("isExpired").get(function (this: IRefreshToken) {
  return Date.now() >= this.expiresAt.getTime();
});

// Virtual to check if token is revoked
refreshTokenSchema.virtual("isRevoked").get(function (this: IRefreshToken) {
  return this.revokedAt !== undefined;
});

// Virtual to check if token is active
refreshTokenSchema.virtual("isActive").get(function (this: IRefreshToken) {
  return !this.isRevoked && !this.isExpired;
});

// Index for cleanup of expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for finding active tokens
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export const RefreshToken = mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema,
);
