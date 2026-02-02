/**
 * Payment Service
 * Stripe integration for payment processing
 */

import Stripe from "stripe";
import { config } from "../../../config/index.js";
import {
  Order,
  PaymentStatus,
  OrderStatus,
  IOrder,
} from "../../order/index.js";
import { orderService } from "../../order/services/order.service.js";
import {
  NotFoundError,
  PaymentError,
  BadRequestError,
} from "../../../shared/errors/index.js";
import { logger } from "../../../shared/utils/logger.js";

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey || "", {
  apiVersion: "2023-10-16",
});

export interface CreatePaymentIntentInput {
  orderId: string;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface RefundInput {
  orderId: string;
  amount?: number; // Partial refund amount (optional)
  reason?: string;
}

class PaymentService {
  /**
   * Create Stripe Payment Intent
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
  }> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (order.paymentStatus === PaymentStatus.CAPTURED) {
      throw new BadRequestError("Order is already paid");
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to smallest currency unit
      currency: (input.currency || order.currency || "inr").toLowerCase(),
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: order.userId.toString(),
        ...input.metadata,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Order ${order.orderNumber}`,
    });

    // Update order with payment intent ID
    order.payment.paymentIntentId = paymentIntent.id;
    order.payment.provider = "stripe";
    await order.save();

    logger.info(
      `Payment intent created for order ${order.orderNumber}: ${paymentIntent.id}`,
    );

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: order.total,
      currency: order.currency,
    };
  }

  /**
   * Confirm payment (for manual confirmation flow)
   */
  async confirmPayment(paymentIntentId: string): Promise<IOrder> {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      throw new BadRequestError("Invalid payment intent");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (paymentIntent.status === "succeeded") {
      return this.handleSuccessfulPayment(order, paymentIntent);
    }

    throw new PaymentError(`Payment status: ${paymentIntent.status}`);
  }

  /**
   * Process Stripe webhook
   */
  async processWebhook(
    payload: string | Buffer,
    signature: string,
  ): Promise<{ received: boolean; event?: string }> {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret!,
      );
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestError(`Webhook Error: ${err.message}`);
    }

    logger.info(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "payment_intent.payment_failed":
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case "charge.refunded":
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return { received: true, event: event.type };
  }

  /**
   * Process refund
   */
  async refund(input: RefundInput): Promise<IOrder> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    if (!order.payment.paymentIntentId) {
      throw new BadRequestError("No payment found for this order");
    }

    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      throw new BadRequestError("Order is already refunded");
    }

    // Get payment intent to find charge
    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.payment.paymentIntentId,
    );

    if (!paymentIntent.latest_charge) {
      throw new BadRequestError("No charge found for this payment");
    }

    const refundAmount = input.amount
      ? Math.round(input.amount * 100)
      : undefined; // Full refund if not specified

    // Create refund
    const refund = await stripe.refunds.create({
      charge: paymentIntent.latest_charge as string,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        reason: input.reason || "Customer requested",
      },
    });

    // Update order
    const isPartialRefund = refundAmount && refundAmount < order.total * 100;

    order.paymentStatus = isPartialRefund
      ? PaymentStatus.PARTIALLY_REFUNDED
      : PaymentStatus.REFUNDED;
    order.status = OrderStatus.REFUNDED;
    order.payment.refundId = refund.id;
    order.payment.refundAmount = (refundAmount || order.total * 100) / 100;
    order.payment.refundedAt = new Date();

    order.timeline.push({
      status: OrderStatus.REFUNDED,
      message: input.reason || "Payment refunded",
      timestamp: new Date(),
    });

    await order.save();

    logger.info(
      `Refund processed for order ${order.orderNumber}: ${refund.id}`,
    );
    return order;
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(orderId: string): Promise<{
    order: IOrder;
    paymentIntent?: Stripe.PaymentIntent;
  }> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    let paymentIntent: Stripe.PaymentIntent | undefined;

    if (order.payment.paymentIntentId) {
      paymentIntent = await stripe.paymentIntents.retrieve(
        order.payment.paymentIntentId,
      );
    }

    return { order, paymentIntent };
  }

  /**
   * List customer payment methods
   */
  async getCustomerPaymentMethods(
    stripeCustomerId: string,
  ): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
    });

    return paymentMethods.data;
  }

  /**
   * Create or get Stripe customer
   */
  async getOrCreateStripeCustomer(
    userId: string,
    email: string,
    name: string,
  ): Promise<string> {
    // Check if customer already exists (would typically store stripe_customer_id in User model)
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0].id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });

    return customer.id;
  }

  // Private webhook handlers

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      logger.warn("Payment intent succeeded without orderId");
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      logger.error(`Order not found for payment intent: ${paymentIntent.id}`);
      return;
    }

    await this.handleSuccessfulPayment(order, paymentIntent);
  }

  private async handleSuccessfulPayment(
    order: IOrder,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<IOrder> {
    order.paymentStatus = PaymentStatus.CAPTURED;
    order.payment.transactionId = paymentIntent.id;
    order.payment.paidAt = new Date();

    // Extract card details if available
    if (paymentIntent.payment_method) {
      const pm = await stripe.paymentMethods.retrieve(
        paymentIntent.payment_method as string,
      );
      if (pm.card) {
        order.payment.last4 = pm.card.last4;
        order.payment.brand = pm.card.brand;
      }
    }

    // Auto-confirm order
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.CONFIRMED;
      order.timeline.push({
        status: OrderStatus.CONFIRMED,
        message: "Payment received, order confirmed",
        timestamp: new Date(),
      });
    }

    await order.save();
    logger.info(`Payment successful for order ${order.orderNumber}`);
    return order;
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) return;

    const order = await Order.findById(orderId);
    if (!order) return;

    order.paymentStatus = PaymentStatus.FAILED;
    order.timeline.push({
      status: order.status,
      message: `Payment failed: ${paymentIntent.last_payment_error?.message || "Unknown error"}`,
      timestamp: new Date(),
    });

    await order.save();
    logger.warn(`Payment failed for order ${order.orderNumber}`);
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    // Find order by payment intent
    if (!charge.payment_intent) return;

    const order = await Order.findOne({
      "payment.paymentIntentId": charge.payment_intent,
    });

    if (!order) return;

    const isFullRefund = charge.amount_refunded === charge.amount;

    order.paymentStatus = isFullRefund
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;
    order.payment.refundAmount = charge.amount_refunded / 100;

    await order.save();
    logger.info(`Charge refunded for order ${order.orderNumber}`);
  }

  private async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    // Handle dispute - in production, you'd want to notify admins
    logger.error(`Dispute created: ${dispute.id} for charge ${dispute.charge}`);
    // TODO: Send notification to admin
    // TODO: Create support ticket
  }
}

export const paymentService = new PaymentService();
