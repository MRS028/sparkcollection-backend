/**
 * SSLCommerz Payment Routes
 * Route definitions for SSLCommerz payment operations
 */

import { Router } from "express";
import { sslcommerzController } from "../controllers/sslcommerz.controller.js";
import {
  authenticate,
  authorize,
} from "../../auth/middleware/auth.middleware.js";
import { Role } from "../../../shared/types/index.js";
import { validate } from "../../../shared/middleware/validate.js";
import {
  sslcommerzInitSchema,
  sslcommerzRefundSchema,
  sslcommerzOrderIdSchema,
  sslcommerzValIdSchema,
  sslcommerzTransactionIdSchema,
} from "../validators/sslcommerz.validator.js";

const router = Router();

/**
 * Public callback routes (no auth required)
 * These are called by SSLCommerz servers
 */

// Success callback
router.post("/success", sslcommerzController.successCallback);

// Fail callback
router.post("/fail", sslcommerzController.failCallback);

// Cancel callback
router.post("/cancel", sslcommerzController.cancelCallback);

// IPN (Instant Payment Notification)
router.post("/ipn", sslcommerzController.ipnHandler);

/**
 * Authenticated routes
 */
router.use(authenticate);

// Initialize payment session
router.post(
  "/init",
  validate({ body: sslcommerzInitSchema.shape.body }),
  sslcommerzController.initPayment,
);

// Get payment details
router.get(
  "/:orderId",
  validate({ params: sslcommerzOrderIdSchema.shape.params }),
  sslcommerzController.getPaymentDetails,
);

// Validate transaction
router.get(
  "/validate/:valId",
  validate({ params: sslcommerzValIdSchema.shape.params }),
  sslcommerzController.validateTransaction,
);

// Get transaction details
router.get(
  "/transaction/:transactionId",
  validate({ params: sslcommerzTransactionIdSchema.shape.params }),
  sslcommerzController.getTransactionDetails,
);

/**
 * Admin routes
 */

// Process refund
router.post(
  "/:orderId/refund",
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  validate({
    params: sslcommerzRefundSchema.shape.params,
    body: sslcommerzRefundSchema.shape.body,
  }),
  sslcommerzController.refund,
);

export const sslcommerzRoutes = router;
