/**
 * Product Model
 * Core product entity with variants and inventory
 */

import mongoose, { Schema, Document, Types, Model } from "mongoose";
import slugify from "slugify";
import { InventoryMovement, InventoryMovementType } from "./Inventory.model.js";

// Product Status
export enum ProductStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  OUT_OF_STOCK = "out_of_stock",
  DISCONTINUED = "discontinued",
}

// Product Variant Interface
export interface IProductVariant {
  _id?: Types.ObjectId;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold: number;
  attributes: Map<string, string>; // e.g., { color: 'red', size: 'M' }
  images: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "in";
  };
  isDefault: boolean;
  isActive: boolean;
}

// Product Image Interface
export interface IProductImage {
  url: string;
  publicId: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

// Product Interface
export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  sku: string;
  basePrice: number;
  compareAtPrice?: number;
  costPrice?: number;
  category?: Types.ObjectId;
  subcategory?: Types.ObjectId;
  brand?: string;
  tags: string[];
  images: IProductImage[];
  variants: IProductVariant[];
  attributes: Map<string, string[]>; // Available attribute options
  status: ProductStatus;
  isFeatured: boolean;
  isDigital: boolean;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "in";
  };
  seoTitle?: string;
  seoDescription?: string;
  sellerId: Types.ObjectId;
  tenantId: string;
  totalStock: number;
  totalSold: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Variant Sub-Schema
const variantSchema = new Schema<IProductVariant>(
  {
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
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
    costPrice: {
      type: Number,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    attributes: {
      type: Map,
      of: String,
      default: new Map(),
    },
    images: [
      {
        type: String,
      },
    ],
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, enum: ["cm", "in"], default: "cm" },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
);

// Image Sub-Schema
const imageSchema = new Schema<IProductImage>(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    alt: {
      type: String,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

// Product Schema
const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
      index: "text",
    },
    slug: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      maxlength: [10000, "Description cannot exceed 10000 characters"],
      index: "text",
    },
    shortDescription: {
      type: String,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Price cannot be negative"],
    },
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
    },
    costPrice: {
      type: Number,
      min: [0, "Cost price cannot be negative"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    brand: {
      type: String,
      trim: true,
      index: true,
    },
    tags: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    images: [imageSchema],
    variants: [variantSchema],
    attributes: {
      type: Map,
      of: [String],
      default: new Map(),
    },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.DRAFT,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDigital: {
      type: Boolean,
      default: false,
    },
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, enum: ["cm", "in"], default: "cm" },
    },
    seoTitle: {
      type: String,
      maxlength: 70,
    },
    seoDescription: {
      type: String,
      maxlength: 160,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    totalStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSold: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ totalSold: -1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ tenantId: 1, status: 1 });

// Pre-save middleware to generate slug
productSchema.pre("save", async function (next) {
  if (this.isModified("name") || !this.slug) {
    let baseSlug = slugify(this.name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    // Check for existing slugs
    const Product = this.constructor as Model<IProduct>;
    while (await Product.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }

  // Track inventory movements for stock changes
  if (!this.isNew && this.isModified("variants")) {
    console.log(`🔍 Pre-save hook triggered - variants modified`);
    const originalDoc = await (this.constructor as Model<IProduct>).findById(
      this._id,
    );

    if (
      originalDoc &&
      originalDoc.variants &&
      originalDoc.variants.length > 0
    ) {
      console.log(`🔍 Found ${originalDoc.variants.length} original variants`);

      // Check each variant for stock changes - match by both _id and SKU
      for (const newVariant of this.variants) {
        let oldVariant;

        // Try to match by _id first, then by SKU
        if (newVariant._id) {
          oldVariant = originalDoc.variants.find(
            (v) => v._id?.toString() === newVariant._id?.toString(),
          );
          console.log(
            `🔍 Matching by _id: ${newVariant._id} - Found: ${!!oldVariant}`,
          );
        } else {
          // Match by SKU if no _id (for cases where _id isn't sent in update)
          oldVariant = originalDoc.variants.find(
            (v) => v.sku === newVariant.sku,
          );
          console.log(
            `🔍 Matching by SKU: ${newVariant.sku} - Found: ${!!oldVariant}`,
          );
        }

        if (oldVariant) {
          console.log(
            `🔍 Old stock: ${oldVariant.stock}, New stock: ${newVariant.stock}`,
          );

          if (oldVariant.stock !== newVariant.stock) {
            const stockDiff = newVariant.stock - oldVariant.stock;

            // Find the most recent inventory movement for this variant
            const latestMovement = await InventoryMovement.findOne({
              productId: this._id,
              variantId: oldVariant._id,
            }).sort({ createdAt: -1 });

            if (latestMovement) {
              // Update the existing movement
              await InventoryMovement.findByIdAndUpdate(latestMovement._id, {
                quantity: Math.abs(stockDiff),
                previousStock: oldVariant.stock,
                newStock: newVariant.stock,
                notes: `Variant stock ${stockDiff > 0 ? "increased" : "decreased"} by ${Math.abs(stockDiff)} via product update`,
              });
              console.log(
                `✅ Updated inventory movement for ${newVariant.sku}: qty=${Math.abs(stockDiff)}, ${oldVariant.stock} → ${newVariant.stock}`,
              );
            } else {
              // Create new movement if none exists
              await InventoryMovement.create({
                productId: this._id,
                variantId: oldVariant._id,
                sku: newVariant.sku,
                type: InventoryMovementType.ADJUSTMENT,
                quantity: Math.abs(stockDiff),
                previousStock: oldVariant.stock,
                newStock: newVariant.stock,
                notes: `Variant stock ${stockDiff > 0 ? "increased" : "decreased"} by ${Math.abs(stockDiff)} via product update`,
                createdBy: (this as any).updatedBy || this.sellerId,
                tenantId: this.tenantId,
              });
              console.log(
                `✅ Created inventory movement for ${newVariant.sku}: qty=${Math.abs(stockDiff)}, ${oldVariant.stock} → ${newVariant.stock}`,
              );
            }
          } else {
            console.log(`ℹ️ No stock change for ${newVariant.sku}`);
          }
        } else {
          console.log(
            `⚠️ Could not find matching variant for SKU: ${newVariant.sku}`,
          );
        }
      }
    }
  }

  // Track totalStock changes for all products
  if (!this.isNew && this.isModified("totalStock")) {
    const originalDoc = await (this.constructor as Model<IProduct>).findById(
      this._id,
    );

    if (originalDoc && originalDoc.totalStock !== this.totalStock) {
      const stockDiff = this.totalStock - originalDoc.totalStock;

      // Create new inventory movement for totalStock change
      await InventoryMovement.create({
        productId: this._id,
        sku: this.sku,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: Math.abs(stockDiff),
        previousStock: originalDoc.totalStock,
        newStock: this.totalStock,
        notes: `Product total stock ${stockDiff > 0 ? "increased" : "decreased"} by ${Math.abs(stockDiff)} ${this.variants && this.variants.length > 0 ? "(calculated from variants)" : "via product update"}`,
        createdBy: (this as any).updatedBy || this.sellerId,
        tenantId: this.tenantId,
      });
      console.log(
        `✅ Created inventory movement for product totalStock: qty=${Math.abs(stockDiff)}, ${originalDoc.totalStock} → ${this.totalStock}`,
      );
    }
  }

  // Always calculate total stock from variants automatically
  if (this.variants && this.variants.length > 0) {
    this.totalStock = this.variants
      .filter((v) => v.isActive)
      .reduce((sum, v) => sum + v.stock, 0);
  }

  next();
});

// Virtual for primary image
productSchema.virtual("primaryImage").get(function () {
  const primary = this.images.find((img) => img.isPrimary);
  return primary?.url || this.images[0]?.url || null;
});

// Virtual for price range
productSchema.virtual("priceRange").get(function () {
  if (!this.variants || this.variants.length === 0) {
    return { min: this.basePrice, max: this.basePrice };
  }

  const prices = this.variants.filter((v) => v.isActive).map((v) => v.price);
  return {
    min: Math.min(...prices, this.basePrice),
    max: Math.max(...prices, this.basePrice),
  };
});

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (!this.compareAtPrice || this.compareAtPrice <= this.basePrice) {
    return 0;
  }
  return Math.round(
    ((this.compareAtPrice - this.basePrice) / this.compareAtPrice) * 100,
  );
});

// Virtual for in stock status
productSchema.virtual("inStock").get(function () {
  return this.totalStock > 0;
});

export const Product = mongoose.model<IProduct>("Product", productSchema);

export function countDocuments(arg0: {
  category: string;
  status: string;
}): any {
  throw new Error("Function not implemented.");
}
export function find(arg0: { category: string; status: string }) {
  throw new Error("Function not implemented.");
}
