/**
 * Express App Configuration
 * Main application setup with middleware and routes
 */

import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import { config } from "./config/index.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import {
  defaultLimiter,
  authLimiter,
  apiLimiter,
} from "./shared/middleware/rateLimiter.js";
import { logger } from "./shared/utils/logger.js";
import { NotFoundError } from "./shared/errors/index.js";

// Route imports
import { authRoutes } from "./modules/auth/index.js";
import { userRoutes } from "./modules/user/index.js";
import { productRoutes } from "./modules/product/index.js";
import { cartRoutes } from "./modules/cart/index.js";
import { orderRoutes } from "./modules/order/index.js";
import { paymentRoutes } from "./modules/payment/index.js";
import { shippingRoutes } from "./modules/shipping/index.js";
import { supportRoutes } from "./modules/support/index.js";

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ==================== Security Middleware ====================

  // Helmet - Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS configuration
  app.use(
    cors({
      origin: config.server.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Session-ID",
        "X-Tenant-ID",
      ],
      exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
    }),
  );

  // ==================== Body Parsing ====================

  // Stripe webhook needs raw body - must be before JSON parser
  app.use(
    "/api/v1/payments/webhook",
    express.raw({ type: "application/json" }),
  );

  // JSON body parser
  app.use(express.json({ limit: "10mb" }));

  // URL encoded body parser
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Cookie parser
  app.use(cookieParser());

  // ==================== Security & Performance ====================

  // Sanitize MongoDB queries
  app.use(mongoSanitize());

  // Compression
  app.use(compression());

  // ==================== Request Logging ====================

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };

      if (res.statusCode >= 400) {
        logger.warn("HTTP Request", logData);
      } else if (config.server.env === "development") {
        logger.info("HTTP Request", logData);
      }
    });

    next();
  });

  // ==================== Rate Limiting ====================

  // Apply default rate limiter to all routes
  app.use(defaultLimiter);

  // Stricter rate limiting for auth routes
  app.use("/api/v1/auth", authLimiter);

  // ==================== Health Check ====================

  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.server.env,
    });
  });

  app.get("/api/health", (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "API is healthy",
      version: "v1",
      timestamp: new Date().toISOString(),
    });
  });

  // ==================== API Routes ====================

  const apiV1 = "/api/v1";

  // Auth routes
  app.use(`${apiV1}/auth`, authRoutes);

  // User routes
  app.use(`${apiV1}/users`, userRoutes);

  // Product routes
  app.use(`${apiV1}/products`, productRoutes);

  // Cart routes
  app.use(`${apiV1}/cart`, cartRoutes);

  // Order routes
  app.use(`${apiV1}/orders`, orderRoutes);

  // Payment routes
  app.use(`${apiV1}/payments`, paymentRoutes);

  // Shipping routes
  app.use(`${apiV1}/shipping`, shippingRoutes);

  // Support routes (tickets + AI chat)
  app.use(`${apiV1}/support`, supportRoutes);

  // ==================== API Documentation ====================

  app.get("/api", (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: "SaaS eCommerce Backend API",
      version: "v1",
      documentation: "/api/docs",
      endpoints: {
        auth: `${apiV1}/auth`,
        users: `${apiV1}/users`,
        products: `${apiV1}/products`,
        cart: `${apiV1}/cart`,
        orders: `${apiV1}/orders`,
        payments: `${apiV1}/payments`,
        shipping: `${apiV1}/shipping`,
        support: `${apiV1}/support`,
      },
    });
  });

  // ==================== 404 Handler ====================

  app.use((req: Request, res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.path}`));
  });

  // ==================== Global Error Handler ====================

  app.use(errorHandler);

  return app;
}

export default createApp;
