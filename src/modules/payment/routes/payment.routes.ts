/**
 * Payment Routes
 * Route definitions for payment operations
 */

import { Router, raw } from "express";
import { paymentController } from "../controllers/payment.controller.js";
import {
  authenticate,
  adminOnly,
  authorize,
} from "../../auth/middleware/auth.middleware.js";
import { validate } from "../../../shared/middleware/validate.js";
import { UserRole } from "../../../shared/types/index.js";
import {
  createPaymentIntentSchema,
  confirmPaymentSchema,
  refundSchema,
  getPaymentDetailsSchema,
} from "../validators/payment.validator.js";

const router = Router();

/**
 * Webhook route (no auth, raw body)
 * Must be before other routes to use raw body parser
 */
router.post(
  "/webhook",
  raw({ type: "application/json" }),
  paymentController.webhook,
);

/**
 * Authenticated routes
 */
router.use(authenticate);

// Create payment intent
router.post(
  "/create-intent",
  validate(createPaymentIntentSchema),
  paymentController.createPaymentIntent,
);

// Confirm payment
router.post(
  "/confirm",
  validate(confirmPaymentSchema),
  paymentController.confirmPayment,
);

// Get payment details
router.get(
  "/:orderId",
  validate(getPaymentDetailsSchema),
  paymentController.getPaymentDetails,
);

/**
 * Admin routes
 */

// Process refund
router.post(
  "/:orderId/refund",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate(refundSchema),
  paymentController.refund,
);

export const paymentRoutes = router;
