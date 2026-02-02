/**
 * Cart Routes
 * Route definitions for cart operations
 */

import { Router } from "express";
import { cartController } from "../controllers/cart.controller.js";
import {
  authenticate,
  optionalAuth,
} from "../../auth/middleware/auth.middleware.js";
import { validate } from "../../../shared/middleware/validate.js";
import {
  addToCartSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  applyDiscountSchema,
  mergeCartsSchema,
} from "../validators/cart.validator.js";

const router = Router();

/**
 * Public routes (works with session or auth)
 */

// Get cart (works for both guest and authenticated users)
router.get("/", optionalAuth, cartController.getCart);

// Add item to cart
router.post(
  "/items",
  optionalAuth,
  validate(addToCartSchema),
  cartController.addItem,
);

// Update cart item quantity
router.patch(
  "/items/:itemId",
  optionalAuth,
  validate(updateCartItemSchema),
  cartController.updateItem,
);

// Remove item from cart
router.delete(
  "/items/:itemId",
  optionalAuth,
  validate(removeCartItemSchema),
  cartController.removeItem,
);

// Clear cart
router.delete("/", optionalAuth, cartController.clearCart);

// Validate cart (check stock, prices)
router.post("/validate", optionalAuth, cartController.validateCart);

/**
 * Authenticated routes
 */

// Apply discount code
router.post(
  "/discount",
  authenticate,
  validate(applyDiscountSchema),
  cartController.applyDiscount,
);

// Remove discount code
router.delete("/discount", authenticate, cartController.removeDiscount);

// Merge guest cart with user cart (on login)
router.post(
  "/merge",
  authenticate,
  validate(mergeCartsSchema),
  cartController.mergeCarts,
);

export const cartRoutes = router;
