/**
 * Inventory Model
 * Stock management and tracking
 */

import mongoose, { Schema, Document, Types } from "mongoose";

// Inventory Movement Types
export enum InventoryMovementType {
  PURCHASE = "purchase",
  SALE = "sale",
  RETURN = "return",
  ADJUSTMENT = "adjustment",
  TRANSFER = "transfer",
  DAMAGE = "damage",
  EXPIRED = "expired",
}

// Inventory Movement Interface
export interface IInventoryMovement extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku: string;
  type: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: number;
  totalCost?: number;
  reference?: string;
  referenceType?: "order" | "purchase" | "adjustment" | "transfer";
  referenceId?: Types.ObjectId;
  notes?: string;
  createdBy: Types.ObjectId;
  tenantId: string;
  warehouseId?: Types.ObjectId;
  createdAt: Date;
}

// Stock Alert Interface
export interface IStockAlert extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku: string;
  currentStock: number;
  threshold: number;
  alertType: "low_stock" | "out_of_stock" | "overstock";
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  tenantId: string;
  createdAt: Date;
}

// Inventory Movement Schema
const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(InventoryMovementType),
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    unitCost: {
      type: Number,
      min: 0,
    },
    totalCost: {
      type: Number,
      min: 0,
    },
    reference: {
      type: String,
    },
    referenceType: {
      type: String,
      enum: ["order", "purchase", "adjustment", "transfer"],
    },
    referenceId: {
      type: Schema.Types.ObjectId,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Indexes
inventoryMovementSchema.index({ productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ sku: 1, createdAt: -1 });
inventoryMovementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
inventoryMovementSchema.index({ referenceType: 1, referenceId: 1 });

// Stock Alert Schema
const stockAlertSchema = new Schema<IStockAlert>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    currentStock: {
      type: Number,
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
    },
    alertType: {
      type: String,
      enum: ["low_stock", "out_of_stock", "overstock"],
      required: true,
    },
    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Indexes
stockAlertSchema.index({ tenantId: 1, isResolved: 1, alertType: 1 });
stockAlertSchema.index({ productId: 1, isResolved: 1 });

export const InventoryMovement = mongoose.model<IInventoryMovement>(
  "InventoryMovement",
  inventoryMovementSchema,
);

export const StockAlert = mongoose.model<IStockAlert>(
  "StockAlert",
  stockAlertSchema,
);
