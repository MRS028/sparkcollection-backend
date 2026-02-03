/**
 * SSLCommerz Validators
 * Zod schemas for SSLCommerz payment operations
 */

import { z } from "zod";
import { objectIdSchema } from "../../../shared/validators/common.js";

// Initialize payment
export const sslcommerzInitSchema = z.object({
  body: z.object({
    orderId: objectIdSchema,
    customerName: z.string().min(2).max(100).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().min(10).max(20),
    customerAddress: z.string().max(200).optional(),
    customerCity: z.string().max(100).optional(),
    customerPostcode: z.string().max(20).optional(),
    customerCountry: z.string().max(100).optional(),
    shippingMethod: z.enum(["Courier", "YES", "NO"]).optional(),
    productName: z.string().max(256).optional(),
    productCategory: z.string().max(100).optional(),
  }),
});

// Refund
export const sslcommerzRefundSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
  body: z.object({
    bankTransactionId: z.string().min(1).max(100),
    amount: z.number().positive().optional(), // Partial refund
    reason: z.string().max(500).optional(),
  }),
});

// Get payment details
export const sslcommerzOrderIdSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
});

// Validate transaction
export const sslcommerzValIdSchema = z.object({
  params: z.object({
    valId: z.string().min(1).max(100),
  }),
});

// Get transaction details
export const sslcommerzTransactionIdSchema = z.object({
  params: z.object({
    transactionId: z.string().min(1).max(100),
  }),
});

// IPN data schema (for reference, actual validation happens in service)
export const sslcommerzIPNSchema = z.object({
  tran_id: z.string(),
  val_id: z.string(),
  amount: z.string(),
  card_type: z.string().optional(),
  store_amount: z.string().optional(),
  card_no: z.string().optional(),
  bank_tran_id: z.string().optional(),
  status: z.enum([
    "VALID",
    "VALIDATED",
    "FAILED",
    "CANCELLED",
    "UNATTEMPTED",
    "EXPIRED",
  ]),
  tran_date: z.string().optional(),
  currency: z.string().optional(),
  card_issuer: z.string().optional(),
  card_brand: z.string().optional(),
  verify_sign: z.string().optional(),
  verify_key: z.string().optional(),
  value_a: z.string().optional(),
  value_b: z.string().optional(),
  value_c: z.string().optional(),
  value_d: z.string().optional(),
});

// Success callback schema
export const sslcommerzSuccessSchema = z.object({
  body: z.object({
    tran_id: z.string(),
    val_id: z.string(),
    amount: z.string(),
    status: z.string(),
  }),
});

// Type exports
export type SSLCommerzInitInput = z.infer<typeof sslcommerzInitSchema>["body"];
export type SSLCommerzRefundInput = z.infer<typeof sslcommerzRefundSchema>;
export type SSLCommerzIPNInput = z.infer<typeof sslcommerzIPNSchema>;
