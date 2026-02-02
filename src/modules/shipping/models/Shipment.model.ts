/**
 * Shipment Model
 * Track shipments and delivery status
 */

import mongoose, { Schema, Document, Types } from "mongoose";

// Shipment Status
export enum ShipmentStatus {
  PENDING = "pending",
  PICKUP_SCHEDULED = "pickup_scheduled",
  PICKED_UP = "picked_up",
  IN_TRANSIT = "in_transit",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
  FAILED_DELIVERY = "failed_delivery",
  RETURNED = "returned",
  CANCELLED = "cancelled",
}

// Delivery Provider
export enum DeliveryProvider {
  SHIPROCKET = "shiprocket",
  DELHIVERY = "delhivery",
  BLUEDART = "bluedart",
  DTDC = "dtdc",
  FEDEX = "fedex",
  MANUAL = "manual",
}

// Tracking Event Interface
export interface ITrackingEvent {
  status: ShipmentStatus;
  location?: string;
  description: string;
  timestamp: Date;
  rawData?: Record<string, unknown>;
}

// Shipment Address Interface
export interface IShipmentAddress {
  name: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Package Dimensions
export interface IPackageDimensions {
  length: number; // cm
  width: number;
  height: number;
  weight: number; // kg
}

// Shipment Interface
export interface IShipment extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  orderItemId?: Types.ObjectId;
  sellerId: Types.ObjectId;
  provider: DeliveryProvider;
  trackingNumber: string;
  awbNumber?: string; // Air Way Bill number
  courierName?: string;
  status: ShipmentStatus;
  pickupAddress: IShipmentAddress;
  deliveryAddress: IShipmentAddress;
  packageDetails: IPackageDimensions;
  trackingHistory: ITrackingEvent[];
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  shippingCost: number;
  codAmount?: number;
  isCOD: boolean;
  labelUrl?: string;
  invoiceUrl?: string;
  providerOrderId?: string;
  providerShipmentId?: string;
  notes?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  // Methods
  addTrackingEvent(
    status: ShipmentStatus,
    description: string,
    location?: string,
    rawData?: Record<string, unknown>,
  ): void;
}

// Tracking Event Schema
const trackingEventSchema = new Schema<ITrackingEvent>(
  {
    status: {
      type: String,
      enum: Object.values(ShipmentStatus),
      required: true,
    },
    location: String,
    description: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    rawData: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  { _id: false },
);

// Address Schema
const shipmentAddressSchema = new Schema<IShipmentAddress>(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: "IN" },
  },
  { _id: false },
);

// Package Dimensions Schema
const packageDimensionsSchema = new Schema<IPackageDimensions>(
  {
    length: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, required: true, min: 0 },
    weight: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// Shipment Schema
const shipmentSchema = new Schema<IShipment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderItemId: {
      type: Schema.Types.ObjectId,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(DeliveryProvider),
      required: true,
    },
    trackingNumber: {
      type: String,
      required: true,
      index: true,
    },
    awbNumber: {
      type: String,
      index: true,
    },
    courierName: String,
    status: {
      type: String,
      enum: Object.values(ShipmentStatus),
      default: ShipmentStatus.PENDING,
      index: true,
    },
    pickupAddress: {
      type: shipmentAddressSchema,
      required: true,
    },
    deliveryAddress: {
      type: shipmentAddressSchema,
      required: true,
    },
    packageDetails: {
      type: packageDimensionsSchema,
      required: true,
    },
    trackingHistory: [trackingEventSchema],
    estimatedDelivery: Date,
    actualDelivery: Date,
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    codAmount: {
      type: Number,
      min: 0,
    },
    isCOD: {
      type: Boolean,
      default: false,
    },
    labelUrl: String,
    invoiceUrl: String,
    providerOrderId: String,
    providerShipmentId: String,
    notes: {
      type: String,
      maxlength: 500,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
shipmentSchema.index({ orderId: 1, tenantId: 1 });
shipmentSchema.index({ sellerId: 1, status: 1 });
shipmentSchema.index({ trackingNumber: 1 }, { unique: true });
shipmentSchema.index({ status: 1, createdAt: -1 });

// Method to add tracking event
shipmentSchema.methods.addTrackingEvent = function (
  status: ShipmentStatus,
  description: string,
  location?: string,
  rawData?: Record<string, unknown>,
): void {
  this.trackingHistory.push({
    status,
    description,
    location,
    timestamp: new Date(),
    rawData,
  });
  this.status = status;

  if (status === ShipmentStatus.DELIVERED) {
    this.actualDelivery = new Date();
  }
};

export const Shipment = mongoose.model<IShipment>("Shipment", shipmentSchema);
