/**
 * Coupon Validators
 * Zod schemas for coupon operations
 */

import { z } from "zod";
import { objectIdSchema } from "../../../shared/validators/common.js";
import { DiscountType, CouponStatus } from "../models/Coupon.model.js";

// Create coupon
export const createCouponSchema = z.object({
  body: z
    .object({
      code: z
        .string()
        .min(3, "Code must be at least 3 characters")
        .max(50, "Code must not exceed 50 characters")
        .transform((val) => val.toUpperCase()),
      description: z.string().max(500).optional(),
      discountType: z.nativeEnum(DiscountType),
      discountValue: z.number().positive("Discount value must be positive"),
      maxDiscount: z.number().positive().optional(),
      minOrderAmount: z.number().min(0).default(0),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      totalUsageLimit: z.number().int().positive().optional(),
      usagePerUser: z.number().int().positive().default(1),
      applicableProducts: z.array(objectIdSchema).optional(),
      applicableCategories: z.array(objectIdSchema).optional(),
      status: z.nativeEnum(CouponStatus).default(CouponStatus.ACTIVE),
    })
    .refine((data) => data.endDate > data.startDate, {
      message: "End date must be after start date",
      path: ["endDate"],
    })
    .refine(
      (data) => {
        if (data.discountType === DiscountType.PERCENTAGE) {
          return data.discountValue <= 100;
        }
        return true;
      },
      {
        message: "Percentage discount cannot exceed 100",
        path: ["discountValue"],
      },
    ),
});

// Update coupon
export const updateCouponSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    description: z.string().max(500).optional(),
    discountValue: z.number().positive().optional(),
    maxDiscount: z.number().positive().optional(),
    minOrderAmount: z.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    totalUsageLimit: z.number().int().positive().optional(),
    usagePerUser: z.number().int().positive().optional(),
    applicableProducts: z.array(objectIdSchema).optional(),
    applicableCategories: z.array(objectIdSchema).optional(),
    status: z.nativeEnum(CouponStatus).optional(),
  }),
});

// Get coupon by code
export const getCouponByCodeSchema = z.object({
  params: z.object({
    code: z.string().min(3).max(50),
  }),
});

// Get/Delete coupon by ID
export const couponIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// Validate coupon
export const validateCouponSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(3)
      .max(50)
      .transform((val) => val.toUpperCase()),
    cartAmount: z.number().positive("Cart amount must be positive"),
    cartItems: z
      .array(
        z.object({
          productId: objectIdSchema,
          categoryId: objectIdSchema.optional(),
        }),
      )
      .optional(),
  }),
});

// List coupons query
export const listCouponsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(CouponStatus).optional(),
    search: z.string().optional(),
  }),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>["body"];
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>["body"];
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>["body"];
