/**
 * Order Controller
 * Thin controller for order operations
 */

import { Response } from "express";
import { AuthRequest, UserRole } from "../../../shared/types/index.js";
import { orderService } from "../services/order.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {
  sendSuccess,
  sendPaginated,
} from "../../../shared/utils/apiResponse.js";

export class OrderController {
  /**
   * Create order from cart
   * POST /api/v1/orders
   */
  create = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user!.userId;
      const { shippingAddress, billingAddress, paymentMethod, notes } =
        req.body;

      const order = await orderService.createFromCart(userId, {
        shippingAddress,
        billingAddress,
        paymentMethod,
        notes,
      });

      sendSuccess(res, order, {
        message: "Order created successfully",
        statusCode: 201,
      });
    },
  );

  /**
   * Get order by ID
   * GET /api/v1/orders/:orderId
   */
  getById = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;
      const userId = req.user?.userId;
      const role = req.user?.role as UserRole | undefined;

      const order = await orderService.getById(orderId, userId, role);

      sendSuccess(res, order, { message: "Order retrieved successfully" });
    },
  );

  /**
   * Get order by order number
   * GET /api/v1/orders/number/:orderNumber
   */
  getByOrderNumber = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderNumber } = req.params;

      const order = await orderService.getByOrderNumber(orderNumber);

      sendSuccess(res, order, { message: "Order retrieved successfully" });
    },
  );

  /**
   * Get user orders
   * GET /api/v1/orders/my-orders
   */
  getUserOrders = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user!.userId;
      const { page, limit, sortBy, sortOrder } = req.query;

      const result = await orderService.getUserOrders(userId, {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        sortBy: (sortBy as string) || "createdAt",
        sortOrder: (sortOrder as "asc" | "desc") || "desc",
      });

      sendPaginated(
        res,
        result.data,
        result.pagination,
        "Orders retrieved successfully",
      );
    },
  );

  /**
   * Get seller orders
   * GET /api/v1/orders/seller-orders
   */
  getSellerOrders = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const sellerId = req.user!.userId;
      const { page, limit, sortBy, sortOrder, status } = req.query;

      const result = await orderService.getSellerOrders(
        sellerId,
        {
          page: Number(page) || 1,
          limit: Number(limit) || 10,
          sortBy: (sortBy as string) || "createdAt",
          sortOrder: (sortOrder as "asc" | "desc") || "desc",
        },
        { status: status as any },
      );

      sendPaginated(
        res,
        result.data,
        result.pagination,
        "Seller orders retrieved successfully",
      );
    },
  );

  /**
   * Get all orders (Admin)
   * GET /api/v1/orders
   */
  getAll = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const {
        page,
        limit,
        sortBy,
        sortOrder,
        status,
        paymentStatus,
        startDate,
        endDate,
        search,
      } = req.query;

      const result = await orderService.getAll(
        {
          status: status as any,
          paymentStatus: paymentStatus as any,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          search: search as string,
        },
        {
          page: Number(page) || 1,
          limit: Number(limit) || 10,
          sortBy: (sortBy as string) || "createdAt",
          sortOrder: (sortOrder as "asc" | "desc") || "desc",
        },
      );

      sendPaginated(
        res,
        result.data,
        result.pagination,
        "Orders retrieved successfully",
      );
    },
  );

  /**
   * Update order status
   * PATCH /api/v1/orders/:orderId/status
   */
  updateStatus = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;
      const { status, message } = req.body;
      const actorId = req.user!.userId;

      const order = await orderService.updateStatus(
        orderId,
        status,
        message,
        actorId,
      );

      sendSuccess(res, order, { message: "Order status updated" });
    },
  );

  /**
   * Cancel order
   * POST /api/v1/orders/:orderId/cancel
   */
  cancel = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;
      const { reason } = req.body;
      const userId = req.user!.userId;
      const role = req.user!.role as UserRole;

      const order = await orderService.cancel(orderId, reason, userId, role);

      sendSuccess(res, order, { message: "Order cancelled" });
    },
  );

  /**
   * Add tracking info
   * POST /api/v1/orders/:orderId/items/:itemId/tracking
   */
  addTracking = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId, itemId } = req.params;
      const { trackingNumber } = req.body;
      const actorId = req.user!.userId;

      const order = await orderService.addTracking(
        orderId,
        itemId,
        trackingNumber,
        actorId,
      );

      sendSuccess(res, order, { message: "Tracking added" });
    },
  );

  /**
   * Get order statistics
   * GET /api/v1/orders/statistics
   */
  getStatistics = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { startDate, endDate } = req.query;
      const role = req.user!.role as UserRole;
      const userId = req.user!.userId;

      const dateRange =
        startDate && endDate
          ? {
              start: new Date(startDate as string),
              end: new Date(endDate as string),
            }
          : undefined;

      const stats = await orderService.getStatistics(
        undefined,
        role === UserRole.SELLER ? userId : undefined,
        dateRange,
      );

      sendSuccess(res, stats, { message: "Statistics retrieved" });
    },
  );
}

export const orderController = new OrderController();
