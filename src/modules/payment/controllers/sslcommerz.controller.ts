/**
 * SSLCommerz Payment Controller
 * Controller for SSLCommerz payment operations
 */

import { Request, Response } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import {
  sslcommerzService,
  SSLCommerzIPNData,
} from "../services/sslcommerz.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../../shared/utils/apiResponse.js";
import { config } from "../../../config/index.js";

export class SSLCommerzController {
  /**
   * Initialize SSLCommerz payment session
   * POST /api/v1/payments/sslcommerz/init
   */
  initPayment = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const {
        orderId,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerCity,
        customerPostcode,
        customerCountry,
        shippingMethod,
        productName,
        productCategory,
      } = req.body;

      const result = await sslcommerzService.initPayment({
        orderId,
        customerName: customerName || "Customer",
        customerEmail: customerEmail || req.user!.email,
        customerPhone,
        customerAddress,
        customerCity,
        customerPostcode,
        customerCountry,
        shippingMethod,
        productName,
        productCategory,
      });

      sendSuccess(res, result, {
        message: "Payment session initialized",
        statusCode: 201,
      });
    },
  );

  /**
   * Handle success callback from SSLCommerz
   * POST /api/v1/payments/sslcommerz/success
   */
  successCallback = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { tran_id, val_id, amount, status } = req.body;

      if (status !== "VALID" && status !== "VALIDATED") {
        // Redirect to failure page
        return res.redirect(
          `${config.frontend.url}/payment/fail?tran_id=${tran_id}&status=${status}`,
        );
      }

      const order = await sslcommerzService.handleSuccessCallback(
        tran_id,
        val_id,
        amount,
      );

      // Redirect to success page on frontend
      res.redirect(
        `${config.frontend.url}/payment/success?order_id=${order._id}&order_number=${order.orderNumber}`,
      );
    },
  );

  /**
   * Handle fail callback from SSLCommerz
   * POST /api/v1/payments/sslcommerz/fail
   */
  failCallback = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { tran_id, status } = req.body;

      await sslcommerzService.handleFailCallback(tran_id);

      // Redirect to failure page on frontend
      res.redirect(
        `${config.frontend.url}/payment/fail?tran_id=${tran_id}&status=${status}`,
      );
    },
  );

  /**
   * Handle cancel callback from SSLCommerz
   * POST /api/v1/payments/sslcommerz/cancel
   */
  cancelCallback = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { tran_id } = req.body;

      await sslcommerzService.handleCancelCallback(tran_id);

      // Redirect to cancel page on frontend
      res.redirect(`${config.frontend.url}/payment/cancel?tran_id=${tran_id}`);
    },
  );

  /**
   * Handle IPN (Instant Payment Notification) from SSLCommerz
   * POST /api/v1/payments/sslcommerz/ipn
   */
  ipnHandler = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const ipnData: SSLCommerzIPNData = req.body;

      await sslcommerzService.processIPN(ipnData);

      // SSLCommerz expects a simple response
      sendSuccess(res, { received: true }, { message: "IPN processed" });
    },
  );

  /**
   * Process refund
   * POST /api/v1/payments/sslcommerz/:orderId/refund
   */
  refund = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;
      const { bankTransactionId, amount, reason } = req.body;

      const order = await sslcommerzService.refund({
        orderId,
        bankTransactionId,
        amount,
        reason,
      });

      sendSuccess(res, order, { message: "Refund processed" });
    },
  );

  /**
   * Get payment details
   * GET /api/v1/payments/sslcommerz/:orderId
   */
  getPaymentDetails = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;

      const result = await sslcommerzService.getPaymentDetails(orderId);

      sendSuccess(res, result, { message: "Payment details retrieved" });
    },
  );

  /**
   * Validate transaction
   * GET /api/v1/payments/sslcommerz/validate/:valId
   */
  validateTransaction = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { valId } = req.params;

      const result = await sslcommerzService.validateTransaction(valId);

      sendSuccess(res, result, { message: "Transaction validated" });
    },
  );

  /**
   * Get transaction details
   * GET /api/v1/payments/sslcommerz/transaction/:transactionId
   */
  getTransactionDetails = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { transactionId } = req.params;

      const result =
        await sslcommerzService.getTransactionDetails(transactionId);

      sendSuccess(res, result, { message: "Transaction details retrieved" });
    },
  );
}

export const sslcommerzController = new SSLCommerzController();
