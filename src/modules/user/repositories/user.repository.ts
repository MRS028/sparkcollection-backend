/**
 * User Repository
 * Data access layer for user operations
 */

import { FilterQuery, UpdateQuery, Types } from "mongoose";
import { User } from "../models/User.model.js";
import {
  IUser,
  Role,
  UserStatus,
  PaginatedResult,
  PaginationOptions,
} from "../../../shared/types/index.js";

export interface UserFilters {
  role?: Role;
  status?: UserStatus;
  emailVerified?: boolean;
  search?: string;
  tenantId?: string;
}

class UserRepository {
  /**
   * Create a new user
   */
  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return (await user.save()) as unknown as IUser;
  }

  /**
   * Find user by ID
   */
  async findById(id: string | Types.ObjectId): Promise<IUser | null> {
    return User.findById(id);
  }

  /**
   * Find user by ID with password
   */
  async findByIdWithPassword(
    id: string | Types.ObjectId,
  ): Promise<IUser | null> {
    return User.findById(id).select("+password");
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find user by email with password
   */
  async findByEmailWithPassword(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() }).select("+password");
  }

  /**
   * Update user by ID
   */
  async updateById(
    id: string | Types.ObjectId,
    updateData: UpdateQuery<IUser>,
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete user by ID
   */
  async deleteById(id: string | Types.ObjectId): Promise<IUser | null> {
    return User.findByIdAndDelete(id);
  }

  /**
   * Soft delete user (set isDeleted to true and isActive to false)
   */
  async softDelete(id: string | Types.ObjectId): Promise<IUser | null> {
    return this.updateById(id, {
      isDeleted: true,
      isActive: UserStatus.INACTIVE,
    });
  }

  /**
   * Find users with filters and pagination
   */
  async findWithFilters(
    filters: UserFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IUser>> {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;
    const skip = (page - 1) * limit;

    // Build filter query
    const query: FilterQuery<IUser> = {};

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.emailVerified !== undefined) {
      query.emailVerified = filters.emailVerified;
    }

    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }

    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: "i" } },
        { lastName: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Build sort object
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    // Execute queries
    const [users, total] = await Promise.all([
      User.find(query).sort(sort).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users as unknown as IUser[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Find users by role
   */
  async findByRole(role: Role): Promise<IUser[]> {
    return User.find({ role });
  }

  /**
   * Count users with filters
   */
  async count(filters: FilterQuery<IUser> = {}): Promise<number> {
    return User.countDocuments(filters);
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const query: FilterQuery<IUser> = { email: email.toLowerCase() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const user = await User.findOne(query).select("_id");
    return !!user;
  }

  /**
   * Update user status
   */
  async updateStatus(
    id: string | Types.ObjectId,
    status: UserStatus,
  ): Promise<IUser | null> {
    return this.updateById(id, { status });
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string | Types.ObjectId): Promise<IUser | null> {
    return this.updateById(id, {
      emailVerified: true,
      status: UserStatus.ACTIVE,
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(id: string | Types.ObjectId): Promise<void> {
    await User.findByIdAndUpdate(id, { lastLogin: new Date() });
  }

  /**
   * Get user statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    byRole: Record<Role, number>;
    byStatus: Record<UserStatus, number>;
    newThisMonth: number;
  }> {
    const baseFilter = tenantId ? { tenantId } : {};
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, byRole, byStatus, newThisMonth] = await Promise.all([
      User.countDocuments(baseFilter),
      this.countByRole(baseFilter),
      this.countByStatus(baseFilter),
      User.countDocuments({ ...baseFilter, createdAt: { $gte: startOfMonth } }),
    ]);

    return { total, byRole, byStatus, newThisMonth };
  }

  private async countByRole(
    baseFilter: FilterQuery<IUser>,
  ): Promise<Record<Role, number>> {
    const result = await User.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const counts = {} as Record<Role, number>;
    for (const role of Object.values(Role)) {
      const found = result.find((r) => r._id === role);
      counts[role] = found ? found.count : 0;
    }
    return counts;
  }

  private async countByStatus(
    baseFilter: FilterQuery<IUser>,
  ): Promise<Record<UserStatus, number>> {
    const result = await User.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = {} as Record<UserStatus, number>;
    for (const status of Object.values(UserStatus)) {
      const found = result.find((r) => r._id === status);
      counts[status] = found ? found.count : 0;
    }
    return counts;
  }
}

export const userRepository = new UserRepository();
