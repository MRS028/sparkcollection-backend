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
  attributes?: Record<string, string>;
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
  status?: ProductStatus;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  status?: ProductStatus;
  isFeatured?: boolean;
  totalStock?: number;
}

class ProductService {
  private readonly cachePrefix = "product:";
  private readonly cacheTTL = 300; // 5 minutes

  /**
   * Find or create category by name or ID
   */
  private async findOrCreateCategory(
    categoryInput: string,
    tenantId: string,
  ): Promise<Types.ObjectId> {
    if (Types.ObjectId.isValid(categoryInput)) {
      const category = await Category.findById(categoryInput);
      if (category) {
        return category._id;
      }
    }

    const name = categoryInput.trim();

    let category = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      tenantId,
    });

    if (!category) {
      try {
        category = await Category.create({
          name,
          tenantId,
          isActive: true,
          isFeatured: false,
          level: 0,
          sortOrder: 0,
          productCount: 0,
          ancestors: [],
          parent: null,
        });
        logger.info(
          `✅ Auto-created category: ${category.name} (${category._id})`,
        );
      } catch (error: any) {
        const existingCat = await Category.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
          tenantId,
        });
        if (existingCat) {
          logger.info(
            `✅ Using existing category after collision: ${existingCat.name}`,
          );
          return existingCat._id;
        }
        throw error;
      }
    }

    return category._id;
  }

  /**
   * Create a new product
   */
  async create(input: CreateProductInput): Promise<IProduct> {
    const existingSku = await Product.findOne({
      sku: input.sku.toUpperCase(),
    });
    if (existingSku) {
      throw new ConflictError("SKU already exists");
    }

    const categoryId = await this.findOrCreateCategory(
      input.category,
      input.tenantId,
    );

    const productData: any = {
      ...input,
      sku: input.sku.toUpperCase(),
      category: categoryId,
      sellerId: new Types.ObjectId(input.sellerId),
      status: input.status || ProductStatus.ACTIVE,
    };

    delete productData.subcategory;

    const product = await Product.create(productData);

    await Category.findByIdAndUpdate(categoryId, {
      $inc: { productCount: 1 },
    });

    if (product.totalStock > 0) {
      await InventoryMovement.create({
        productId: product._id,
        sku: product.sku,
        type: InventoryMovementType.PURCHASE,
        quantity: product.totalStock,
        previousStock: 0,
        newStock: product.totalStock,
        notes: "Initial stock on product creation",
        createdBy: new Types.ObjectId(input.sellerId),
        tenantId: product.tenantId,
      });
    }

    if (product.variants && product.variants.length > 0) {
      const variantMovements = product.variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => ({
          productId: product._id,
          variantId: variant._id,
          sku: variant.sku,
          type: InventoryMovementType.PURCHASE,
          quantity: variant.stock,
          previousStock: 0,
          newStock: variant.stock,
          notes: "Initial stock on variant creation",
          createdBy: new Types.ObjectId(input.sellerId),
          tenantId: product.tenantId,
        }));

      if (variantMovements.length > 0) {
        await InventoryMovement.insertMany(variantMovements);
      }
    }

    logger.info(`Product created: ${product.name} (${product.sku})`);
    return product;
  }

  /**
   * Get product by ID
   */
  async getById(id: string, includeInactive = false): Promise<IProduct> {
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

    if (product.sellerId.toString() !== userId) {
      throw new BadRequestError("You do not own this product");
    }

    if (input.sku && input.sku.toUpperCase() !== product.sku) {
      const existingSku = await Product.findOne({
        sku: input.sku.toUpperCase(),
        _id: { $ne: id },
      });
      if (existingSku) {
        throw new ConflictError("SKU already exists");
      }
    }

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

    const updateData: any = {};

    const fieldsToUpdate = [
      "name",
      "description",
      "shortDescription",
      "basePrice",
      "compareAtPrice",
      "costPrice",
      "brand",
      "tags",
      "attributes",
      "weight",
      "dimensions",
      "isDigital",
      "seoTitle",
      "seoDescription",
      "status",
      "isFeatured",
    ];

    fieldsToUpdate.forEach((field) => {
      if (input[field as keyof UpdateProductInput] !== undefined) {
        updateData[field] = input[field as keyof UpdateProductInput];
      }
    });

    if (input.sku) {
      updateData.sku = input.sku.toUpperCase();
    }

    if (input.category) {
      updateData.category = new Types.ObjectId(input.category);
    }

    if (input.subcategory) {
      updateData.subcategory = new Types.ObjectId(input.subcategory);
    }

    if (input.variants !== undefined) {
      logger.info(
        `📦 Updating variants. Received ${input.variants.length} variants in request`,
      );

      const variantStockChanges: Array<{
        variantId: Types.ObjectId;
        sku: string;
        previousStock: number;
        newStock: number;
      }> = [];

      if (product.variants && product.variants.length > 0) {
        (input.variants as any[]).forEach((inputVariant, idx) => {
          if (inputVariant._id) {
            const existingVariant = product.variants.find(
              (v) => v._id?.toString() === inputVariant._id.toString(),
            );

            if (existingVariant) {
              if (
                inputVariant.stock !== undefined &&
                inputVariant.stock !== existingVariant.stock
              ) {
                variantStockChanges.push({
                  variantId: existingVariant._id!,
                  sku: existingVariant.sku,
                  previousStock: existingVariant.stock,
                  newStock: inputVariant.stock,
                });
              }
            }
          }
        });
      }

      product.variants = input.variants as any;

      if (variantStockChanges.length > 0) {
        const movements = variantStockChanges.map((change) => {
          const stockDiff = change.newStock - change.previousStock;
          return {
            productId: product._id,
            variantId: change.variantId,
            sku: change.sku,
            type: InventoryMovementType.ADJUSTMENT,
            quantity: Math.abs(stockDiff),
            previousStock: change.previousStock,
            newStock: change.newStock,
            notes: `Variant stock ${stockDiff > 0 ? "increased" : "decreased"} by ${Math.abs(stockDiff)} via product update`,
            createdBy: new Types.ObjectId(userId),
            tenantId: product.tenantId,
          };
        });
        await InventoryMovement.insertMany(movements);
      }
    }

    let previousTotalStock: number | undefined;
    if (input.totalStock !== undefined) {
      previousTotalStock = product.totalStock;
      if (!product.variants || product.variants.length === 0) {
        product.totalStock = input.totalStock;
      }
    }

    Object.assign(product, updateData);

    await product.save();

    if (
      previousTotalStock !== undefined &&
      input.totalStock !== undefined &&
      previousTotalStock !== input.totalStock &&
      (!product.variants || product.variants.length === 0)
    ) {
      const stockDiff = input.totalStock - previousTotalStock;
      await InventoryMovement.create({
        productId: product._id,
        sku: product.sku,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: Math.abs(stockDiff),
        previousStock: previousTotalStock,
        newStock: input.totalStock,
        notes: `Product stock ${stockDiff > 0 ? "increased" : "decreased"} by ${Math.abs(stockDiff)} via product update`,
        createdBy: new Types.ObjectId(userId),
        tenantId: product.tenantId,
      });
    }

    const updatedProduct = await Product.findById(id)
      .populate("category", "name slug")
      .populate("subcategory", "name slug");

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

    await Category.findByIdAndUpdate(product.category, {
      $inc: { productCount: -1 },
    });

    await this.invalidateCache(id, product.slug);

    logger.info(`Product deleted: ${product.name}`);
  }

  /**
   * Get products with filters and pagination
   * ✅ FIX: By default excludes DISCONTINUED (soft-deleted) products.
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
        .populate("category", "name slug description image isActive isFeatured")
        .populate("sellerId", "firstName lastName email")
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
   * ✅ FIX: Also excludes DISCONTINUED by default.
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

    const newVariant = product.variants[product.variants.length - 1];
    if (newVariant.stock > 0) {
      await InventoryMovement.create({
        productId: product._id,
        variantId: newVariant._id,
        sku: newVariant.sku,
        type: InventoryMovementType.PURCHASE,
        quantity: newVariant.stock,
        previousStock: 0,
        newStock: newVariant.stock,
        notes: "Initial stock on variant creation",
        createdBy: new Types.ObjectId(userId),
        tenantId: product.tenantId,
      });
    }

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

    const variant = product.variants[variantIndex];
    const previousStock = variant.stock;

    Object.assign(variant, update);

    await product.save();

    if (update.stock !== undefined && update.stock !== previousStock) {
      const stockDiff = update.stock - previousStock;
      const movementType = InventoryMovementType.ADJUSTMENT;

      await InventoryMovement.create({
        productId: product._id,
        variantId: variant._id,
        sku: variant.sku,
        type: movementType,
        quantity: Math.abs(stockDiff),
        previousStock,
        newStock: update.stock,
        notes: `Variant stock ${stockDiff > 0 ? "increased" : "decreased"} by ${Math.abs(stockDiff)}`,
        createdBy: new Types.ObjectId(userId),
        tenantId: product.tenantId,
      });

      logger.info(
        `Variant stock updated: ${variant.sku} - ${previousStock} → ${update.stock}`,
      );
    }

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

  /**
   * Build filter query.
   * ✅ FIX: By default exclude DISCONTINUED (soft-deleted) products.
   */
  private async buildFilterQuery(
    filters: ProductFilters,
  ): Promise<FilterQuery<IProduct>> {
    const query: FilterQuery<IProduct> = {};

    // ✅ FIX: Default-এ DISCONTINUED বাদ। Explicit status দিলে সেটাই honor হবে।
    if (filters.status) {
      query.status = filters.status;
    } else {
      query.status = { $ne: ProductStatus.DISCONTINUED };
    }

    if (filters.category) {
      if (Types.ObjectId.isValid(filters.category)) {
        query.category = new Types.ObjectId(filters.category);
      } else {
        const category = await Category.findOne({
          name: { $regex: new RegExp(`^${filters.category}$`, "i") },
          tenantId: filters.tenantId,
        });
        if (category) {
          query.category = category._id;
        } else {
          query._id = new Types.ObjectId("000000000000000000000000");
        }
      }
    }

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
        return Math.max(0, currentStock + quantity);
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