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
import { validate } from "../../../shared/middleware/validate.js";
import { UserRole } from "../../../shared/types/index.js";
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
router.post("/", validate(createOrderSchema), orderController.create);

// Get user's own orders
router.get(
  "/my-orders",
  validate(userOrdersSchema),
  orderController.getUserOrders,
);

/**
 * Seller routes
 */

// Get seller's orders
router.get(
  "/seller-orders",
  sellerAccess,
  validate(sellerOrdersSchema),
  orderController.getSellerOrders,
);

// Add tracking to order item
router.post(
  "/:orderId/items/:itemId/tracking",
  sellerAccess,
  validate(addTrackingSchema),
  orderController.addTracking,
);

/**
 * Admin routes
 */

// Get all orders (Admin)
router.get(
  "/",
  adminOnly,
  validate(orderFiltersSchema),
  orderController.getAll,
);

// Get order statistics
router.get(
  "/statistics",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate(orderStatsSchema),
  orderController.getStatistics,
);

// Update order status (Admin/Seller)
router.patch(
  "/:orderId/status",
  authorize(UserRole.ADMIN, UserRole.SELLER),
  validate(updateOrderStatusSchema),
  orderController.updateStatus,
);

/**
 * Shared routes (with authorization in controller)
 */

// Get order by ID
router.get("/:orderId", validate(getOrderSchema), orderController.getById);

// Get order by order number
router.get(
  "/number/:orderNumber",
  validate(getOrderByNumberSchema),
  orderController.getByOrderNumber,
);

// Cancel order
router.post(
  "/:orderId/cancel",
  validate(cancelOrderSchema),
  orderController.cancel,
);

export const orderRoutes = router;
