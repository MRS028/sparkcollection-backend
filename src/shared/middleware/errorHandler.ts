/**
 * Global Error Handling Middleware
 * Catches all errors and formats them consistently
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import {
  AppError,
  ValidationError,
  InternalError,
  isOperationalError,
} from "../errors/index.js";
import { logger, logError } from "../utils/logger.js";
import { config } from "../../config/index.js";

interface MongoError extends Error {
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
}

/**
 * Handle Zod validation errors
 */
const handleZodError = (error: ZodError): ValidationError => {
  return ValidationError.fromZodError(error);
};

/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateKeyError = (error: MongoError): AppError => {
  const field = Object.keys(error.keyPattern || {})[0] || "field";
  const value = error.keyValue ? error.keyValue[field] : "value";
  return new AppError(
    `Duplicate value for ${field}: ${value}. Please use another value.`,
    409,
    "DUPLICATE_KEY",
  );
};

/**
 * Handle MongoDB validation errors
 */
const handleMongooseValidationError = (
  error: mongoose.Error.ValidationError,
): ValidationError => {
  const errors = Object.values(error.errors).map((err) => ({
    field: err.path,
    message: err.message,
  }));
  return new ValidationError(errors);
};

/**
 * Handle MongoDB CastError (invalid ObjectId)
 */
const handleCastError = (error: mongoose.Error.CastError): AppError => {
  return new AppError(
    `Invalid ${error.path}: ${error.value}`,
    400,
    "INVALID_ID",
  );
};

/**
 * Handle JWT errors
 */
const handleJWTError = (): AppError => {
  return new AppError(
    "Invalid token. Please log in again.",
    401,
    "INVALID_TOKEN",
  );
};

const handleJWTExpiredError = (): AppError => {
  return new AppError(
    "Token has expired. Please log in again.",
    401,
    "TOKEN_EXPIRED",
  );
};

/**
 * Send error response in development
 */
const sendDevError = (error: AppError, res: Response): void => {
  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack,
      timestamp: error.timestamp.toISOString(),
    },
  });
};

/**
 * Send error response in production
 */
const sendProdError = (error: AppError, res: Response): void => {
  // Operational, trusted error: send message to client
  if (error.isOperational) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        timestamp: error.timestamp.toISOString(),
      },
    });
  } else {
    // Programming or unknown error: don't leak error details
    logError(error, { type: "UNKNOWN_ERROR" });
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again later.",
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Global Error Handler Middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let error: AppError;

  // Log all errors
  if (!isOperationalError(err)) {
    logError(err, {
      url: _req.originalUrl,
      method: _req.method,
      body: _req.body,
      params: _req.params,
      query: _req.query,
    });
  } else {
    logger.warn(`Operational error: ${err.message}`, {
      code: (err as AppError).code,
      statusCode: (err as AppError).statusCode,
    });
  }

  // Handle known error types
  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = handleZodError(err);
  } else if ((err as MongoError).code === 11000) {
    error = handleDuplicateKeyError(err as MongoError);
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = handleMongooseValidationError(err);
  } else if (err instanceof mongoose.Error.CastError) {
    error = handleCastError(err);
  } else if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  } else if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  } else {
    // Unknown error
    error = new InternalError(
      config.app.isDevelopment ? err.message : "Internal server error",
    );
    error.stack = err.stack;
  }

  // Send appropriate response based on environment
  if (config.app.isDevelopment) {
    sendDevError(error, res);
  } else {
    sendProdError(error, res);
  }
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    "ROUTE_NOT_FOUND",
  );
  next(error);
};
