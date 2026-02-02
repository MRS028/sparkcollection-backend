/**
 * Redis Configuration
 * Handles Redis connection for caching and session management
 */

import { createClient, RedisClientType } from "redis";
import { config } from "./index.js";
import { logger } from "../shared/utils/logger.js";

class RedisClient {
  private static instance: RedisClient;
  private client: RedisClientType | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      logger.info("Redis already connected");
      return;
    }

    try {
      const redisUrl = config.redis.password
        ? `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}/${config.redis.db}`
        : `redis://${config.redis.host}:${config.redis.port}/${config.redis.db}`;

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis max retries reached");
              return new Error("Redis max retries reached");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.setupEventListeners();

      await this.client.connect();
      this.isConnected = true;
      logger.info("✅ Redis connected successfully");
    } catch (error) {
      logger.error("❌ Redis connection failed:", error);
      // Don't exit - Redis is optional for basic functionality
      logger.warn("Application will continue without Redis caching");
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info("Redis disconnected");
    }
  }

  public getClient(): RedisClientType | null {
    return this.client;
  }

  public isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Cache operations
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isReady()) return null;
    try {
      const data = await this.client!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  public async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, stringValue);
      } else {
        await this.client!.set(key, stringValue);
      }
      return true;
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  public async delPattern(pattern: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(keys);
      }
      return true;
    } catch (error) {
      logger.error(`Redis DEL pattern error for ${pattern}:`, error);
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    if (!this.isReady()) return -1;
    try {
      return await this.client!.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
  }

  public async incr(key: string): Promise<number | null> {
    if (!this.isReady()) return null;
    try {
      return await this.client!.incr(key);
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      return null;
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      await this.client!.expire(key, seconds);
      return true;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on("error", (error) => {
      logger.error("Redis client error:", error);
    });

    this.client.on("reconnecting", () => {
      logger.info("Redis client reconnecting...");
    });

    this.client.on("ready", () => {
      logger.info("Redis client ready");
    });
  }
}

export const redis = RedisClient.getInstance();
