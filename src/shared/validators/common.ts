/**
 * Common Zod Validation Schemas
 * Reusable validation schemas across modules
 */

import { z } from "zod";
import { Types } from "mongoose";

// MongoDB ObjectId validation
export const objectIdSchema = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
  });

// Email validation
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .toLowerCase()
  .trim();

// Password validation (strong password policy)
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must not exceed 100 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  );

// Phone number validation
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
  .optional();

// Pagination query schema
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform(Number)
    .refine((val) => val > 0, "Page must be a positive number"),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform(Number)
    .refine((val) => val > 0 && val <= 100, "Limit must be between 1 and 100"),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Search query schema
export const searchSchema = z
  .object({
    q: z.string().optional(),
    search: z.string().optional(),
  })
  .merge(paginationSchema);

// Date range schema
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: "Start date must be before end date" },
  );

// Address schema
export const addressSchema = z.object({
  type: z.enum(["shipping", "billing"]).default("shipping"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  company: z.string().max(100).optional(),
  addressLine1: z.string().min(1, "Address is required").max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(2, "Country is required").max(2).default("IN"),
  phone: z.string().min(10, "Phone number is required"),
  isDefault: z.boolean().default(false),
});

// Price/Money schema
export const moneySchema = z.object({
  amount: z.number().min(0, "Amount must be non-negative"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("INR"),
});

// URL schema
export const urlSchema = z.string().url("Invalid URL format");

// Slug schema
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format")
  .min(1)
  .max(200);

// UUID schema
export const uuidSchema = z.string().uuid("Invalid UUID format");

// File upload schema
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024, "File size must not exceed 10MB"),
  buffer: z.instanceof(Buffer).optional(),
  path: z.string().optional(),
});

// Image validation
export const imageFileSchema = fileUploadSchema.refine(
  (file) =>
    ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.mimetype,
    ),
  { message: "Only JPEG, PNG, WebP, and GIF images are allowed" },
);

// Common ID params schema
export const idParamsSchema = z.object({
  id: objectIdSchema,
});

// Status filter schema
export const statusFilterSchema = z.object({
  status: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Name schema
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must not exceed 100 characters")
  .trim();

// Description schema
export const descriptionSchema = z
  .string()
  .max(5000, "Description must not exceed 5000 characters")
  .optional();

// Percentage schema
export const percentageSchema = z
  .number()
  .min(0, "Percentage must be at least 0")
  .max(100, "Percentage must not exceed 100");

// Quantity schema
export const quantitySchema = z
  .number()
  .int("Quantity must be an integer")
  .min(0, "Quantity must be non-negative");

// SKU schema
export const skuSchema = z
  .string()
  .min(1, "SKU is required")
  .max(50, "SKU must not exceed 50 characters")
  .regex(
    /^[A-Z0-9-_]+$/i,
    "SKU can only contain letters, numbers, hyphens, and underscores",
  );

export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type MoneyInput = z.infer<typeof moneySchema>;
