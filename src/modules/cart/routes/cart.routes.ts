/**
 * Cart Routes
 * Route definitions for cart operations
 */

import { Router } from "express";
import { cartController } from "../controllers/cart.controller";
import {
  authenticate,
  optionalAuth,
} from "../../auth/middleware/auth.middleware.js";
import { ensureSessionId } from "../middleware/session.middleware.js";
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
router.get("/", optionalAuth, ensureSessionId, cartController.getCart);

// Add item to cart
router.post(
  "/items",
  optionalAuth,
  ensureSessionId,
  validate({ body: addToCartSchema.shape.body }),
  cartController.addItem,
);

// Update cart item quantity
router.patch(
  "/items/:itemId",
  optionalAuth,
  ensureSessionId,
  validate({
    params: updateCartItemSchema.shape.params,
    body: updateCartItemSchema.shape.body,
  }),
  cartController.updateItem,
);

// Remove item from cart
router.delete(
  "/items/:itemId",
  optionalAuth,
  ensureSessionId,
  validate({ params: removeCartItemSchema.shape.params }),
  cartController.removeItem,
);

// Clear cart
router.delete("/", optionalAuth, ensureSessionId, cartController.clearCart);

// Validate cart (check stock, prices)
router.post(
  "/validate",
  optionalAuth,
  ensureSessionId,
  cartController.validateCart,
);

/**
 * Authenticated routes
 */

// Apply discount code
router.post(
  "/discount",
  authenticate,
  validate({ body: applyDiscountSchema.shape.body }),
  cartController.applyDiscount,
);

// Remove discount code
router.delete("/discount", authenticate, cartController.removeDiscount);

// Merge guest cart with user cart (on login)
router.post(
  "/merge",
  authenticate,
  validate({ body: mergeCartsSchema.shape.body }),
  cartController.mergeCarts,
);

export const cartRoutes = router;
