/**
 * Custom Error Classes
 * Provides structured error handling across the application
 */

export interface ErrorDetails {
  [key: string]: unknown;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
  code?: string;
}

// Base Application Error
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly details?: ErrorDetails;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: ErrorDetails,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AppError.prototype);
  }

  public toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    };
  }
}

// 400 Bad Request
export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", details?: ErrorDetails) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", details?: ErrorDetails) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", details?: ErrorDetails) {
    super(message, 403, "FORBIDDEN", details);
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(resource: string = "Resource", details?: ErrorDetails) {
    super(`${resource} not found`, 404, "NOT_FOUND", details);
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  constructor(
    message: string = "Resource already exists",
    details?: ErrorDetails,
  ) {
    super(message, 409, "CONFLICT", details);
  }
}

// 422 Validation Error
export class ValidationError extends AppError {
  public readonly errors: ValidationErrorItem[];

  constructor(
    errors: ValidationErrorItem[],
    message: string = "Validation failed",
  ) {
    super(message, 422, "VALIDATION_ERROR", { errors });
    this.errors = errors;
  }

  public static fromZodError(zodError: {
    errors: Array<{ path: (string | number)[]; message: string }>;
  }): ValidationError {
    const errors: ValidationErrorItem[] = zodError.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    return new ValidationError(errors);
  }
}

// 429 Too Many Requests
export class TooManyRequestsError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, message: string = "Too many requests") {
    super(message, 429, "TOO_MANY_REQUESTS", { retryAfter });
    this.retryAfter = retryAfter;
  }
}

// 500 Internal Server Error
export class InternalError extends AppError {
  constructor(
    message: string = "Internal server error",
    details?: ErrorDetails,
  ) {
    super(message, 500, "INTERNAL_ERROR", details);
  }
}

// 502 Bad Gateway (for external service failures)
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string = "External service error",
    details?: ErrorDetails,
  ) {
    super(message, 502, "EXTERNAL_SERVICE_ERROR", { service, ...details });
    this.service = service;
  }
}

// 503 Service Unavailable
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = "Service temporarily unavailable",
    details?: ErrorDetails,
  ) {
    super(message, 503, "SERVICE_UNAVAILABLE", details);
  }
}

// Payment-related errors
export class PaymentError extends AppError {
  public readonly paymentCode: string;

  constructor(
    message: string,
    paymentCode: string = "PAYMENT_FAILED",
    details?: ErrorDetails,
  ) {
    super(message, 402, "PAYMENT_ERROR", { paymentCode, ...details });
    this.paymentCode = paymentCode;
  }
}

// Database errors
export class DatabaseError extends AppError {
  constructor(
    message: string = "Database operation failed",
    details?: ErrorDetails,
  ) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}

// Authentication errors
export class TokenExpiredError extends UnauthorizedError {
  constructor(message: string = "Token has expired") {
    super(message, { code: "TOKEN_EXPIRED" });
  }
}

export class InvalidTokenError extends UnauthorizedError {
  constructor(message: string = "Invalid token") {
    super(message, { code: "INVALID_TOKEN" });
  }
}

// Type guard for AppError
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

// Type guard for operational errors
export const isOperationalError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};
