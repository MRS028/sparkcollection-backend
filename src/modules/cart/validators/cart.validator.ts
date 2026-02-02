/**
 * Cart Validators
 * Zod schemas for cart operations
 */

import { z } from "zod";
import { objectIdSchema } from "../../../shared/validators/common.js";

// Add to cart
export const addToCartSchema = z.object({
  body: z.object({
    productId: objectIdSchema,
    variantId: objectIdSchema.optional(),
    quantity: z.number().int().positive().max(100).default(1),
  }),
});

// Update cart item
export const updateCartItemSchema = z.object({
  params: z.object({
    itemId: objectIdSchema,
  }),
  body: z.object({
    quantity: z.number().int().positive().max(100),
  }),
});

// Remove cart item
export const removeCartItemSchema = z.object({
  params: z.object({
    itemId: objectIdSchema,
  }),
});

// Apply discount code
export const applyDiscountSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(3)
      .max(50)
      .transform((val) => val.toUpperCase()),
  }),
});

// Merge carts (for login)
export const mergeCartsSchema = z.object({
  body: z.object({
    sessionId: z.string().min(10).max(100),
  }),
});

// Type exports
export type AddToCartInput = z.infer<typeof addToCartSchema>["body"];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>["body"];
export type MergeCartsInput = z.infer<typeof mergeCartsSchema>["body"];
