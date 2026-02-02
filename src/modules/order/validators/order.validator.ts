/**
 * Order Validators
 * Zod schemas for order operations
 */

import { z } from "zod";
import {
  objectIdSchema,
  addressSchema,
  paginationSchema,
} from "../../../shared/validators/common.js";
import { OrderStatus, PaymentStatus } from "../models/Order.model.js";

// Order address schema (extended)
const orderAddressSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  company: z.string().max(200).optional(),
  addressLine1: z.string().min(1).max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(3).max(20),
  country: z.string().length(2).default("IN"),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
});

// Payment method enum
const paymentMethodSchema = z.enum([
  "card",
  "upi",
  "netbanking",
  "wallet",
  "cod",
]);

// Create order
export const createOrderSchema = z.object({
  body: z.object({
    shippingAddress: orderAddressSchema,
    billingAddress: orderAddressSchema.optional(),
    paymentMethod: paymentMethodSchema,
    notes: z.string().max(1000).optional(),
  }),
});

// Get order by ID
export const getOrderSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
});

// Get order by order number
export const getOrderByNumberSchema = z.object({
  params: z.object({
    orderNumber: z.string().min(10).max(30),
  }),
});

// Update order status
export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus),
    message: z.string().min(1).max(500),
  }),
});

// Cancel order
export const cancelOrderSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
  }),
  body: z.object({
    reason: z.string().min(10).max(500),
  }),
});

// Add tracking
export const addTrackingSchema = z.object({
  params: z.object({
    orderId: objectIdSchema,
    itemId: objectIdSchema,
  }),
  body: z.object({
    trackingNumber: z.string().min(5).max(100),
  }),
});

// Order filters
export const orderFiltersSchema = z.object({
  query: paginationSchema.shape.query.extend({
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    search: z.string().max(100).optional(),
  }),
});

// User orders
export const userOrdersSchema = z.object({
  query: paginationSchema.shape.query,
});

// Seller orders
export const sellerOrdersSchema = z.object({
  query: paginationSchema.shape.query.extend({
    status: z.nativeEnum(OrderStatus).optional(),
  }),
});

// Statistics
export const orderStatsSchema = z.object({
  query: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>["body"];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AddTrackingInput = z.infer<typeof addTrackingSchema>;
export type OrderFiltersInput = z.infer<typeof orderFiltersSchema>["query"];
