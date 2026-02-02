/**
 * Category Service - Simplified
 */

import { Category, ICategory } from "../models/Category.model.js";
import { Product } from "../models/Product.model.js";
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
        "_id name slug description image isActive isFeatured productCount createdAt",
      )
      .sort({ name: 1 });
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
   */
  async delete(id: string): Promise<void> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError("Category");
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete category. It has ${productCount} products. Reassign or delete products first.`,
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
}

export const categoryService = new CategoryService();
