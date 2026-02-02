/**
 * User Validation Schemas
 */

import { z } from "zod";
import {
  emailSchema,
  phoneSchema,
  nameSchema,
  paginationSchema,
  objectIdSchema,
} from "../../../shared/validators/index.js";
import { UserRole, UserStatus } from "../../../shared/types/index.js";

// Create user validation (admin)
export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: nameSchema,
  lastName: nameSchema,
  role: z.nativeEnum(UserRole).optional(),
  phone: phoneSchema,
});

// Update profile validation
export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema,
  avatar: z.string().url("Invalid avatar URL").optional(),
});

// Update user validation (admin)
export const updateUserSchema = updateProfileSchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

// User ID params
export const userIdParamsSchema = z.object({
  id: objectIdSchema,
});

// User list query
export const userListQuerySchema = paginationSchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
  emailVerified: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Update role validation
export const updateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

// Update status validation
export const updateStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

// Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
