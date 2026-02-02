/**
 * User Controller
 * Handles user management HTTP endpoints
 */

import { Response, NextFunction } from "express";
import { AuthRequest, UserStatus } from "../../../shared/types/index.js";
import { userService } from "../services/user.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
  sendText,
} from "../../../shared/utils/apiResponse.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {
  CreateUserInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserListQuery,
  UpdateRoleInput,
  UpdateStatusInput,
} from "../validators/user.validator.js";
import { setAuthCookie, clearAuthCookies } from "../cookies/setCookies.js";
import { NotFoundError } from "@/shared/errors/index.js";

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user (admin only)
 * @access  Admin
 */
export const createUser = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const input: CreateUserInput = req.body;
    const user = await userService.create(input);

    sendCreated(res, { user }, "User created successfully");
  },
);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with filters
 * @access  Admin
 */
export const getUsers = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const query = req.query as unknown as UserListQuery;

    const result = await userService.getAll(
      {
        role: query.role,
        status: query.status,
        search: query.search,
        emailVerified: query.emailVerified,
        tenantId: req.tenantId,
      },
      {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );

    sendPaginated(
      res,
      result.data,
      result.pagination,
      "Users retrieved successfully",
    );
  },
);

/**
 * @route   GET /api/v1/users/statistics
 * @desc    Get user statistics
 * @access  Admin
 */
export const getUserStatistics = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const statistics = await userService.getStatistics(req.tenantId);

    sendSuccess(
      res,
      { statistics },
      { message: "Statistics retrieved successfully" },
    );
  },
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Admin or Self
 */
export const getUserById = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const user = await userService.getById(id);

    sendSuccess(res, { user }, { message: "User retrieved successfully" });
  },
);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update user (admin)
 * @access  Admin
 */
export const updateUser = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const input: UpdateUserInput = req.body;
    const user = await userService.updateProfile(id, input);

    sendSuccess(res, { user }, { message: "User updated successfully" });
  },
);

/**
 * @route   PATCH /api/v1/users/:id/role
 * @desc    Update user role
 * @access  Admin
 */
export const updateUserRole = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const { role }: UpdateRoleInput = req.body;
    const user = await userService.updateRole(id, role);

    sendSuccess(res, { user }, { message: "User role updated successfully" });
  },
);

/**
 * @route   PATCH /api/v1/users/:id/status
 * @desc    Update user status
 * @access  Admin
 */
export const updateUserStatus = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const { status }: UpdateStatusInput = req.body;
    const user = await userService.updateStatus(id, status);

    sendSuccess(res, { user }, { message: "User status updated successfully" });
  },
);

/**
 * @route   DELETE /api/v1/users/delete/:id
 * @desc    Soft delete user (sets isDeleted to true)
 * @access  Admin
 */
export const deleteUser = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    // Verify user exists before deleting
    const user = await userService.getById(id);
    // console.log("Deleting user:", );
    if (user.isDeleted === true) {
      return sendText(res,null, { message: "User already deleted." });
    }

    // Soft delete - set isDeleted to true
    await userService.delete(id);
    
    sendSuccess(res, null, {
      message: "User deleted successfully",
    });
  },
);

/**
 * @route   PATCH /api/v1/users/:id/ban
 * @desc    Ban user (sets status to BLOCKED)
 * @access  Admin
 */
export const banUser = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    // Verify user exists before banning
    const user = await userService.getById(id);
    if (
      !user ||
      user.status === UserStatus.BLOCKED
    ) {
      throw new NotFoundError("User");
    }

    // Ban user - set status to BLOCKED
    await userService.updateStatus(id, UserStatus.BLOCKED);

    sendSuccess(res, null, {
      message: "User has been banned successfully",
    });
  },
);

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
export const getProfile = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const user = await userService.getById(userId);

    sendSuccess(res, { user }, { message: "Profile retrieved successfully" });
  },
);

/**
 * @route   PATCH /api/v1/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    console.log("Updating profile for user ID:", userId);
    const input: UpdateProfileInput = req.body;
    const user = await userService.updateProfile(userId, input);
    sendSuccess(res, { user }, { message: "Profile updated successfully" });
  },
);
