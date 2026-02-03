/**
 * Order Model
 * Complete order lifecycle management
 */

import mongoose, { Schema, Document, Types } from "mongoose";

// Order Status
export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
  RETURNED = "returned",
  FAILED = "failed",
}

// Payment Status
export enum PaymentStatus {
  PENDING = "pending",
  AUTHORIZED = "authorized",
  CAPTURED = "captured",
  FAILED = "failed",
  REFUNDED = "refunded",
  PARTIALLY_REFUNDED = "partially_refunded",
}

// Order Item Interface
export interface IOrderItem {
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sellerId: Types.ObjectId;
  sku: string;
  name: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  attributes?: Map<string, string>;
  status: OrderStatus;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

// Address Interface for Order
export interface IOrderAddress {
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email?: string;
}

// Payment Info Interface
export interface IPaymentInfo {
  method: "card" | "upi" | "netbanking" | "wallet" | "cod";
  provider: string;
  transactionId?: string;
  paymentIntentId?: string;
  last4?: string;
  brand?: string;
  paidAt?: Date;
  refundedAt?: Date;
  refundId?: string;
  refundAmount?: number;
}

// Order Timeline Event
export interface IOrderEvent {
  status: OrderStatus;
  message: string;
  timestamp: Date;
  actor?: Types.ObjectId;
  metadata?: Record<string, unknown>;
}

// Order Interface
export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IOrderAddress;
  billingAddress: IOrderAddress;
  subtotal: number;
  discount: number;
  discountCode?: string;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payment: IPaymentInfo;
  timeline: IOrderEvent[];
  notes?: string;
  internalNotes?: string;
  cancelReason?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order Item Schema
const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: String,
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    attributes: {
      type: Map,
      of: String,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    trackingNumber: String,
    shippedAt: Date,
    deliveredAt: Date,
  },
  { _id: true },
);

// Address Schema
const addressSchema = new Schema<IOrderAddress>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    company: String,
    addressLine1: { type: String, required: true },
    addressLine2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: "IN" },
    phone: { type: String, required: true },
    email: String,
  },
  { _id: false },
);

// Payment Info Schema
const paymentInfoSchema = new Schema<IPaymentInfo>(
  {
    method: {
      type: String,
      enum: ["card", "upi", "netbanking", "wallet", "cod"],
      required: true,
    },
    provider: { type: String, required: true },
    transactionId: String,
    paymentIntentId: String,
    last4: String,
    brand: String,
    paidAt: Date,
    refundedAt: Date,
    refundId: String,
    refundAmount: Number,
  },
  { _id: false },
);

// Timeline Event Schema
const timelineEventSchema = new Schema<IOrderEvent>(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { _id: false },
);

// Order Schema
const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
      default: function () {
        // Use the document's _id as the order number
        return this._id.toString();
      },
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    billingAddress: {
      type: addressSchema,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountCode: String,
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    payment: paymentInfoSchema,
    timeline: [timelineEventSchema],
    notes: {
      type: String,
      maxlength: 1000,
    },
    internalNotes: {
      type: String,
      maxlength: 1000,
    },
    cancelReason: String,
    estimatedDelivery: Date,
    deliveredAt: Date,
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
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ "items.sellerId": 1, status: 1 });
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 }, { unique: true });

// Method to add timeline event
orderSchema.methods.addTimelineEvent = function (
  status: OrderStatus,
  message: string,
  actor?: Types.ObjectId,
  metadata?: Record<string, unknown>,
): void {
  this.timeline.push({
    status,
    message,
    timestamp: new Date(),
    actor,
    metadata,
  });
};

// Method to update status
orderSchema.methods.updateStatus = function (
  newStatus: OrderStatus,
  message: string,
  actor?: Types.ObjectId,
): void {
  this.status = newStatus;
  this.addTimelineEvent(newStatus, message, actor);

  if (newStatus === OrderStatus.DELIVERED) {
    this.deliveredAt = new Date();
  }
};

// Static method to generate order number (now just returns ObjectId string)
orderSchema.statics.generateOrderNumber = function (): string {
  return new Types.ObjectId().toString();
};

export const Order = mongoose.model<IOrder>("Order", orderSchema);
