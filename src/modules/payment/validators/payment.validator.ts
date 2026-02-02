/**
 * Payment Validators
 * Zod schemas for payment operations
 */

import { z } from "zod";
import { objectIdSchema } from "../../../shared/validators/common.js";

// Create payment intent
export const createPaymentIntentSchema = z.object({
  body: z.object({
    orderId: objectIdSchema,
    currency: z.string().length(3).toUpperCase().optional(),
  }),
});

// Confirm payment
export const confirmPaymentSchema = z.object({
  body: z.object({
    paymentIntentId: z.string().min(10).max(100),
  }),
});

// Refund
export const refundSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
  body: z.object({
    amount: z.number().positive().optional(), // Partial refund
    reason: z.string().max(500).optional(),
  }),
});

// Get payment details
export const getPaymentDetailsSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
});

// Webhook (raw body validation is done separately)
export const webhookSchema = z.object({
  headers: z.object({
    "stripe-signature": z.string(),
  }),
});

// Type exports
export type CreatePaymentIntentInput = z.infer<
  typeof createPaymentIntentSchema
>["body"];
export type RefundInput = z.infer<typeof refundSchema>;
export type GetPaymentDetailsInput = z.infer<
  typeof getPaymentDetailsSchema
>["params"];
