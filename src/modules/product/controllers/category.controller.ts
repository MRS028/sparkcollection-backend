/**
 * Category Controller
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { categoryService } from "../services/category.service";
import { sendSuccess, sendCreated } from "../../../shared/utils/apiResponse.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";

/**
 * Get all categories
 */
export const getCategories = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const tenantId = req.user?.tenantId || "spark-collection";
    const categories = await categoryService.getAll(tenantId);
    sendSuccess(res, { categories, count: categories.length });
  },
);

/**
 * Get category statistics
 */
export const getCategoryStats = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const tenantId = req.user?.tenantId || "spark-collection";
    const stats = await categoryService.getStats(tenantId);
    sendSuccess(res, { stats });
  },
);

/**
 * Get category by ID
 */
export const getCategoryById = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const category = await categoryService.getById(req.params.id);
    sendSuccess(res, { category });
  },
);

/**
 * Create category
 */
export const createCategory = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const tenantId = req.user?.tenantId || "spark-collection";
    const category = await categoryService.create({
      ...req.body,
      tenantId,
    });
    sendCreated(res, { category }, "Category created successfully");
  },
);

/**
 * Update category
 */
export const updateCategory = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const category = await categoryService.update(req.params.id, req.body);
    sendSuccess(
      res,
      { category },
      { message: "Category updated successfully" },
    );
  },
);

/**
 * Delete category
 */
export const deleteCategory = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    await categoryService.delete(req.params.id);
    sendSuccess(res, null, { message: "Category deleted successfully" });
  },
);

/**
 * Get products by category
 */
export const getCategoryProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await categoryService.getProductsByCategory(id, {
      page,
      limit,
    });

    const { sendPaginated } =
      await import("../../../shared/utils/apiResponse.js");
    sendPaginated(res, result.products, result.pagination, {
      category: result.category,
    });
  },
);
