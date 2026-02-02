/**
 * Shipping Validators
 * Zod schemas for shipping operations
 */

import { z } from "zod";
import {
  objectIdSchema,
  paginationSchema,
} from "../../../shared/validators/common.js";
import { ShipmentStatus, DeliveryProvider } from "../models/Shipment.model.js";

// Address schema
const shipmentAddressSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  addressLine1: z.string().min(1).max(500),
  addressLine2: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(3).max(20),
  country: z.string().length(2).default("IN"),
});

// Package dimensions schema
const packageDimensionsSchema = z.object({
  length: z.number().positive().max(300), // max 300cm
  width: z.number().positive().max(300),
  height: z.number().positive().max(300),
  weight: z.number().positive().max(50), // max 50kg
});

// Create shipment
export const createShipmentSchema = z.object({
  body: z.object({
    orderId: objectIdSchema,
    orderItemId: objectIdSchema.optional(),
    provider: z.nativeEnum(DeliveryProvider),
    pickupAddress: shipmentAddressSchema,
    deliveryAddress: shipmentAddressSchema,
    packageDetails: packageDimensionsSchema,
    isCOD: z.boolean().optional().default(false),
    codAmount: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
  }),
});

// Get shipment by ID
export const getShipmentSchema = z.object({
  params: z.object({
    shipmentId: objectIdSchema,
  }),
});

// Get shipment by tracking number
export const getByTrackingSchema = z.object({
  params: z.object({
    trackingNumber: z.string().min(5).max(100),
  }),
});

// Update shipment status
export const updateStatusSchema = z.object({
  params: z.object({
    shipmentId: objectIdSchema,
  }),
  body: z.object({
    status: z.nativeEnum(ShipmentStatus),
    description: z.string().min(1).max(500),
    location: z.string().max(200).optional(),
  }),
});

// Cancel shipment
export const cancelShipmentSchema = z.object({
  params: z.object({
    shipmentId: objectIdSchema,
  }),
});

// Shipment filters
export const shipmentFiltersSchema = z.object({
  query: paginationSchema.extend({
    orderId: objectIdSchema.optional(),
    status: z.nativeEnum(ShipmentStatus).optional(),
    provider: z.nativeEnum(DeliveryProvider).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

// Get shipping rates
export const getShippingRatesSchema = z.object({
  query: z.object({
    originPincode: z.string().min(4).max(10),
    destinationPincode: z.string().min(4).max(10),
    weight: z.coerce.number().positive().max(50),
    isCOD: z.coerce.boolean().optional().default(false),
  }),
});

// Type exports
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>["body"];
export type UpdateShipmentStatusInput = z.infer<typeof updateStatusSchema>;
export type ShipmentFiltersInput = z.infer<
  typeof shipmentFiltersSchema
>["query"];
export type GetShippingRatesInput = z.infer<
  typeof getShippingRatesSchema
>["query"];
