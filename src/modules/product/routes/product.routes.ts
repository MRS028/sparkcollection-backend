/**
 * Product Routes
 */

import { Router } from "express";
import * as productController from "../controllers/product.controller.js";
import { authenticate, sellerAccess, optionalAuth } from "../../auth/index.js";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/middleware/validate.js";
import {
  createProductSchema,
  updateProductSchema,
  productIdParamsSchema,
  variantIdParamsSchema,
  productListQuerySchema,
  searchQuerySchema,
  addVariantSchema,
  updateVariantSchema,
  updateStockSchema,
} from "../validators/product.validator.js";

const router = Router();

// Public routes
router.get(
  "/",
  optionalAuth,
  validateQuery(productListQuerySchema),
  productController.getProducts,
);

router.get(
  "/search",
  optionalAuth,
  validateQuery(searchQuerySchema),
  productController.searchProducts,
);

router.get("/featured", optionalAuth, productController.getFeaturedProducts);

router.get("/slug/:slug", optionalAuth, productController.getProductBySlug);

router.get(
  "/:id",
  optionalAuth,
  validateParams(productIdParamsSchema),
  productController.getProductById,
);

router.get(
  "/:id/related",
  optionalAuth,
  validateParams(productIdParamsSchema),
  productController.getRelatedProducts,
);

// Protected routes (Seller/Admin)
router.post(
  "/",
  authenticate,
  sellerAccess,
  validateBody(createProductSchema),
  productController.createProduct,
);

router.patch(
  "/:id",
  authenticate,
  sellerAccess,
  validateParams(productIdParamsSchema),
  validateBody(updateProductSchema),
  productController.updateProduct,
);

router.delete(
  "/:id",
  authenticate,
  sellerAccess,
  validateParams(productIdParamsSchema),
  productController.deleteProduct,
);

// Variant routes
router.post(
  "/:id/variants",
  authenticate,
  sellerAccess,
  validateParams(productIdParamsSchema),
  validateBody(addVariantSchema),
  productController.addVariant,
);

router.patch(
  "/:id/variants/:variantId",
  authenticate,
  sellerAccess,
  validateParams(variantIdParamsSchema),
  validateBody(updateVariantSchema),
  productController.updateVariant,
);

// Stock management
router.patch(
  "/:id/stock",
  authenticate,
  sellerAccess,
  validateParams(productIdParamsSchema),
  validateBody(updateStockSchema),
  productController.updateStock,
);

export default router;
