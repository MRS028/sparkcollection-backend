/**
 * Order Routes
 * Route definitions for order operations
 */

import { Router } from "express";
import { orderController } from "../controllers/order.controller.js";
import {
  authenticate,
  authorize,
  sellerAccess,
  adminOnly,
} from "../../auth/middleware/auth.middleware.js";
import { ensureSessionId } from "../../cart/middleware/session.middleware.js";
import { validate } from "../../../shared/middleware/validate.js";
import { UserRole, Role } from "../../../shared/types/index.js";
import {
  createOrderSchema,
  getOrderSchema,
  getOrderByNumberSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  addTrackingSchema,
  orderFiltersSchema,
  userOrdersSchema,
  sellerOrdersSchema,
  orderStatsSchema,
} from "../validators/order.validator.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Customer routes
 */

// Create order from cart
router.post(
  "/",
  ensureSessionId, // Ensure sessionId is available
  validate({ body: createOrderSchema.shape.body }),
  orderController.create,
);

// Get user's own orders
router.get(
  "/my-orders",
  validate({ query: userOrdersSchema.shape.query }),
  orderController.getUserOrders,
);

/**
 * Seller routes
 */

// Get seller's orders
router.get(
  "/seller-orders",
  sellerAccess,
  validate({ query: sellerOrdersSchema.shape.query }),
  orderController.getSellerOrders,
);

// Add tracking to order item
router.post(
  "/:orderId/items/:itemId/tracking",
  sellerAccess,
  validate({
    params: addTrackingSchema.shape.params,
    body: addTrackingSchema.shape.body,
  }),
  orderController.addTracking,
);

/**
 * Admin routes
 */

// Get all orders (Admin)
router.get(
  "/",
  adminOnly,
  validate({ query: orderFiltersSchema.shape.query }),
  orderController.getAll,
);

// Get order statistics
router.get(
  "/statistics",
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validate({ query: orderStatsSchema.shape.query }),
  orderController.getStatistics,
);

// Update order status (Admin/Seller)
router.patch(
  "/:orderId/status",
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validate({
    params: updateOrderStatusSchema.shape.params,
    body: updateOrderStatusSchema.shape.body,
  }),
  orderController.updateStatus,
);

/**
 * Shared routes (with authorization in controller)
 */

// Get order by ID
router.get(
  "/:orderId",
  validate({ params: getOrderSchema.shape.params }),
  orderController.getById,
);

// Get order by order number
router.get(
  "/number/:orderNumber",
  validate({ params: getOrderByNumberSchema.shape.params }),
  orderController.getByOrderNumber,
);

// Cancel order
router.post(
  "/:orderId/cancel",
  validate({
    params: cancelOrderSchema.shape.params,
    body: cancelOrderSchema.shape.body,
  }),
  orderController.cancel,
);

export const orderRoutes = router;
