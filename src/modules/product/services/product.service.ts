/**
 * Product Service
 * Business logic for product management
 */

import { Types, FilterQuery } from "mongoose";
import {
  Product,
  IProduct,
  ProductStatus,
  IProductVariant,
} from "../models/Product.model.js";
import { Category } from "../models/Category.model.js";
import {
  InventoryMovement,
  StockAlert,
  InventoryMovementType,
} from "../models/Inventory.model.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../../shared/errors/index.js";
import {
  PaginatedResult,
  PaginationOptions,
} from "../../../shared/types/index.js";
import { redis } from "../../../config/redis.js";
import { logger } from "../../../shared/utils/logger.js";

export interface ProductFilters {
  category?: string;
  subcategory?: string;
  brand?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isFeatured?: boolean;
  sellerId?: string;
  search?: string;
  tags?: string[];
  tenantId?: string;
}

// Input variant type with Record instead of Map for API compatibility
export interface VariantInput {
  _id?: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold: number;
  attributes?: Record<string, string>; // Accept Record from API, Mongoose converts to Map
  images?: string[];
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

export interface CreateProductInput {
  name: string;
  description: string;
  shortDescription?: string;
  sku: string;
  basePrice: number;
  compareAtPrice?: number;
  costPrice?: number;
  category: string;
  subcategory?: string;
  brand?: string;
  tags?: string[];
  variants?: Partial<VariantInput>[];
  attributes?: Record<string, string[]>;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "cm" | "in";
  };
  isDigital?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  sellerId: string;
  tenantId: string;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  status?: ProductStatus;
  isFeatured?: boolean;
}

class ProductService {
  private readonly cachePrefix = "product:";
  private readonly cacheTTL = 300; // 5 minutes

  /**
   * Find or create category by name - Simplified
   */
  private async findOrCreateCategory(
    categoryInput: string,
    tenantId: string,
  ): Promise<Types.ObjectId> {
    // Always treat input as category name for simplicity
    const name = categoryInput.trim();

    // Find existing category by name (case-insensitive)
    let category = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      tenantId,
    });

    // Auto-create if not found
    if (!category) {
      category = await Category.create({
        name,
        tenantId,
        isActive: true,
        level: 0,
      });
      logger.info(`✅ Auto-created category: ${category.name}`);
    }

    return category._id;
  }

  /**
   * Create a new product
   */
  async create(input: CreateProductInput): Promise<IProduct> {
    // Verify SKU is unique
    const existingSku = await Product.findOne({ sku: input.sku.toUpperCase() });
    if (existingSku) {
      throw new ConflictError("SKU already exists");
    }

    // Auto-create/find category from name
    const categoryId = await this.findOrCreateCategory(
      input.category,
      input.tenantId,
    );

    const product = await Product.create({
      ...input,
      sku: input.sku.toUpperCase(),
      category: categoryId,
      subcategory: undefined, // Keep it simple - no subcategories
      sellerId: new Types.ObjectId(input.sellerId),
      status: ProductStatus.DRAFT,
    });

    // Update category product count
    await Category.findByIdAndUpdate(categoryId, {
      $inc: { productCount: 1 },
    });

    logger.info(`Product created: ${product.name} (${product.sku})`);
    return product;
  }

  /**
   * Get product by ID
   */
  async getById(id: string, includeInactive = false): Promise<IProduct> {
    // Try cache first
    const cacheKey = `${this.cachePrefix}${id}`;
    const cached = await redis.get<IProduct>(cacheKey);
    if (cached && (includeInactive || cached.status === ProductStatus.ACTIVE)) {
      return cached;
    }

    const query: FilterQuery<IProduct> = { _id: id };
    if (!includeInactive) {
      query.status = ProductStatus.ACTIVE;
    }

    const product = await Product.findOne(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .populate("sellerId", "firstName lastName");

    if (!product) {
      throw new NotFoundError("Product");
    }

    // Cache active products
    if (product.status === ProductStatus.ACTIVE) {
      await redis.set(cacheKey, product.toJSON(), this.cacheTTL);
    }

    return product;
  }

  /**
   * Get product by slug
   */
  async getBySlug(slug: string): Promise<IProduct> {
    const cacheKey = `${this.cachePrefix}slug:${slug}`;
    const cached = await redis.get<IProduct>(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await Product.findOne({
      slug,
      status: ProductStatus.ACTIVE,
    })
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .populate("sellerId", "firstName lastName");

    if (!product) {
      throw new NotFoundError("Product");
    }

    await redis.set(cacheKey, product.toJSON(), this.cacheTTL);
    return product;
  }

  /**
   * Update product
   */
  async update(
    id: string,
    input: UpdateProductInput,
    userId: string,
  ): Promise<IProduct> {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError("Product");
    }

    // Verify ownership or admin
    if (product.sellerId.toString() !== userId) {
      throw new BadRequestError("You do not own this product");
    }

    // Check SKU uniqueness if changed
    if (input.sku && input.sku.toUpperCase() !== product.sku) {
      const existingSku = await Product.findOne({
        sku: input.sku.toUpperCase(),
        _id: { $ne: id },
      });
      if (existingSku) {
        throw new ConflictError("SKU already exists");
      }
    }

    // Update category count if category changed
    if (
      input.category &&
      product.category &&
      input.category !== product.category.toString()
    ) {
      await Promise.all([
        Category.findByIdAndUpdate(product.category, {
          $inc: { productCount: -1 },
        }),
        Category.findByIdAndUpdate(input.category, {
          $inc: { productCount: 1 },
        }),
      ]);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        ...input,
        sku: input.sku ? input.sku.toUpperCase() : undefined,
        category: input.category
          ? new Types.ObjectId(input.category)
          : undefined,
        subcategory: input.subcategory
          ? new Types.ObjectId(input.subcategory)
          : undefined,
      },
      { new: true, runValidators: true },
    )
      .populate("category", "name slug")
      .populate("subcategory", "name slug");

    // Invalidate cache
    await this.invalidateCache(id, product.slug);

    logger.info(`Product updated: ${updatedProduct?.name}`);
    return updatedProduct!;
  }

  /**
   * Delete product (soft delete by setting status)
   */
  async delete(id: string, userId: string): Promise<void> {
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError("Product");
    }

    if (product.sellerId.toString() !== userId) {
      throw new BadRequestError("You do not own this product");
    }

    product.status = ProductStatus.DISCONTINUED;
    await product.save();

    // Update category count
    await Category.findByIdAndUpdate(product.category, {
      $inc: { productCount: -1 },
    });

    // Invalidate cache
    await this.invalidateCache(id, product.slug);

    logger.info(`Product deleted: ${product.name}`);
  }

  /**
   * Get products with filters and pagination
   */
  async getAll(
    filters: ProductFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IProduct>> {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;
    const skip = (page - 1) * limit;

    const query = await this.buildFilterQuery(filters);

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("category", "name slug")
        .populate("subcategory", "name slug")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Search products
   */
  async search(
    searchTerm: string,
    filters: ProductFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IProduct>> {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const query: FilterQuery<IProduct> = {
      ...(await this.buildFilterQuery(filters)),
      $text: { $search: searchTerm },
    };

    const [products, total] = await Promise.all([
      Product.find(query, { score: { $meta: "textScore" } })
        .populate("category", "name slug")
        .sort({ score: { $meta: "textScore" } })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Add variant to product
   */
  async addVariant(
    productId: string,
    variant: Partial<VariantInput>,
    userId: string,
  ): Promise<IProduct> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError("Product");
    }

    if (product.sellerId.toString() !== userId) {
      throw new BadRequestError("You do not own this product");
    }

    // Check SKU uniqueness within product
    const skuExists = product.variants.some(
      (v) => v.sku === variant.sku?.toUpperCase(),
    );
    if (skuExists) {
      throw new ConflictError("Variant SKU already exists");
    }

    product.variants.push({
      ...variant,
      sku: variant.sku!.toUpperCase(),
    } as unknown as IProductVariant);

    await product.save();
    await this.invalidateCache(productId, product.slug);

    return product;
  }

  /**
   * Update variant
   */
  async updateVariant(
    productId: string,
    variantId: string,
    update: Partial<VariantInput>,
    userId: string,
  ): Promise<IProduct> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError("Product");
    }

    if (product.sellerId.toString() !== userId) {
      throw new BadRequestError("You do not own this product");
    }

    const variantIndex = product.variants.findIndex(
      (v) => v._id?.toString() === variantId,
    );

    if (variantIndex === -1) {
      throw new NotFoundError("Variant");
    }

    Object.assign(product.variants[variantIndex], update);
    await product.save();
    await this.invalidateCache(productId, product.slug);

    return product;
  }

  /**
   * Update stock
   */
  async updateStock(
    productId: string,
    variantId: string | null,
    quantity: number,
    type: InventoryMovementType,
    userId: string,
    notes?: string,
  ): Promise<IProduct> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError("Product");
    }

    let previousStock: number;
    let newStock: number;
    let sku: string;

    if (variantId) {
      const variant = product.variants.find(
        (v) => v._id?.toString() === variantId,
      );
      if (!variant) {
        throw new NotFoundError("Variant");
      }
      previousStock = variant.stock;
      newStock = this.calculateNewStock(previousStock, quantity, type);
      variant.stock = newStock;
      sku = variant.sku;

      // Check for low stock alert
      if (newStock <= variant.lowStockThreshold && newStock > 0) {
        await this.createStockAlert(
          productId,
          variantId,
          sku,
          newStock,
          variant.lowStockThreshold,
          "low_stock",
          product.tenantId,
        );
      } else if (newStock === 0) {
        await this.createStockAlert(
          productId,
          variantId,
          sku,
          newStock,
          variant.lowStockThreshold,
          "out_of_stock",
          product.tenantId,
        );
      }
    } else {
      previousStock = product.totalStock;
      newStock = this.calculateNewStock(previousStock, quantity, type);
      product.totalStock = newStock;
      sku = product.sku;
    }

    await product.save();

    // Record inventory movement
    await InventoryMovement.create({
      productId: product._id,
      variantId: variantId ? new Types.ObjectId(variantId) : undefined,
      sku,
      type,
      quantity,
      previousStock,
      newStock,
      notes,
      createdBy: new Types.ObjectId(userId),
      tenantId: product.tenantId,
    });

    await this.invalidateCache(productId, product.slug);

    logger.info(`Stock updated: ${sku} - ${type} ${quantity}`);
    return product;
  }

  /**
   * Get featured products
   */
  async getFeatured(limit = 10, tenantId?: string): Promise<IProduct[]> {
    const cacheKey = `${this.cachePrefix}featured:${tenantId || "all"}:${limit}`;
    const cached = await redis.get<IProduct[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const query: FilterQuery<IProduct> = {
      status: ProductStatus.ACTIVE,
      isFeatured: true,
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    const products = await Product.find(query)
      .populate("category", "name slug")
      .limit(limit)
      .sort({ createdAt: -1 });

    await redis.set(
      cacheKey,
      products.map((p) => p.toJSON()),
      this.cacheTTL,
    );
    return products;
  }

  /**
   * Get related products
   */
  async getRelated(productId: string, limit = 6): Promise<IProduct[]> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError("Product");
    }

    const relatedProducts = await Product.find({
      _id: { $ne: productId },
      status: ProductStatus.ACTIVE,
      $or: [{ category: product.category }, { tags: { $in: product.tags } }],
    })
      .populate("category", "name slug")
      .limit(limit)
      .sort({ totalSold: -1 });

    return relatedProducts;
  }

  // Private helper methods

  private async buildFilterQuery(
    filters: ProductFilters,
  ): Promise<FilterQuery<IProduct>> {
    const query: FilterQuery<IProduct> = {};

    if (filters.status) {
      query.status = filters.status;
    } else {
      query.status = ProductStatus.ACTIVE;
    }

    // Handle category - can be ObjectId or name
    if (filters.category) {
      if (Types.ObjectId.isValid(filters.category)) {
        query.category = new Types.ObjectId(filters.category);
      } else {
        // Lookup by name
        const category = await Category.findOne({
          name: { $regex: new RegExp(`^${filters.category}$`, "i") },
          tenantId: filters.tenantId,
        });
        if (category) {
          query.category = category._id;
        } else {
          // No matching category - return no results
          query._id = new Types.ObjectId("000000000000000000000000");
        }
      }
    }

    // Handle subcategory - can be ObjectId or name
    if (filters.subcategory) {
      if (Types.ObjectId.isValid(filters.subcategory)) {
        query.subcategory = new Types.ObjectId(filters.subcategory);
      } else {
        const subcategory = await Category.findOne({
          name: { $regex: new RegExp(`^${filters.subcategory}$`, "i") },
          tenantId: filters.tenantId,
        });
        if (subcategory) {
          query.subcategory = subcategory._id;
        }
      }
    }

    if (filters.brand) {
      query.brand = filters.brand;
    }

    if (filters.sellerId) {
      query.sellerId = new Types.ObjectId(filters.sellerId);
    }

    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }

    if (filters.isFeatured !== undefined) {
      query.isFeatured = filters.isFeatured;
    }

    if (filters.inStock !== undefined) {
      if (filters.inStock) {
        query.totalStock = { $gt: 0 };
      } else {
        query.totalStock = 0;
      }
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      query.basePrice = {};
      if (filters.minPrice !== undefined) {
        query.basePrice.$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        query.basePrice.$lte = filters.maxPrice;
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
        { brand: { $regex: filters.search, $options: "i" } },
      ];
    }

    return query;
  }

  private calculateNewStock(
    currentStock: number,
    quantity: number,
    type: InventoryMovementType,
  ): number {
    switch (type) {
      case InventoryMovementType.PURCHASE:
      case InventoryMovementType.RETURN:
        return currentStock + quantity;
      case InventoryMovementType.SALE:
      case InventoryMovementType.DAMAGE:
      case InventoryMovementType.EXPIRED:
        return Math.max(0, currentStock - quantity);
      case InventoryMovementType.ADJUSTMENT:
        return Math.max(0, currentStock + quantity); // Can be negative for reduction
      default:
        return currentStock;
    }
  }

  private async createStockAlert(
    productId: string,
    variantId: string | null,
    sku: string,
    currentStock: number,
    threshold: number,
    alertType: "low_stock" | "out_of_stock" | "overstock",
    tenantId: string,
  ): Promise<void> {
    // Check if unresolved alert already exists
    const existingAlert = await StockAlert.findOne({
      productId,
      variantId,
      alertType,
      isResolved: false,
    });

    if (!existingAlert) {
      await StockAlert.create({
        productId,
        variantId: variantId ? new Types.ObjectId(variantId) : undefined,
        sku,
        currentStock,
        threshold,
        alertType,
        tenantId,
      });
      logger.warn(`Stock alert created: ${sku} - ${alertType}`);
    }
  }

  private async invalidateCache(id: string, slug: string): Promise<void> {
    await Promise.all([
      redis.del(`${this.cachePrefix}${id}`),
      redis.del(`${this.cachePrefix}slug:${slug}`),
      redis.delPattern(`${this.cachePrefix}featured:*`),
    ]);
  }
}

export const productService = new ProductService();
