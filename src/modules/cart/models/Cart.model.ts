/**
 * Cart Model
 * Persistent shopping cart with price calculation
 */

import mongoose, { Schema, Document, Types } from "mongoose";

// Cart Item Interface
export interface ICartItem {
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  sku: string;
  name: string;
  image?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  attributes?: Map<string, string>;
  addedAt: Date;
}

// Cart Interface
export interface ICart extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  sessionId?: string;
  items: ICartItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  tax: number;
  taxRate: number;
  shipping: number;
  total: number;
  currency: string;
  itemCount: number;
  notes?: string;
  tenantId: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Cart Item Schema
const cartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    sku: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
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
      default: 1,
    },
    attributes: {
      type: Map,
      of: String,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

// Cart Schema
const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },
    sessionId: {
      type: String,
      index: true,
      sparse: true,
    },
    items: [cartItemSchema],
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountCode: {
      type: String,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    shipping: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      // TTL index defined below instead of inline
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
cartSchema.index({ userId: 1, tenantId: 1 });
cartSchema.index({ sessionId: 1, tenantId: 1 });
cartSchema.index({ updatedAt: 1 });
// TTL index for automatic cart expiration
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to calculate totals
cartSchema.pre("save", function (next) {
  // Calculate subtotal
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Calculate item count
  this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate tax
  this.tax =
    Math.round((this.subtotal - this.discount) * (this.taxRate / 100) * 100) /
    100;

  // Calculate total
  this.total = Math.max(
    0,
    this.subtotal - this.discount + this.tax + this.shipping,
  );

  // Round to 2 decimal places
  this.subtotal = Math.round(this.subtotal * 100) / 100;
  this.total = Math.round(this.total * 100) / 100;

  next();
});

// Method to add item
cartSchema.methods.addItem = function (item: Partial<ICartItem>): void {
  const existingIndex = this.items.findIndex(
    (i: ICartItem) =>
      i.productId.toString() === item.productId?.toString() &&
      (!item.variantId ||
        i.variantId?.toString() === item.variantId?.toString()),
  );

  if (existingIndex > -1) {
    this.items[existingIndex].quantity += item.quantity || 1;
  } else {
    this.items.push({
      ...item,
      addedAt: new Date(),
    });
  }
};

// Method to remove item
cartSchema.methods.removeItem = function (itemId: string): void {
  this.items = this.items.filter(
    (item: ICartItem) => item._id?.toString() !== itemId,
  );
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function (
  itemId: string,
  quantity: number,
): void {
  const item = this.items.find((i: ICartItem) => i._id?.toString() === itemId);
  if (item) {
    item.quantity = Math.max(1, quantity);
  }
};

// Method to clear cart
cartSchema.methods.clearCart = function (): void {
  this.items = [];
  this.discount = 0;
  this.discountCode = undefined;
};

export const Cart = mongoose.model<ICart>("Cart", cartSchema);
