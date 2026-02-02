/**
 * Shared Types and Interfaces
 */

import { Request } from "express";
import { Document, Types } from "mongoose";

// User Roles
export enum UserRole {
  ADMIN = "admin",
  SELLER = "seller",
  CUSTOMER = "customer",
  SUPPORT_AGENT = "support_agent",
}

// User Status
export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  PENDING_VERIFICATION = "pending_verification",
}

// Base User Interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLogin?: Date;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  iat?: number;
  exp?: number;
}

// Authenticated Request
export interface AuthRequest extends Request {
  user?: JwtPayload;
  tenantId?: string;
}

// Pagination Options
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Paginated Result
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Query Filter
export interface QueryFilter {
  [key: string]: unknown;
}

// Sorting Options
export interface SortOptions {
  [key: string]: 1 | -1;
}

// Address Interface
export interface IAddress {
  _id?: Types.ObjectId;
  type: "shipping" | "billing";
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

// Money/Price Interface
export interface IMoney {
  amount: number;
  currency: string;
}

// Date Range
export interface DateRange {
  start: Date;
  end: Date;
}

// File Upload Result
export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
}

// Service Response
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Event Types for Event-Driven Architecture
export enum EventType {
  // User Events
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
  USER_VERIFIED = "user.verified",

  // Auth Events
  AUTH_LOGIN = "auth.login",
  AUTH_LOGOUT = "auth.logout",
  AUTH_PASSWORD_RESET = "auth.password_reset",

  // Product Events
  PRODUCT_CREATED = "product.created",
  PRODUCT_UPDATED = "product.updated",
  PRODUCT_DELETED = "product.deleted",
  PRODUCT_STOCK_LOW = "product.stock_low",

  // Order Events
  ORDER_CREATED = "order.created",
  ORDER_UPDATED = "order.updated",
  ORDER_CANCELLED = "order.cancelled",
  ORDER_COMPLETED = "order.completed",
  ORDER_SHIPPED = "order.shipped",
  ORDER_DELIVERED = "order.delivered",

  // Payment Events
  PAYMENT_INITIATED = "payment.initiated",
  PAYMENT_SUCCESS = "payment.success",
  PAYMENT_FAILED = "payment.failed",
  PAYMENT_REFUNDED = "payment.refunded",

  // Cart Events
  CART_UPDATED = "cart.updated",
  CART_ABANDONED = "cart.abandoned",

  // Support Events
  TICKET_CREATED = "ticket.created",
  TICKET_UPDATED = "ticket.updated",
  TICKET_RESOLVED = "ticket.resolved",
}

// Webhook Event
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  signature?: string;
}
