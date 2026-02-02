/**
 * Shipping Controller
 * Thin controller for shipping operations
 */

import { Response } from "express";
import { AuthRequest, UserRole } from "../../../shared/types/index.js";
import { shippingService } from "../services/shipping.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {
  sendSuccess,
  sendPaginated,
} from "../../../shared/utils/apiResponse.js";

export class ShippingController {
  /**
   * Create shipment
   * POST /api/v1/shipping
   */
  create = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const sellerId = req.user!.userId;
      const {
        orderId,
        orderItemId,
        provider,
        pickupAddress,
        deliveryAddress,
        packageDetails,
        isCOD,
        codAmount,
        notes,
      } = req.body;

      const shipment = await shippingService.create({
        orderId,
        orderItemId,
        sellerId,
        provider,
        pickupAddress,
        deliveryAddress,
        packageDetails,
        isCOD,
        codAmount,
        notes,
      });

      sendSuccess(res, shipment, {
        message: "Shipment created",
        statusCode: 201,
      });
    },
  );

  /**
   * Get shipment by ID
   * GET /api/v1/shipping/:shipmentId
   */
  getById = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { shipmentId } = req.params;

      const shipment = await shippingService.getById(shipmentId);

      sendSuccess(res, shipment, { message: "Shipment retrieved" });
    },
  );

  /**
   * Track shipment by tracking number (public)
   * GET /api/v1/shipping/track/:trackingNumber
   */
  track = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { trackingNumber } = req.params;

      const shipment = await shippingService.track(trackingNumber);

      // Return limited info for public tracking
      sendSuccess(
        res,
        {
          trackingNumber: shipment.trackingNumber,
          status: shipment.status,
          courierName: shipment.courierName,
          estimatedDelivery: shipment.estimatedDelivery,
          actualDelivery: shipment.actualDelivery,
          trackingHistory: shipment.trackingHistory.map((event) => ({
            status: event.status,
            description: event.description,
            location: event.location,
            timestamp: event.timestamp,
          })),
        },
        { message: "Tracking info retrieved" },
      );
    },
  );

  /**
   * Get shipments by order
   * GET /api/v1/shipping/order/:orderId
   */
  getByOrder = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { orderId } = req.params;

      const shipments = await shippingService.getByOrder(orderId);

      sendSuccess(res, shipments, { message: "Order shipments retrieved" });
    },
  );

  /**
   * Update shipment status
   * PATCH /api/v1/shipping/:shipmentId/status
   */
  updateStatus = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { shipmentId } = req.params;
      const { status, description, location } = req.body;

      const shipment = await shippingService.updateStatus(
        shipmentId,
        status,
        description,
        location,
      );

      sendSuccess(res, shipment, { message: "Shipment status updated" });
    },
  );

  /**
   * Cancel shipment
   * POST /api/v1/shipping/:shipmentId/cancel
   */
  cancel = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { shipmentId } = req.params;

      const shipment = await shippingService.cancel(shipmentId);

      sendSuccess(res, shipment, { message: "Shipment cancelled" });
    },
  );

  /**
   * Get all shipments (with filters)
   * GET /api/v1/shipping
   */
  getAll = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const role = req.user!.role as UserRole;
      const userId = req.user!.userId;
      const {
        page,
        limit,
        sortBy,
        sortOrder,
        orderId,
        status,
        provider,
        startDate,
        endDate,
      } = req.query;

      // Sellers only see their own shipments
      const sellerId = role === UserRole.SELLER ? userId : undefined;

      const result = await shippingService.getAll(
        {
          sellerId,
          orderId: orderId as string,
          status: status as any,
          provider: provider as any,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
        },
        {
          page: Number(page) || 1,
          limit: Number(limit) || 10,
          sortBy: (sortBy as string) || "createdAt",
          sortOrder: (sortOrder as "asc" | "desc") || "desc",
        },
      );

      sendPaginated(res, result.data, result.pagination, "Shipments retrieved");
    },
  );

  /**
   * Get shipping rates
   * GET /api/v1/shipping/rates
   */
  getShippingRates = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { originPincode, destinationPincode, weight, isCOD } = req.query;

      const rates = await shippingService.getShippingRates(
        originPincode as string,
        destinationPincode as string,
        Number(weight),
        isCOD === "true",
      );

      sendSuccess(res, rates, { message: "Shipping rates retrieved" });
    },
  );
}

export const shippingController = new ShippingController();
