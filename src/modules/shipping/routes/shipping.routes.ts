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
  validate({ params: getByTrackingSchema.shape.params }),
  shippingController.track,
);

// Get shipping rates (public for checkout)
router.get(
  "/rates",
  validate({ query: getShippingRatesSchema.shape.query }),
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
  validate({ body: createShipmentSchema.shape.body }),
  shippingController.create,
);

// Get all shipments (Admin sees all, Seller sees own)
router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate({ query: shipmentFiltersSchema.shape.query }),
  shippingController.getAll,
);

// Get shipments by order
router.get("/order/:orderId", shippingController.getByOrder);

// Get shipment by ID
router.get(
  "/:shipmentId",
  validate({ params: getShipmentSchema.shape.params }),
  shippingController.getById,
);

// Update shipment status
router.patch(
  "/:shipmentId/status",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate({
    params: updateStatusSchema.shape.params,
    body: updateStatusSchema.shape.body,
  }),
  shippingController.updateStatus,
);

// Cancel shipment
router.post(
  "/:shipmentId/cancel",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate({ params: cancelShipmentSchema.shape.params }),
  shippingController.cancel,
);

export const shippingRoutes = router;
