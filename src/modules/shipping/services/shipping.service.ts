/**
 * Shipping Service
 * Business logic for shipping and delivery management
 */

import { Types } from "mongoose";
import {
  Shipment,
  IShipment,
  ShipmentStatus,
  DeliveryProvider,
  IShipmentAddress,
  IPackageDimensions,
} from "../models/Shipment.model.js";
import { Order, OrderStatus } from "../../order/index.js";
import {
  NotFoundError,
  BadRequestError,
  ExternalServiceError,
} from "../../../shared/errors/index.js";
import {
  PaginatedResult,
  PaginationOptions,
} from "../../../shared/types/index.js";
import { logger } from "../../../shared/utils/logger.js";
import { config } from "../../../config/index.js";

export interface CreateShipmentInput {
  orderId: string;
  orderItemId?: string;
  sellerId: string;
  provider: DeliveryProvider;
  pickupAddress: IShipmentAddress;
  deliveryAddress: IShipmentAddress;
  packageDetails: IPackageDimensions;
  isCOD?: boolean;
  codAmount?: number;
  notes?: string;
  tenantId?: string;
}

export interface ShipmentFilters {
  sellerId?: string;
  orderId?: string;
  status?: ShipmentStatus;
  provider?: DeliveryProvider;
  tenantId?: string;
  startDate?: Date;
  endDate?: Date;
}

// Abstract provider interface
interface IShippingProvider {
  createShipment(data: CreateShipmentInput): Promise<{
    trackingNumber: string;
    awbNumber?: string;
    courierName?: string;
    labelUrl?: string;
    estimatedDelivery?: Date;
    providerOrderId?: string;
    providerShipmentId?: string;
    shippingCost: number;
  }>;
  trackShipment(trackingNumber: string): Promise<{
    status: ShipmentStatus;
    events: Array<{
      status: ShipmentStatus;
      description: string;
      location?: string;
      timestamp: Date;
    }>;
  }>;
  cancelShipment(trackingNumber: string): Promise<boolean>;
}

class ShippingService {
  /**
   * Create shipment
   */
  async create(input: CreateShipmentInput): Promise<IShipment> {
    // Verify order exists
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new NotFoundError("Order");
    }

    // Get provider implementation
    const provider = this.getProvider(input.provider);

    try {
      // Create shipment with provider
      const providerResult = await provider.createShipment(input);

      // Create shipment record
      const shipment = await Shipment.create({
        orderId: new Types.ObjectId(input.orderId),
        orderItemId: input.orderItemId
          ? new Types.ObjectId(input.orderItemId)
          : undefined,
        sellerId: new Types.ObjectId(input.sellerId),
        provider: input.provider,
        trackingNumber: providerResult.trackingNumber,
        awbNumber: providerResult.awbNumber,
        courierName: providerResult.courierName,
        status: ShipmentStatus.PENDING,
        pickupAddress: input.pickupAddress,
        deliveryAddress: input.deliveryAddress,
        packageDetails: input.packageDetails,
        trackingHistory: [
          {
            status: ShipmentStatus.PENDING,
            description: "Shipment created",
            timestamp: new Date(),
          },
        ],
        estimatedDelivery: providerResult.estimatedDelivery,
        shippingCost: providerResult.shippingCost,
        isCOD: input.isCOD || false,
        codAmount: input.codAmount,
        labelUrl: providerResult.labelUrl,
        providerOrderId: providerResult.providerOrderId,
        providerShipmentId: providerResult.providerShipmentId,
        notes: input.notes,
        tenantId: input.tenantId || "default",
      });

      logger.info(`Shipment created: ${shipment.trackingNumber}`);
      return shipment;
    } catch (error: any) {
      logger.error(`Failed to create shipment: ${error.message}`);
      throw new ExternalServiceError(
        `Shipping provider error: ${error.message}`,
      );
    }
  }

  /**
   * Get shipment by ID
   */
  async getById(shipmentId: string): Promise<IShipment> {
    const shipment = await Shipment.findById(shipmentId)
      .populate("orderId", "orderNumber status")
      .populate("sellerId", "firstName lastName");

    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    return shipment;
  }

  /**
   * Get shipment by tracking number
   */
  async getByTrackingNumber(trackingNumber: string): Promise<IShipment> {
    const shipment = await Shipment.findOne({ trackingNumber })
      .populate("orderId", "orderNumber status total")
      .populate("sellerId", "firstName lastName");

    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    return shipment;
  }

  /**
   * Get shipments by order
   */
  async getByOrder(orderId: string): Promise<IShipment[]> {
    return Shipment.find({ orderId: new Types.ObjectId(orderId) }).sort({
      createdAt: -1,
    });
  }

  /**
   * Update shipment status
   */
  async updateStatus(
    shipmentId: string,
    status: ShipmentStatus,
    description: string,
    location?: string,
  ): Promise<IShipment> {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    shipment.addTrackingEvent(status, description, location);
    await shipment.save();

    // Update order status if all shipments delivered
    if (status === ShipmentStatus.DELIVERED) {
      await this.checkAndUpdateOrderStatus(shipment.orderId.toString());
    }

    logger.info(
      `Shipment ${shipment.trackingNumber} status updated to ${status}`,
    );
    return shipment;
  }

  /**
   * Track shipment (sync with provider)
   */
  async track(trackingNumber: string): Promise<IShipment> {
    const shipment = await Shipment.findOne({ trackingNumber });
    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    // Skip if manual provider or already delivered
    if (
      shipment.provider === DeliveryProvider.MANUAL ||
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.CANCELLED
    ) {
      return shipment;
    }

    try {
      const provider = this.getProvider(shipment.provider);
      const trackingResult = await provider.trackShipment(trackingNumber);

      // Add new events
      for (const event of trackingResult.events) {
        const existingEvent = shipment.trackingHistory.find(
          (h) =>
            h.status === event.status &&
            Math.abs(h.timestamp.getTime() - event.timestamp.getTime()) < 60000,
        );

        if (!existingEvent) {
          shipment.trackingHistory.push({
            status: event.status,
            description: event.description,
            location: event.location,
            timestamp: event.timestamp,
          });
        }
      }

      // Update current status
      if (trackingResult.status !== shipment.status) {
        shipment.status = trackingResult.status;

        if (trackingResult.status === ShipmentStatus.DELIVERED) {
          shipment.actualDelivery = new Date();
        }
      }

      await shipment.save();
      return shipment;
    } catch (error: any) {
      logger.error(
        `Failed to track shipment ${trackingNumber}: ${error.message}`,
      );
      return shipment;
    }
  }

  /**
   * Cancel shipment
   */
  async cancel(shipmentId: string): Promise<IShipment> {
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      throw new NotFoundError("Shipment");
    }

    if (
      shipment.status === ShipmentStatus.DELIVERED ||
      shipment.status === ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestError("Cannot cancel shipment in current status");
    }

    if (shipment.provider !== DeliveryProvider.MANUAL) {
      try {
        const provider = this.getProvider(shipment.provider);
        await provider.cancelShipment(shipment.trackingNumber);
      } catch (error: any) {
        logger.warn(`Provider cancellation failed: ${error.message}`);
      }
    }

    shipment.addTrackingEvent(ShipmentStatus.CANCELLED, "Shipment cancelled");
    await shipment.save();

    logger.info(`Shipment ${shipment.trackingNumber} cancelled`);
    return shipment;
  }

  /**
   * Get all shipments with filters
   */
  async getAll(
    filters: ShipmentFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IShipment>> {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filters.sellerId) {
      query.sellerId = new Types.ObjectId(filters.sellerId);
    }
    if (filters.orderId) {
      query.orderId = new Types.ObjectId(filters.orderId);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.provider) {
      query.provider = filters.provider;
    }
    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .populate("orderId", "orderNumber")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Shipment.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: shipments,
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
   * Get shipping rate estimate
   */
  async getShippingRates(
    originPincode: string,
    destinationPincode: string,
    weight: number,
    isCOD: boolean = false,
  ): Promise<
    Array<{
      provider: DeliveryProvider;
      courierName: string;
      estimatedDays: number;
      rate: number;
      codCharge?: number;
    }>
  > {
    // In production, call actual shipping APIs
    // This is a placeholder implementation
    const baseRate = weight * 50; // ₹50 per kg

    return [
      {
        provider: DeliveryProvider.DELHIVERY,
        courierName: "Delhivery Surface",
        estimatedDays: 5,
        rate: baseRate,
        codCharge: isCOD ? 50 : 0,
      },
      {
        provider: DeliveryProvider.BLUEDART,
        courierName: "BlueDart Express",
        estimatedDays: 3,
        rate: baseRate * 1.5,
        codCharge: isCOD ? 60 : 0,
      },
      {
        provider: DeliveryProvider.DTDC,
        courierName: "DTDC Economy",
        estimatedDays: 7,
        rate: baseRate * 0.8,
        codCharge: isCOD ? 40 : 0,
      },
    ];
  }

  /**
   * Bulk sync tracking status (cron job)
   */
  async syncTrackingStatus(): Promise<number> {
    const activeShipments = await Shipment.find({
      status: {
        $nin: [
          ShipmentStatus.DELIVERED,
          ShipmentStatus.CANCELLED,
          ShipmentStatus.RETURNED,
        ],
      },
      provider: { $ne: DeliveryProvider.MANUAL },
    }).limit(100);

    let synced = 0;

    for (const shipment of activeShipments) {
      try {
        await this.track(shipment.trackingNumber);
        synced++;
      } catch (error) {
        // Continue with other shipments
      }
    }

    logger.info(`Synced ${synced} shipments`);
    return synced;
  }

  // Private methods

  private async checkAndUpdateOrderStatus(orderId: string): Promise<void> {
    const shipments = await Shipment.find({
      orderId: new Types.ObjectId(orderId),
    });

    const allDelivered =
      shipments.length > 0 &&
      shipments.every((s) => s.status === ShipmentStatus.DELIVERED);

    if (allDelivered) {
      await Order.findByIdAndUpdate(orderId, {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        $push: {
          timeline: {
            status: OrderStatus.DELIVERED,
            message: "All items delivered",
            timestamp: new Date(),
          },
        },
      });
    }
  }

  private getProvider(provider: DeliveryProvider): IShippingProvider {
    // In production, implement actual provider integrations
    // This is a mock implementation
    return {
      async createShipment(data) {
        // Generate mock data
        const trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        return {
          trackingNumber,
          awbNumber: trackingNumber,
          courierName: provider.charAt(0).toUpperCase() + provider.slice(1),
          labelUrl: `https://example.com/labels/${trackingNumber}.pdf`,
          estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          providerOrderId: `PO-${Date.now()}`,
          providerShipmentId: `PS-${Date.now()}`,
          shippingCost: data.packageDetails.weight * 50,
        };
      },

      async trackShipment(trackingNumber) {
        return {
          status: ShipmentStatus.IN_TRANSIT,
          events: [
            {
              status: ShipmentStatus.IN_TRANSIT,
              description: "Package in transit",
              location: "Delhi Hub",
              timestamp: new Date(),
            },
          ],
        };
      },

      async cancelShipment(trackingNumber) {
        return true;
      },
    };
  }
}

export const shippingService = new ShippingService();
