/**
 * Coupon Routes
 * Route definitions for coupon operations
 */

import { Router } from "express";
import { couponController } from "../controllers/coupon.controller.js";
import {
  authenticate,
  optionalAuth,
} from "../../auth/middleware/auth.middleware.js";
import { validate } from "../../../shared/middleware/validate.js";
import {
  createCouponSchema,
  updateCouponSchema,
  getCouponByCodeSchema,
  couponIdSchema,
  validateCouponSchema,
  listCouponsSchema,
} from "../validators/coupon.validator.js";

const router = Router();

/**
 * Admin routes (require authentication)
 */

// Create coupon
router.post(
  "/",
  authenticate,
  validate({ body: createCouponSchema.shape.body }),
  couponController.createCoupon,
);

// List all coupons
router.get(
  "/",
  authenticate,
  validate({ query: listCouponsSchema.shape.query }),
  couponController.listCoupons,
);

// Get coupon by code
router.get(
  "/code/:code",
  authenticate,
  validate({ params: getCouponByCodeSchema.shape.params }),
  couponController.getCouponByCode,
);

// Get coupon by ID
router.get(
  "/:id",
  authenticate,
  validate({ params: couponIdSchema.shape.params }),
  couponController.getCouponById,
);

// Update coupon
router.patch(
  "/:id",
  authenticate,
  validate({
    params: updateCouponSchema.shape.params,
    body: updateCouponSchema.shape.body,
  }),
  couponController.updateCoupon,
);

// Delete coupon
router.delete(
  "/:id",
  authenticate,
  validate({ params: couponIdSchema.shape.params }),
  couponController.deleteCoupon,
);

/**
 * Public routes (for cart validation)
 */

// Validate coupon (can be used by guests or authenticated users)
router.post(
  "/validate",
  optionalAuth,
  validate({ body: validateCouponSchema.shape.body }),
  couponController.validateCoupon,
);

export const couponRoutes = router;
