/**
 * API Response Utilities
 * Provides consistent response formatting across all endpoints
 */

import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    [key: string]: unknown;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Send a successful response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  options?: {
    message?: string;
    statusCode?: number;
    meta?: {
      pagination?: PaginationMeta;
      [key: string]: unknown;
    };
  },
): Response => {
  const { message, statusCode = 200, meta } = options || {};

  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201)
 */
export const sendCreated = <T>(
  res: Response,
  data: T,
  message: string = "Resource created successfully",
): Response => {
  return sendSuccess(res, data, { message, statusCode: 201 });
};

/**
 * Send a no content response (204)
 */
export const sendNoContent = (res: Response): Response => {
  return res.status(204).send();
};

/**
 * Send paginated response
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  additionalData?: {
    message?: string;
    [key: string]: unknown;
  },
): Response => {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  const paginationMeta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };

  return sendSuccess(res, data, {
    message: additionalData?.message,
    meta: { pagination: paginationMeta, ...additionalData },
  });
};

/**
 * Send error response
 */
export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response => {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      statusCode,
      details,
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(response);
};

export const sendText = <T>(
  res: Response,
  data: T,
  options?: {
    message?: string;
    statusCode?: number;
    meta?: {
      pagination?: PaginationMeta;
      [key: string]: unknown;
    };
  },
): Response => {
  const { message, statusCode = 201, meta } = options || {};

  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    message,
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Helper to calculate pagination offset
 */
export const calculatePagination = (
  page: number = 1,
  limit: number = 10,
): { skip: number; limit: number; page: number } => {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
  const skip = (safePage - 1) * safeLimit;

  return { skip, limit: safeLimit, page: safePage };
};
