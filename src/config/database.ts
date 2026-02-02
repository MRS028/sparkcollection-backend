/**
 * Database Configuration
 * Handles MongoDB connection with retry logic and event handling
 */

import mongoose from "mongoose";
import { config } from "./index.js";
import { logger } from "../shared/utils/logger.js";

interface ConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
}

class Database {
  private static instance: Database;
  private isConnected = false;
  private retryCount = 0;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(options: ConnectionOptions = {}): Promise<void> {
    const { maxRetries = 5, retryDelay = 5000 } = options;

    if (this.isConnected) {
      logger.info("Database already connected");
      return;
    }

    try {
      // Mongoose connection options
      const mongooseOptions: mongoose.ConnectOptions = {
        maxPoolSize: 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4
      };

      // Set up event listeners before connecting
      this.setupEventListeners();

      logger.info(
        `Connecting to MongoDB: ${this.maskConnectionString(config.db.uri)}`,
      );

      await mongoose.connect(config.db.uri, mongooseOptions);

      this.isConnected = true;
      this.retryCount = 0;
      logger.info("✅ MongoDB connected successfully");
    } catch (error) {
      this.retryCount++;
      logger.error(
        `❌ MongoDB connection attempt ${this.retryCount} failed:`,
        error,
      );

      if (this.retryCount < maxRetries) {
        logger.info(`Retrying in ${retryDelay / 1000} seconds...`);
        await this.delay(retryDelay);
        return this.connect(options);
      }

      logger.error("Max retry attempts reached. Exiting...");
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info("MongoDB disconnected");
    } catch (error) {
      logger.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  public getConnection(): mongoose.Connection {
    return mongoose.connection;
  }

  public isConnectionReady(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private setupEventListeners(): void {
    const connection = mongoose.connection;

    connection.on("connected", () => {
      logger.info("Mongoose connected to MongoDB");
    });

    connection.on("error", (error) => {
      logger.error("Mongoose connection error:", error);
    });

    connection.on("disconnected", () => {
      logger.warn("Mongoose disconnected from MongoDB");
      this.isConnected = false;
    });

    connection.on("reconnected", () => {
      logger.info("Mongoose reconnected to MongoDB");
      this.isConnected = true;
    });

    // Handle application termination
    process.on("SIGINT", async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  private maskConnectionString(uri: string): string {
    // Mask password in connection string for logging
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const database = Database.getInstance();
