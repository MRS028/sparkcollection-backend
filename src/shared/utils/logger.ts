/**
 * Winston Logger Configuration
 * Provides structured logging with file and console transports
 */

import winston from "winston";
import path from "path";
import { config } from "../../config/index.js";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(
  ({ level, message, timestamp, stack, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    const stackString = stack ? `\n${stack}` : "";
    return `${timestamp} [${level}]: ${message}${metaString ? `\n${metaString}` : ""}${stackString}`;
  },
);

// Custom format for file output
const fileFormat = printf(({ level, message, timestamp, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta,
  });
});

// Create logs directory path
const logsDir = path.resolve(process.cwd(), config.logging.filePath);

// Logger configuration
const loggerConfig: winston.LoggerOptions = {
  level: config.logging.level,
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
  ),
  defaultMeta: { service: config.app.name },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        consoleFormat,
      ),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: combine(colorize({ all: true }), consoleFormat),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: combine(colorize({ all: true }), consoleFormat),
    }),
  ],
};

// Add file transports in production
if (config.app.isProduction) {
  loggerConfig.transports = [
    ...(loggerConfig.transports as winston.transport[]),
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      format: combine(json(), fileFormat),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      format: combine(json(), fileFormat),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ];

  loggerConfig.exceptionHandlers = [
    ...(loggerConfig.exceptionHandlers as winston.transport[]),
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ];
}

// Create and export logger instance
export const logger = winston.createLogger(loggerConfig);

// Stream for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper methods for structured logging
export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

export const logRequest = (
  method: string,
  url: string,
  statusCode: number,
  responseTime: number,
  context?: Record<string, unknown>,
) => {
  logger.http(`${method} ${url} ${statusCode} - ${responseTime}ms`, context);
};

export const logAudit = (
  action: string,
  userId: string,
  resource: string,
  details?: Record<string, unknown>,
) => {
  logger.info(`AUDIT: ${action}`, {
    userId,
    resource,
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
};
