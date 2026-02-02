/**
 * Server Entry Point
 * Application startup and graceful shutdown
 */

import http from "http";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { redis } from "./config/redis.js";
import { logger } from "./shared/utils/logger.js";

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

/**
 * Start server
 */
async function startServer(): Promise<void> {
  try {
    // Connect to database
    logger.info("Connecting to database...");
    await connectDatabase();
    logger.info("Database connected successfully");

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = http.createServer(app);

    // Start listening
    server.listen(config.server.port, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 SaaS eCommerce Backend Server Started!              ║
║                                                          ║
║   Environment: ${config.server.env.padEnd(38)}║
║   Port: ${config.server.port.toString().padEnd(46)}║
║   API: http://localhost:${config.server.port}/api/v1${"".padEnd(26)}║
║   Health: http://localhost:${config.server.port}/health${"".padEnd(23)}║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async (err) => {
        if (err) {
          logger.error("Error during server close:", err);
        }

        try {
          // Disconnect from database
          logger.info("Closing database connection...");
          await disconnectDatabase();
          logger.info("Database connection closed");

          // Disconnect from Redis
          logger.info("Closing Redis connection...");
          await redis.disconnect();
          logger.info("Redis connection closed");

          logger.info("Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          logger.error("Error during graceful shutdown:", error);
          process.exit(1);
        }
      });

      // Force exit after timeout
      setTimeout(() => {
        logger.error(
          "Could not close connections in time, forcefully shutting down",
        );
        process.exit(1);
      }, 10000); // 10 seconds timeout
    };

    // Register shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle server errors
    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      switch (error.code) {
        case "EACCES":
          logger.error(
            `Port ${config.server.port} requires elevated privileges`,
          );
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`Port ${config.server.port} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
