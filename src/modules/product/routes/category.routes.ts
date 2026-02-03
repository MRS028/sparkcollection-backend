/**
 * Category Routes
 */

import { Router } from "express";
import * as categoryController from "../controllers/category.controller.js";
import { authenticate, adminOnly, optionalAuth } from "../../auth/index.js";

const router = Router();

// Public routes
router.get("/", optionalAuth, categoryController.getCategories);
router.get("/statistics", optionalAuth, categoryController.getCategoryStats);
router.get("/:id", optionalAuth, categoryController.getCategoryById);
router.get(
  "/:id/products",
  optionalAuth,
  categoryController.getCategoryProducts,
);

// Admin routes
router.post("/", authenticate, adminOnly, categoryController.createCategory);
router.patch(
  "/:id",
  authenticate,
  adminOnly,
  categoryController.updateCategory,
);
router.delete(
  "/:id",
  authenticate,
  adminOnly,
  categoryController.deleteCategory,
);

export default router;
