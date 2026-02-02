/**
 * Shipping Routes
 * Route definitions for shipping operations
 */

import { Router } from "express";
import { shippingController } from "../controllers/shipping.controller.js";
import {
  authenticate,
  authorize,
  sellerAccess,
} from "../../auth/middleware/auth.middleware.js";
import { validate } from "../../../shared/middleware/validate.js";
import { UserRole } from "../../../shared/types/index.js";
import {
  createShipmentSchema,
  getShipmentSchema,
  getByTrackingSchema,
  updateStatusSchema,
  cancelShipmentSchema,
  shipmentFiltersSchema,
  getShippingRatesSchema,
} from "../validators/shipping.validator.js";

const router = Router();

/**
 * Public routes
 */

// Track shipment by tracking number
router.get(
  "/track/:trackingNumber",
  validate(getByTrackingSchema),
  shippingController.track,
);

// Get shipping rates (public for checkout)
router.get(
  "/rates",
  validate(getShippingRatesSchema),
  shippingController.getShippingRates,
);

/**
 * Authenticated routes
 */
router.use(authenticate);

// Create shipment (Seller only)
router.post(
  "/",
  sellerAccess,
  validate(createShipmentSchema),
  shippingController.create,
);

// Get all shipments (Admin sees all, Seller sees own)
router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate(shipmentFiltersSchema),
  shippingController.getAll,
);

// Get shipments by order
router.get("/order/:orderId", shippingController.getByOrder);

// Get shipment by ID
router.get(
  "/:shipmentId",
  validate(getShipmentSchema),
  shippingController.getById,
);

// Update shipment status
router.patch(
  "/:shipmentId/status",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate(updateStatusSchema),
  shippingController.updateStatus,
);

// Cancel shipment
router.post(
  "/:shipmentId/cancel",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate(cancelShipmentSchema),
  shippingController.cancel,
);

export const shippingRoutes = router;
