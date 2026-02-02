/**
 * Order Service
 * Business logic for order lifecycle management
 */

import { Types, FilterQuery } from "mongoose";
import {
  Order,
  IOrder,
  OrderStatus,
  PaymentStatus,
  IOrderAddress,
  IPaymentInfo,
  IOrderItem,
} from "../models/Order.model.js";
import { Cart } from "../../cart/models/Cart.model.js";
import {
  Product,
  ProductStatus,
  InventoryMovementType,
} from "../../product/index.js";
import { productService } from "../../product/services/product.service.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../shared/errors/index.js";
import {
  PaginatedResult,
  PaginationOptions,
  UserRole,
} from "../../../shared/types/index.js";
import { redis } from "../../../config/redis.js";
import { logger } from "../../../shared/utils/logger.js";

export interface CreateOrderInput {
  shippingAddress: IOrderAddress;
  billingAddress?: IOrderAddress;
  paymentMethod: IPaymentInfo["method"];
  notes?: string;
}

export interface OrderFilters {
  userId?: string;
  sellerId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  tenantId?: string;
}

class OrderService {
  private readonly cachePrefix = "order:";
  private readonly cacheTTL = 60; // 1 minute for order data (changes frequently)

  /**
   * Create order from cart
   */
  async createFromCart(
    userId: string,
    input: CreateOrderInput,
    tenantId: string = "default",
  ): Promise<IOrder> {
    // Get and validate cart
    const cart = await Cart.findOne({
      userId: new Types.ObjectId(userId),
      tenantId,
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestError("Cart is empty");
    }

    // Validate all items and reserve stock
    const orderItems: IOrderItem[] = [];

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.productId);

      if (!product || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestError(
          `Product ${cartItem.name} is no longer available`,
        );
      }

      let availableStock = product.totalStock;

      if (cartItem.variantId) {
        const variant = product.variants.find(
          (v) => v._id?.toString() === cartItem.variantId?.toString(),
        );
        if (!variant || !variant.isActive) {
          throw new BadRequestError(
            `Product variant ${cartItem.name} is no longer available`,
          );
        }
        availableStock = variant.stock;
      }

      if (availableStock < cartItem.quantity) {
        throw new BadRequestError(
          `Insufficient stock for ${cartItem.name}. Only ${availableStock} available.`,
        );
      }

      orderItems.push({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        sellerId: product.sellerId,
        sku: cartItem.sku,
        name: cartItem.name,
        image: cartItem.image,
        price: cartItem.price,
        compareAtPrice: cartItem.compareAtPrice,
        quantity: cartItem.quantity,
        attributes: cartItem.attributes,
        status: OrderStatus.PENDING,
      } as IOrderItem);

      // Deduct stock
      await productService.updateStock(
        product._id.toString(),
        cartItem.variantId?.toString() || null,
        cartItem.quantity,
        InventoryMovementType.SALE,
        userId,
        "Order created",
      );
    }

    // Create order
    const order = await Order.create({
      userId: new Types.ObjectId(userId),
      items: orderItems,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress || input.shippingAddress,
      subtotal: cart.subtotal,
      discount: cart.discount,
      discountCode: cart.discountCode,
      tax: cart.tax,
      shipping: cart.shipping,
      total: cart.total,
      currency: cart.currency,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      payment: {
        method: input.paymentMethod,
        provider: input.paymentMethod === "cod" ? "cash" : "stripe", // Default to Stripe
      },
      timeline: [
        {
          status: OrderStatus.PENDING,
          message: "Order placed",
          timestamp: new Date(),
        },
      ],
      notes: input.notes,
      tenantId,
      estimatedDelivery: this.calculateEstimatedDelivery(),
    });

    // Clear cart after successful order creation
    cart.items = [];
    cart.discount = 0;
    cart.discountCode = undefined;
    await cart.save();

    logger.info(`Order created: ${order.orderNumber}`);
    return order;
  }

  /**
   * Get order by ID
   */
  async getById(
    orderId: string,
    userId?: string,
    role?: UserRole,
  ): Promise<IOrder> {
    const order = await Order.findById(orderId)
      .populate("userId", "firstName lastName email phone")
      .populate("items.productId", "name slug images")
      .populate("items.sellerId", "firstName lastName");

    if (!order) {
      throw new NotFoundError("Order");
    }

    // Authorization check
    if (userId && role !== UserRole.ADMIN && role !== UserRole.SUPPORT_AGENT) {
      const isOwner = order.userId._id.toString() === userId;
      const isSeller = order.items.some(
        (item) => item.sellerId.toString() === userId,
      );

      if (!isOwner && !isSeller) {
        throw new ForbiddenError("Access denied");
      }
    }

    return order;
  }

  /**
   * Get order by order number
   */
  async getByOrderNumber(orderNumber: string): Promise<IOrder> {
    const order = await Order.findOne({ orderNumber })
      .populate("userId", "firstName lastName email phone")
      .populate("items.productId", "name slug images");

    if (!order) {
      throw new NotFoundError("Order");
    }

    return order;
  }

  /**
   * Update order status
   */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    message: string,
    actorId: string,
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    // Validate status transition
    this.validateStatusTransition(order.status, status);

    order.status = status;
    order.timeline.push({
      status,
      message,
      timestamp: new Date(),
      actor: new Types.ObjectId(actorId),
    });

    if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    await order.save();
    await this.invalidateCache(orderId);

    logger.info(`Order ${order.orderNumber} status updated to ${status}`);
    return order;
  }

  /**
   * Cancel order
   */
  async cancel(
    orderId: string,
    reason: string,
    userId: string,
    role: UserRole,
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    // Check if cancellable
    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new BadRequestError("Order cannot be cancelled at this stage");
    }

    // Authorization
    if (role !== UserRole.ADMIN && order.userId.toString() !== userId) {
      throw new ForbiddenError("Access denied");
    }

    // Restore stock
    for (const item of order.items) {
      await productService.updateStock(
        item.productId.toString(),
        item.variantId?.toString() || null,
        item.quantity,
        InventoryMovementType.RETURN,
        userId,
        "Order cancelled",
      );
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelReason = reason;
    order.timeline.push({
      status: OrderStatus.CANCELLED,
      message: `Order cancelled: ${reason}`,
      timestamp: new Date(),
      actor: new Types.ObjectId(userId),
    });

    await order.save();
    await this.invalidateCache(orderId);

    logger.info(`Order ${order.orderNumber} cancelled`);
    return order;
  }

  /**
   * Get user orders
   */
  async getUserOrders(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IOrder>> {
    return this.getAll({ userId }, options);
  }

  /**
   * Get seller orders
   */
  async getSellerOrders(
    sellerId: string,
    options: PaginationOptions,
    filters?: Partial<OrderFilters>,
  ): Promise<PaginatedResult<IOrder>> {
    return this.getAll({ ...filters, sellerId }, options);
  }

  /**
   * Get all orders with filters
   */
  async getAll(
    filters: OrderFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IOrder>> {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;
    const skip = (page - 1) * limit;

    const query = this.buildFilterQuery(filters);

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("userId", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    paymentInfo: Partial<IPaymentInfo>,
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    order.paymentStatus = paymentStatus;
    order.payment = { ...order.payment, ...paymentInfo };

    // Auto-confirm order on successful payment
    if (
      paymentStatus === PaymentStatus.CAPTURED &&
      order.status === OrderStatus.PENDING
    ) {
      order.status = OrderStatus.CONFIRMED;
      order.timeline.push({
        status: OrderStatus.CONFIRMED,
        message: "Payment received, order confirmed",
        timestamp: new Date(),
      });
    }

    await order.save();
    await this.invalidateCache(orderId);

    logger.info(`Order ${order.orderNumber} payment status: ${paymentStatus}`);
    return order;
  }

  /**
   * Add tracking info
   */
  async addTracking(
    orderId: string,
    itemId: string,
    trackingNumber: string,
    actorId: string,
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    const item = order.items.find((i) => i._id?.toString() === itemId);
    if (!item) {
      throw new NotFoundError("Order item");
    }

    item.trackingNumber = trackingNumber;
    item.status = OrderStatus.SHIPPED;
    item.shippedAt = new Date();

    // Check if all items are shipped
    const allShipped = order.items.every(
      (i) =>
        i.status === OrderStatus.SHIPPED || i.status === OrderStatus.DELIVERED,
    );

    if (allShipped && order.status !== OrderStatus.SHIPPED) {
      order.status = OrderStatus.SHIPPED;
      order.timeline.push({
        status: OrderStatus.SHIPPED,
        message: "All items shipped",
        timestamp: new Date(),
        actor: new Types.ObjectId(actorId),
      });
    }

    await order.save();
    await this.invalidateCache(orderId);

    return order;
  }

  /**
   * Get order statistics
   */
  async getStatistics(
    tenantId?: string,
    sellerId?: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<OrderStatus, number>;
    recentOrders: IOrder[];
  }> {
    const baseMatch: FilterQuery<IOrder> = {};
    if (tenantId) baseMatch.tenantId = tenantId;
    if (sellerId) baseMatch["items.sellerId"] = new Types.ObjectId(sellerId);
    if (dateRange) {
      baseMatch.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }

    const [totalStats, statusStats, recentOrders] = await Promise.all([
      Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$total" },
          },
        },
      ]),
      Order.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.find(baseMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("userId", "firstName lastName"),
    ]);

    const ordersByStatus = {} as Record<OrderStatus, number>;
    for (const status of Object.values(OrderStatus)) {
      const found = statusStats.find((s) => s._id === status);
      ordersByStatus[status] = found ? found.count : 0;
    }

    const stats = totalStats[0] || { totalOrders: 0, totalRevenue: 0 };

    return {
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      averageOrderValue:
        stats.totalOrders > 0
          ? Math.round((stats.totalRevenue / stats.totalOrders) * 100) / 100
          : 0,
      ordersByStatus,
      recentOrders,
    };
  }

  // Private helper methods

  private buildFilterQuery(filters: OrderFilters): FilterQuery<IOrder> {
    const query: FilterQuery<IOrder> = {};

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.sellerId) {
      query["items.sellerId"] = new Types.ObjectId(filters.sellerId);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentStatus) {
      query.paymentStatus = filters.paymentStatus;
    }

    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    if (filters.search) {
      query.$or = [
        { orderNumber: { $regex: filters.search, $options: "i" } },
        {
          "shippingAddress.firstName": {
            $regex: filters.search,
            $options: "i",
          },
        },
        {
          "shippingAddress.lastName": { $regex: filters.search, $options: "i" },
        },
      ];
    }

    return query;
  }

  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        OrderStatus.FAILED,
      ],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
      ],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
      [OrderStatus.FAILED]: [OrderStatus.PENDING],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private calculateEstimatedDelivery(): Date {
    // Default: 5-7 business days
    const deliveryDays = 7;
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
    return estimatedDate;
  }

  private async invalidateCache(orderId: string): Promise<void> {
    await redis.del(`${this.cachePrefix}${orderId}`);
  }
}

export const orderService = new OrderService();
