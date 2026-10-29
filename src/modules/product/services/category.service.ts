/**
 * Category Service - Simplified
 */

import { Category, ICategory } from "../models/Category.model.js";
import { Product, ProductStatus } from "../models/Product.model.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../../shared/errors/index.js";
import { logger } from "../../../shared/utils/logger.js";

interface CreateCategoryInput {
  name: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  tenantId: string;
}

interface UpdateCategoryInput {
  name?: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  isFeatured?: boolean;
}

class CategoryService {
  /**
   * Get all categories (simple list)
   */
  async getAll(tenantId: string): Promise<ICategory[]> {
    const categories = await Category.find({ tenantId })
      .select(
        "_id name slug description image isActive isFeatured productCount createdAt updatedAt",
      )
      .sort({ name: 1 })
      .lean<ICategory[]>();
    return categories;
  }

  /**
   * Get category by ID
   */
  async getById(id: string): Promise<ICategory> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError("Category");
    }
    return category;
  }

  /**
   * Create category
   */
  async create(input: CreateCategoryInput): Promise<ICategory> {
    // Check for duplicate name (case-insensitive)
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${input.name}$`, "i") },
      tenantId: input.tenantId,
    });

    if (existing) {
      throw new BadRequestError("Category with this name already exists");
    }

    const category = await Category.create({
      ...input,
      level: 0,
      sortOrder: 0,
    });

    logger.info(`✅ Category created: ${category.name}`);
    return category;
  }

  /**
   * Update category
   */
  async update(id: string, input: UpdateCategoryInput): Promise<ICategory> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError("Category");
    }

    // Check name uniqueness if changing
    if (input.name && input.name !== category.name) {
      const existing = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${input.name}$`, "i") },
        tenantId: category.tenantId,
      });
      if (existing) {
        throw new BadRequestError("Category with this name already exists");
      }
    }

    Object.assign(category, input);
    await category.save();

    logger.info(`✅ Category updated: ${category.name}`);
    return category;
  }

  /**
   * Delete category
   * ✅ FIX: soft-deleted (DISCONTINUED) products আর count হবে না।
   */
  async delete(id: string): Promise<void> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError("Category");
    }

    // ✅ Only count ACTIVE / non-deleted products
    const productCount = await Product.countDocuments({
      category: id,
      status: { $ne: ProductStatus.DISCONTINUED },
    });

    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete category. It has ${productCount} active product${productCount > 1 ? "s" : ""}. Reassign or delete them first.`,
      );
    }

    // ✅ Soft-deleted products are orphaned — detach them from this category
    //    so they don't point to a non-existent category.
    //    (Only if `category` is not required in your Product schema.)
    try {
      await Product.updateMany(
        { category: id, status: ProductStatus.DISCONTINUED },
        { $set: { category: null } },
      );
    } catch (err) {
      // If `category` is required on Product schema, this will fail.
      // In that case we leave orphans alone — they'll still be filtered
      // out by product list queries because status = DISCONTINUED.
      logger.warn(
        `Could not detach discontinued products from category ${id}: ${
          (err as Error).message
        }`,
      );
    }

    await category.deleteOne();
    logger.info(`✅ Category deleted: ${category.name}`);
  }

  /**
   * Get category statistics
   */
  async getStats(tenantId: string) {
    const stats = await Category.aggregate([
      { $match: { tenantId } },
      {
        $group: {
          _id: null,
          totalCategories: { $sum: 1 },
          activeCategories: {
            $sum: { $cond: ["$isActive", 1, 0] },
          },
          featuredCategories: {
            $sum: { $cond: ["$isFeatured", 1, 0] },
          },
          totalProducts: { $sum: "$productCount" },
        },
      },
    ]);

    return (
      stats[0] || {
        totalCategories: 0,
        activeCategories: 0,
        featuredCategories: 0,
        totalProducts: 0,
      }
    );
  }

  /**
   * Get products by category
   */
  async getProductsByCategory(
    categoryId: string,
    options: { page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const category = await Category.findById(categoryId);
    if (!category) {
      throw new NotFoundError("Category");
    }

    const [products, total] = await Promise.all([
      Product.find({ category: categoryId, status: "active" })
        .select("name slug description basePrice images isFeatured totalStock")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({ category: categoryId, status: "active" }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
      },
      products,
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
}

export const categoryService = new CategoryService();
export async function find(
  tenantId: string,
  options: {
    search?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
    sort?: Record<string, 1 | -1>;
  } = {},
): Promise<{
  data: ICategory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}> {
  const {
    search,
    isActive,
    isFeatured,
    page = 1,
    limit = 20,
    sort = { name: 1 },
  } = options;

  const filter: Record<string, unknown> = { tenantId };

  if (typeof isActive === "boolean") {
    filter.isActive = isActive;
  }

  if (typeof isFeatured === "boolean") {
    filter.isFeatured = isFeatured;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Category.find(filter)
      .select(
        "_id name slug description image isActive isFeatured productCount createdAt",
      )
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}