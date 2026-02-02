/**
 * User Service
 * Business logic for user management
 */

import { Types } from "mongoose";
import {
  userRepository,
  UserFilters,
} from "../repositories/user.repository.js";
import {
  IUser,
  UserRole,
  UserStatus,
  PaginatedResult,
  PaginationOptions,
  IAddress,
} from "../../../shared/types/index.js";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../../shared/errors/index.js";
import { redis } from "../../../config/redis.js";
import { logger } from "../../../shared/utils/logger.js";

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phone?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}

class UserService {
  private readonly cachePrefix = "user:";
  private readonly cacheTTL = 300; // 5 minutes

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<IUser> {
    // Check if email already exists
    const emailExists = await userRepository.emailExists(input.email);
    if (emailExists) {
      throw new ConflictError("Email already registered");
    }

    const user = await userRepository.create({
      email: input.email.toLowerCase(),
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role || UserRole.CUSTOMER,
      phone: input.phone,
    });

    logger.info(`User created: ${user.email}`);
    return user;
  }

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<IUser> {
    // Try cache first
    const cached = await redis.get<IUser>(`${this.cachePrefix}${id}`);
    if (cached) {
      return cached;
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Cache the user
    await redis.set(`${this.cachePrefix}${id}`, user.toJSON(), this.cacheTTL);

    return user;
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<IUser> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError("User");
    }
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(id: string, input: UpdateUserInput): Promise<IUser> {
    const user = await userRepository.updateById(id, input);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Invalidate cache
    await this.invalidateCache(id);

    logger.info(`User updated: ${user.email}`);
    return user;
  }

  /**
   * Update user role (admin only)
   */
  async updateRole(id: string, role: UserRole): Promise<IUser> {
    const user = await userRepository.updateById(id, { role });
    if (!user) {
      throw new NotFoundError("User");
    }

    await this.invalidateCache(id);
    logger.info(`User role updated: ${user.email} -> ${role}`);
    return user;
  }

  /**
   * Update user status
   */
  async updateStatus(id: string, status: UserStatus): Promise<IUser> {
    const user = await userRepository.updateStatus(id, status);
    if (!user) {
      throw new NotFoundError("User");
    }

    await this.invalidateCache(id);
    logger.info(`User status updated: ${user.email} -> ${status}`);
    return user;
  }

  /**
   * Delete user (soft delete)
   */
  async delete(id: string): Promise<void> {
    const user = await userRepository.softDelete(id);
    if (!user) {
      throw new NotFoundError("User");
    }

    await this.invalidateCache(id);
    logger.info(`User deleted: ${user.email}`);
  }

  /**
   * Hard delete user (permanent)
   */
  async hardDelete(id: string): Promise<void> {
    const user = await userRepository.deleteById(id);
    if (!user) {
      throw new NotFoundError("User");
    }

    await this.invalidateCache(id);
    logger.info(`User permanently deleted: ${user.email}`);
  }

  /**
   * Get all users with filters and pagination
   */
  async getAll(
    filters: UserFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IUser>> {
    return userRepository.findWithFilters(filters, options);
  }

  /**
   * Get users by role
   */
  async getByRole(role: UserRole): Promise<IUser[]> {
    return userRepository.findByRole(role);
  }

  /**
   * Get user statistics
   */
  async getStatistics(tenantId?: string) {
    return userRepository.getStatistics(tenantId);
  }

  /**
   * Verify email
   */
  async verifyEmail(id: string): Promise<IUser> {
    const user = await userRepository.verifyEmail(id);
    if (!user) {
      throw new NotFoundError("User");
    }

    await this.invalidateCache(id);
    logger.info(`Email verified: ${user.email}`);
    return user;
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(
    email: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    return !(await userRepository.emailExists(email, excludeUserId));
  }

  /**
   * Invalidate user cache
   */
  private async invalidateCache(id: string): Promise<void> {
    await redis.del(`${this.cachePrefix}${id}`);
  }
}

export const userService = new UserService();
