/**
 * Product Validation Schemas
 */

import { z } from "zod";
import {
  objectIdSchema,
  nameSchema,
  descriptionSchema,
  skuSchema,
  paginationSchema,
  quantitySchema,
} from "../../../shared/validators/index.js";
import { ProductStatus } from "../models/Product.model.js";
import { InventoryMovementType } from "../models/Inventory.model.js";

// Dimensions schema
const dimensionsSchema = z
  .object({
    length: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0),
    unit: z.enum(["cm", "in"]).default("cm"),
  })
  .optional();

// Variant schema
const variantSchema = z.object({
  sku: skuSchema,
  name: nameSchema,
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  attributes: z.record(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  weight: z.number().min(0).optional(),
  dimensions: dimensionsSchema,
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// Create product schema
export const createProductSchema = z.object({
  name: nameSchema,
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(10000),
  shortDescription: z.string().max(500).optional(),
  sku: skuSchema,
  basePrice: z.number().min(0, "Price must be non-negative"),
  compareAtPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  category: objectIdSchema,
  subcategory: objectIdSchema.optional(),
  brand: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  variants: z.array(variantSchema).optional(),
  attributes: z.record(z.array(z.string())).optional(),
  weight: z.number().min(0).optional(),
  dimensions: dimensionsSchema,
  isDigital: z.boolean().default(false),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

// Update product schema
export const updateProductSchema = createProductSchema.partial().extend({
  status: z.nativeEnum(ProductStatus).optional(),
  isFeatured: z.boolean().optional(),
});

// Product ID params
export const productIdParamsSchema = z.object({
  id: objectIdSchema,
});

// Variant ID params
export const variantIdParamsSchema = z.object({
  id: objectIdSchema,
  variantId: objectIdSchema,
});

// Product list query
export const productListQuerySchema = paginationSchema.extend({
  category: objectIdSchema.optional(),
  subcategory: objectIdSchema.optional(),
  brand: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  minPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  maxPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  inStock: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  isFeatured: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  sellerId: objectIdSchema.optional(),
  search: z.string().optional(),
  tags: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",") : undefined)),
});

// Search query
export const searchQuerySchema = paginationSchema.extend({
  q: z.string().min(1, "Search query is required"),
  category: objectIdSchema.optional(),
  minPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  maxPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
});

// Add variant schema
export const addVariantSchema = variantSchema;

// Update variant schema
export const updateVariantSchema = variantSchema.partial();

// Update stock schema
export const updateStockSchema = z.object({
  quantity: z.number().int(),
  type: z.nativeEnum(InventoryMovementType),
  notes: z.string().max(500).optional(),
  variantId: objectIdSchema.optional().nullable(),
});

// Category schemas
export const createCategorySchema = z.object({
  name: nameSchema,
  description: z.string().max(1000).optional(),
  image: z.string().url().optional(),
  icon: z.string().optional(),
  parent: objectIdSchema.optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryIdParamsSchema = z.object({
  id: objectIdSchema,
});

// Types
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type AddVariantInput = z.infer<typeof addVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
