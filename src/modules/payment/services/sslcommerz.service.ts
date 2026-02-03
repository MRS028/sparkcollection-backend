/**
 * SSLCommerz Payment Service
 * Integration with SSLCommerz payment gateway for Bangladesh
 */

import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { config } from "../../../config/index.js";
import {
  Order,
  PaymentStatus,
  OrderStatus,
  IOrder,
} from "../../order/index.js";
import {
  NotFoundError,
  PaymentError,
  BadRequestError,
} from "../../../shared/errors/index.js";
import { logger } from "../../../shared/utils/logger.js";

// SSLCommerz API endpoints
const SSLCOMMERZ_SANDBOX_URL = "https://sandbox.sslcommerz.com";
const SSLCOMMERZ_LIVE_URL = "https://securepay.sslcommerz.com";

// SSLCommerz transaction statuses
export enum SSLCommerzStatus {
  VALID = "VALID",
  VALIDATED = "VALIDATED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  UNATTEMPTED = "UNATTEMPTED",
  EXPIRED = "EXPIRED",
}

// SSLCommerz response interfaces
export interface SSLCommerzInitResponse {
  status: string;
  faession: string;
  sessionkey: string;
  GatewayPageURL: string;
  directPaymentURLBank?: string;
  directPaymentURLCard?: string;
  directPaymentURL?: string;
  redirectGatewayURL: string;
  redirectGatewayURLFailed: string;
  storeBanner: string;
  storeLogo: string;
  store_name: string;
  desc: any[];
}

export interface SSLCommerzValidationResponse {
  status: string;
  tran_date: string;
  tran_id: string;
  val_id: string;
  amount: string;
  store_amount: string;
  currency: string;
  bank_tran_id: string;
  card_type: string;
  card_no: string;
  card_issuer: string;
  card_brand: string;
  card_issuer_country: string;
  card_issuer_country_code: string;
  currency_type: string;
  currency_amount: string;
  currency_rate: string;
  base_fair: string;
  value_a: string;
  value_b: string;
  value_c: string;
  value_d: string;
  risk_level: string;
  risk_title: string;
}

export interface SSLCommerzIPNData {
  tran_id: string;
  val_id: string;
  amount: string;
  card_type: string;
  store_amount: string;
  card_no: string;
  bank_tran_id: string;
  status: SSLCommerzStatus;
  tran_date: string;
  currency: string;
  card_issuer: string;
  card_brand: string;
  card_sub_brand: string;
  card_issuer_country: string;
  card_issuer_country_code: string;
  verify_sign: string;
  verify_key: string;
  risk_level: string;
  risk_title: string;
  value_a?: string;
  value_b?: string;
  value_c?: string;
  value_d?: string;
}

export interface SSLCommerzRefundResponse {
  APIConnect: string;
  bank_tran_id: string;
  trans_id: string;
  refund_ref_id: string;
  status: string;
  errorReason: string;
}

export interface InitPaymentInput {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress?: string;
  customerCity?: string;
  customerPostcode?: string;
  customerCountry?: string;
  shippingMethod?: string;
  productName?: string;
  productCategory?: string;
}

export interface RefundInput {
  orderId: string;
  bankTransactionId: string;
  amount?: number;
  reason?: string;
}

class SSLCommerzService {
  private axiosInstance: AxiosInstance;
  private storeId: string;
  private storePassword: string;
  private isLive: boolean;
  private baseUrl: string;

  constructor() {
    this.storeId = config.sslcommerz?.storeId || "";
    this.storePassword = config.sslcommerz?.storePassword || "";
    this.isLive = config.sslcommerz?.isLive || false;
    this.baseUrl = this.isLive ? SSLCOMMERZ_LIVE_URL : SSLCOMMERZ_SANDBOX_URL;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  /**
   * Initialize SSLCommerz payment session
   */
  async initPayment(input: InitPaymentInput): Promise<{
    gatewayUrl: string;
    sessionKey: string;
    transactionId: string;
  }> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      throw new BadRequestError("Order is already paid");
    }

    // Generate unique transaction ID
    const transactionId = `TXN_${order.orderNumber}_${Date.now()}`;

    // Prepare SSLCommerz init payload
    const payload = new URLSearchParams({
      store_id: this.storeId,
      store_passwd: this.storePassword,
      total_amount: order.total.toString(),
      currency: order.currency || "BDT",
      tran_id: transactionId,
      success_url: `${config.sslcommerz?.successUrl || config.frontend.url}/payment/success`,
      fail_url: `${config.sslcommerz?.failUrl || config.frontend.url}/payment/fail`,
      cancel_url: `${config.sslcommerz?.cancelUrl || config.frontend.url}/payment/cancel`,
      ipn_url: `${config.sslcommerz?.ipnUrl || `${config.frontend.url}/api/v1/payments/sslcommerz/ipn`}`,
      cus_name: input.customerName,
      cus_email: input.customerEmail,
      cus_phone: input.customerPhone,
      cus_add1: input.customerAddress || order.shippingAddress.addressLine1,
      cus_city: input.customerCity || order.shippingAddress.city,
      cus_postcode: input.customerPostcode || order.shippingAddress.postalCode,
      cus_country: input.customerCountry || order.shippingAddress.country,
      shipping_method: input.shippingMethod || "Courier",
      product_name: input.productName || `Order ${order.orderNumber}`,
      product_category: input.productCategory || "General",
      product_profile: "general",
      // Optional ship details
      ship_name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
      ship_add1: order.shippingAddress.addressLine1,
      ship_city: order.shippingAddress.city,
      ship_postcode: order.shippingAddress.postalCode,
      ship_country: order.shippingAddress.country,
      // Value fields for custom data
      value_a: order._id.toString(),
      value_b: order.userId.toString(),
      value_c: order.orderNumber,
      value_d: "",
    });

    try {
      const response = await this.axiosInstance.post<SSLCommerzInitResponse>(
        "/gwprocess/v4/api.php",
        payload.toString(),
      );

      if (response.data.status !== "SUCCESS") {
        logger.error("SSLCommerz init failed", response.data);
        throw new PaymentError("Failed to initialize payment gateway");
      }

      // Update order with transaction details
      order.payment.transactionId = transactionId;
      order.payment.provider = "sslcommerz";
      order.payment.method = "card"; // Will be updated after payment
      await order.save();

      logger.info(
        `SSLCommerz payment initiated for order ${order.orderNumber}: ${transactionId}`,
      );

      return {
        gatewayUrl: response.data.GatewayPageURL,
        sessionKey: response.data.sessionkey,
        transactionId,
      };
    } catch (error: any) {
      logger.error(
        "SSLCommerz init error",
        error.response?.data || error.message,
      );
      throw new PaymentError(
        error.response?.data?.faession ||
          "Payment gateway initialization failed",
      );
    }
  }

  /**
   * Validate SSLCommerz transaction
   */
  async validateTransaction(
    valId: string,
  ): Promise<SSLCommerzValidationResponse> {
    const payload = new URLSearchParams({
      val_id: valId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: "json",
    });

    try {
      const response =
        await this.axiosInstance.get<SSLCommerzValidationResponse>(
          `/validator/api/validationserverAPI.php?${payload.toString()}`,
        );

      return response.data;
    } catch (error: any) {
      logger.error(
        "SSLCommerz validation error",
        error.response?.data || error.message,
      );
      throw new PaymentError("Transaction validation failed");
    }
  }

  /**
   * Process IPN (Instant Payment Notification)
   */
  async processIPN(ipnData: SSLCommerzIPNData): Promise<IOrder> {
    // Verify the hash/signature
    if (!this.verifyIPNHash(ipnData)) {
      logger.error("SSLCommerz IPN hash verification failed", ipnData);
      throw new BadRequestError("Invalid IPN signature");
    }

    const orderId = ipnData.value_a;
    if (!orderId) {
      throw new BadRequestError("Order ID not found in IPN data");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    // Verify transaction ID matches
    if (order.payment.transactionId !== ipnData.tran_id) {
      logger.error("Transaction ID mismatch", {
        expected: order.payment.transactionId,
        received: ipnData.tran_id,
      });
      throw new BadRequestError("Transaction ID mismatch");
    }

    // Validate the transaction with SSLCommerz
    const validation = await this.validateTransaction(ipnData.val_id);

    switch (ipnData.status) {
      case SSLCommerzStatus.VALID:
      case SSLCommerzStatus.VALIDATED:
        return this.handleSuccessfulPayment(order, ipnData, validation);

      case SSLCommerzStatus.FAILED:
        return this.handleFailedPayment(order, ipnData);

      case SSLCommerzStatus.CANCELLED:
        return this.handleCancelledPayment(order, ipnData);

      default:
        logger.warn(`Unhandled SSLCommerz status: ${ipnData.status}`);
        return order;
    }
  }

  /**
   * Handle successful payment callback
   */
  async handleSuccessCallback(
    transactionId: string,
    valId: string,
    amount: string,
  ): Promise<IOrder> {
    // Find order by transaction ID
    const order = await Order.findOne({
      "payment.transactionId": transactionId,
    });

    if (!order) {
      throw new NotFoundError("Order");
    }

    // Validate the transaction
    const validation = await this.validateTransaction(valId);

    if (
      validation.status !== SSLCommerzStatus.VALID &&
      validation.status !== SSLCommerzStatus.VALIDATED
    ) {
      throw new PaymentError("Payment validation failed");
    }

    // Verify amount
    const validatedAmount = parseFloat(validation.amount);
    if (Math.abs(validatedAmount - order.total) > 0.01) {
      logger.error("Amount mismatch", {
        expected: order.total,
        received: validatedAmount,
      });
      throw new PaymentError("Payment amount mismatch");
    }

    // Update payment details
    order.paymentStatus = PaymentStatus.CAPTURED;
    order.payment.paidAt = new Date();
    order.payment.method = this.mapCardType(validation.card_type);
    order.payment.last4 = validation.card_no?.slice(-4);
    order.payment.brand = validation.card_brand;

    // Auto-confirm order
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.CONFIRMED;
      order.timeline.push({
        status: OrderStatus.CONFIRMED,
        message: "Payment received via SSLCommerz, order confirmed",
        timestamp: new Date(),
      });
    }

    await order.save();

    logger.info(`SSLCommerz payment successful for order ${order.orderNumber}`);

    return order;
  }

  /**
   * Handle failed payment callback
   */
  async handleFailCallback(transactionId: string): Promise<IOrder> {
    const order = await Order.findOne({
      "payment.transactionId": transactionId,
    });

    if (!order) {
      throw new NotFoundError("Order");
    }

    order.paymentStatus = PaymentStatus.FAILED;
    order.timeline.push({
      status: order.status,
      message: "Payment failed via SSLCommerz",
      timestamp: new Date(),
    });

    await order.save();

    logger.warn(`SSLCommerz payment failed for order ${order.orderNumber}`);

    return order;
  }

  /**
   * Handle cancelled payment callback
   */
  async handleCancelCallback(transactionId: string): Promise<IOrder> {
    const order = await Order.findOne({
      "payment.transactionId": transactionId,
    });

    if (!order) {
      throw new NotFoundError("Order");
    }

    order.paymentStatus = PaymentStatus.FAILED;
    order.timeline.push({
      status: order.status,
      message: "Payment cancelled by customer",
      timestamp: new Date(),
    });

    await order.save();

    logger.info(`SSLCommerz payment cancelled for order ${order.orderNumber}`);

    return order;
  }

  /**
   * Process refund via SSLCommerz
   */
  async refund(input: RefundInput): Promise<IOrder> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new BadRequestError("Order is already refunded");
    }

    if (order.paymentStatus !== PaymentStatus.CAPTURED) {
      throw new BadRequestError("Cannot refund unpaid order");
    }

    const refundAmount = input.amount || order.total;

    const payload = new URLSearchParams({
      bank_tran_id: input.bankTransactionId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      refund_amount: refundAmount.toString(),
      refund_remarks: input.reason || "Customer requested refund",
      refe_id: `REF_${order.orderNumber}_${Date.now()}`,
      format: "json",
    });

    try {
      const response = await this.axiosInstance.get<SSLCommerzRefundResponse>(
        `/validator/api/merchantTransIDvalidationAPI.php?${payload.toString()}`,
      );

      if (response.data.status !== "success") {
        throw new PaymentError(
          response.data.errorReason || "Refund processing failed",
        );
      }

      // Update order
      const isPartialRefund = refundAmount < order.total;

      order.paymentStatus = isPartialRefund
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.REFUNDED;
      order.status = OrderStatus.REFUNDED;
      order.payment.refundId = response.data.refund_ref_id;
      order.payment.refundAmount = refundAmount;
      order.payment.refundedAt = new Date();

      order.timeline.push({
        status: OrderStatus.REFUNDED,
        message: input.reason || "Payment refunded via SSLCommerz",
        timestamp: new Date(),
      });

      await order.save();

      logger.info(
        `SSLCommerz refund processed for order ${order.orderNumber}: ${response.data.refund_ref_id}`,
      );

      return order;
    } catch (error: any) {
      logger.error(
        "SSLCommerz refund error",
        error.response?.data || error.message,
      );
      throw new PaymentError(
        error.response?.data?.errorReason || "Refund processing failed",
      );
    }
  }

  /**
   * Get transaction details by transaction ID
   */
  async getTransactionDetails(transactionId: string): Promise<any> {
    const payload = new URLSearchParams({
      tran_id: transactionId,
      store_id: this.storeId,
      store_passwd: this.storePassword,
      format: "json",
    });

    try {
      const response = await this.axiosInstance.get(
        `/validator/api/merchantTransIDvalidationAPI.php?${payload.toString()}`,
      );

      return response.data;
    } catch (error: any) {
      logger.error(
        "SSLCommerz transaction query error",
        error.response?.data || error.message,
      );
      throw new PaymentError("Failed to fetch transaction details");
    }
  }

  /**
   * Get payment details for an order
   */
  async getPaymentDetails(orderId: string): Promise<{
    order: IOrder;
    transactionDetails?: any;
  }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    let transactionDetails;

    if (
      order.payment.transactionId &&
      order.payment.provider === "sslcommerz"
    ) {
      try {
        transactionDetails = await this.getTransactionDetails(
          order.payment.transactionId,
        );
      } catch (error) {
        // Transaction details not critical, log and continue
        logger.warn("Could not fetch SSLCommerz transaction details", error);
      }
    }

    return { order, transactionDetails };
  }

  // Private helper methods

  private handleSuccessfulPayment(
    order: IOrder,
    ipnData: SSLCommerzIPNData,
    validation: SSLCommerzValidationResponse,
  ): Promise<IOrder> {
    order.paymentStatus = PaymentStatus.CAPTURED;
    order.payment.paidAt = new Date();
    order.payment.method = this.mapCardType(ipnData.card_type);
    order.payment.last4 = ipnData.card_no?.slice(-4);
    order.payment.brand = ipnData.card_brand;

    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.CONFIRMED;
      order.timeline.push({
        status: OrderStatus.CONFIRMED,
        message: "Payment received via SSLCommerz, order confirmed",
        timestamp: new Date(),
      });
    }

    logger.info(`Payment successful for order ${order.orderNumber}`);
    return order.save();
  }

  private async handleFailedPayment(
    order: IOrder,
    ipnData: SSLCommerzIPNData,
  ): Promise<IOrder> {
    order.paymentStatus = PaymentStatus.FAILED;
    order.timeline.push({
      status: order.status,
      message: `Payment failed: ${ipnData.risk_title || "Unknown error"}`,
      timestamp: new Date(),
    });

    await order.save();
    logger.warn(`Payment failed for order ${order.orderNumber}`);
    return order;
  }

  private async handleCancelledPayment(
    order: IOrder,
    ipnData: SSLCommerzIPNData,
  ): Promise<IOrder> {
    order.paymentStatus = PaymentStatus.FAILED;
    order.timeline.push({
      status: order.status,
      message: "Payment was cancelled by customer",
      timestamp: new Date(),
    });

    await order.save();
    logger.info(`Payment cancelled for order ${order.orderNumber}`);
    return order;
  }

  private verifyIPNHash(ipnData: SSLCommerzIPNData): boolean {
    const verifyKey = ipnData.verify_key;
    const verifySign = ipnData.verify_sign;

    if (!verifyKey || !verifySign) {
      return false;
    }

    // Get the keys from verify_key (comma separated)
    const keys = verifyKey.split(",");

    // Build the hash string
    const hashString = keys
      .map((key) => `${key}=${(ipnData as any)[key] || ""}`)
      .join("&");

    // Add store password
    const signString = `${hashString}&store_passwd=${crypto
      .createHash("md5")
      .update(this.storePassword)
      .digest("hex")}`;

    // Generate hash
    const generatedSign = crypto
      .createHash("md5")
      .update(signString)
      .digest("hex");

    return generatedSign === verifySign;
  }

  private mapCardType(
    cardType: string,
  ): "card" | "upi" | "netbanking" | "wallet" | "cod" {
    const type = cardType?.toLowerCase();

    if (
      type?.includes("visa") ||
      type?.includes("master") ||
      type?.includes("amex")
    ) {
      return "card";
    }
    if (
      type?.includes("bkash") ||
      type?.includes("nagad") ||
      type?.includes("rocket")
    ) {
      return "wallet";
    }
    if (type?.includes("bank") || type?.includes("netbanking")) {
      return "netbanking";
    }

    return "card";
  }
}

export const sslcommerzService = new SSLCommerzService();
