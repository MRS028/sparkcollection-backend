/**
 * Payment Controller
 * Thin controller for payment operations
 */

import { Request, Response } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { paymentService } from "../services/payment.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../../shared/utils/apiResponse.js";

export class PaymentController {
  /**
   * Create payment intent
   * POST /api/v1/payments/create-intent
   */
  createPaymentIntent = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId, currency } = req.body;

      const result = await paymentService.createPaymentIntent({
        orderId,
        currency,
        metadata: {
          userId: req.user!.id,
        },
      });

      sendSuccess(res, result, "Payment intent created", 201);
    },
  );

  /**
   * Confirm payment
   * POST /api/v1/payments/confirm
   */
  confirmPayment = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { paymentIntentId } = req.body;

      const order = await paymentService.confirmPayment(paymentIntentId);

      sendSuccess(res, order, "Payment confirmed");
    },
  );

  /**
   * Process refund
   * POST /api/v1/payments/:orderId/refund
   */
  refund = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;
      const { amount, reason } = req.body;

      const order = await paymentService.refund({
        orderId,
        amount,
        reason,
      });

      sendSuccess(res, order, "Refund processed");
    },
  );

  /**
   * Get payment details
   * GET /api/v1/payments/:orderId
   */
  getPaymentDetails = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;

      const result = await paymentService.getPaymentDetails(orderId);

      sendSuccess(res, result, "Payment details retrieved");
    },
  );

  /**
   * Stripe webhook handler
   * POST /api/v1/payments/webhook
   */
  webhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["stripe-signature"] as string;

    const result = await paymentService.processWebhook(req.body, signature);

    sendSuccess(res, result, "Webhook processed");
  });
}

export const paymentController = new PaymentController();
