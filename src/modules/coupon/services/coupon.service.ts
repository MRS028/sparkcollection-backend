/**
 * Coupon Service
 * Business logic for coupon operations
 */

import { Types } from "mongoose";
import {
  Coupon,
  ICoupon,
  DiscountType,
  CouponStatus,
} from "../models/Coupon.model.js";
import { Cart } from "../../cart/models/Cart.model.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../../shared/errors/index.js";
import { logger } from "../../../shared/utils/logger.js";

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  startDate: Date;
  endDate: Date;
  totalUsageLimit?: number;
  usagePerUser?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  status?: CouponStatus;
}

export interface UpdateCouponInput {
  description?: string;
  discountValue?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  startDate?: Date;
  endDate?: Date;
  totalUsageLimit?: number;
  usagePerUser?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  status?: CouponStatus;
}

export interface ValidateCouponInput {
  code: string;
  userId?: string;
  cartAmount: number;
  cartItems?: Array<{ productId: string; categoryId?: string }>;
}

export interface CouponValidationResult {
  isValid: boolean;
  discount: number;
  message?: string;
  coupon?: ICoupon;
}

class CouponService {
  /**
   * Create a new coupon
   */
  async createCoupon(
    input: CreateCouponInput,
    createdBy: string,
    tenantId: string = "default",
  ): Promise<ICoupon> {
    // Check if code already exists
    const existing = await Coupon.findOne({
      code: input.code.toUpperCase(),
      tenantId,
    });

    if (existing) {
      throw new BadRequestError("Coupon code already exists");
    }

    const coupon = await Coupon.create({
      ...input,
      code: input.code.toUpperCase(),
      createdBy: new Types.ObjectId(createdBy),
      tenantId,
      totalUsed: 0,
    });

    logger.info(`Coupon created: ${coupon.code}`);
    return coupon;
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(
    code: string,
    tenantId: string = "default",
  ): Promise<ICoupon> {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      tenantId,
    });

    if (!coupon) {
      throw new NotFoundError("Coupon");
    }

    return coupon;
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(
    id: string,
    tenantId: string = "default",
  ): Promise<ICoupon> {
    const coupon = await Coupon.findOne({
      _id: new Types.ObjectId(id),
      tenantId,
    });

    if (!coupon) {
      throw new NotFoundError("Coupon");
    }

    return coupon;
  }

  /**
   * List all coupons
   */
  async listCoupons(
    tenantId: string = "default",
    filters?: {
      status?: CouponStatus;
      search?: string;
    },
  ): Promise<ICoupon[]> {
    const query: any = { tenantId };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.search) {
      query.$or = [
        { code: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    const coupons = await Coupon.find(query).sort({ createdAt: -1 });
    return coupons;
  }

  /**
   * Update coupon
   */
  async updateCoupon(
    id: string,
    input: UpdateCouponInput,
    tenantId: string = "default",
  ): Promise<ICoupon> {
    const coupon = await this.getCouponById(id, tenantId);

    Object.assign(coupon, input);
    await coupon.save();

    logger.info(`Coupon updated: ${coupon.code}`);
    return coupon;
  }

  /**
   * Delete coupon
   */
  async deleteCoupon(id: string, tenantId: string = "default"): Promise<void> {
    const coupon = await this.getCouponById(id, tenantId);
    await Coupon.deleteOne({ _id: coupon._id });
    logger.info(`Coupon deleted: ${coupon.code}`);
  }

  /**
   * Validate and calculate discount for a coupon
   */
  async validateCoupon(
    input: ValidateCouponInput,
    tenantId: string = "default",
  ): Promise<CouponValidationResult> {
    const coupon = await this.getCouponByCode(input.code, tenantId);

    // Check if coupon is valid
    if (!coupon.isValid()) {
      if (coupon.status !== CouponStatus.ACTIVE) {
        return {
          isValid: false,
          discount: 0,
          message: "Coupon is not active",
        };
      }

      const now = new Date();
      if (now < coupon.startDate) {
        return {
          isValid: false,
          discount: 0,
          message: "Coupon is not yet active",
        };
      }

      if (now > coupon.endDate) {
        return {
          isValid: false,
          discount: 0,
          message: "Coupon has expired",
        };
      }

      if (
        coupon.totalUsageLimit &&
        coupon.totalUsed >= coupon.totalUsageLimit
      ) {
        return {
          isValid: false,
          discount: 0,
          message: "Coupon usage limit reached",
        };
      }
    }

    // Check minimum order amount
    if (input.cartAmount < coupon.minOrderAmount) {
      return {
        isValid: false,
        discount: 0,
        message: `Minimum order amount of ${coupon.minOrderAmount} required`,
      };
    }

    // Check per-user usage limit
    if (input.userId) {
      const usedCount = await this.getUserCouponUsageCount(
        input.userId,
        coupon._id.toString(),
        tenantId,
      );

      if (!coupon.canBeUsedBy(input.userId, usedCount)) {
        return {
          isValid: false,
          discount: 0,
          message: "You have already used this coupon maximum times",
        };
      }
    }

    // Check product/category applicability
    if (input.cartItems && input.cartItems.length > 0) {
      const isApplicable = this.checkApplicability(coupon, input.cartItems);
      if (!isApplicable) {
        return {
          isValid: false,
          discount: 0,
          message: "Coupon is not applicable to items in your cart",
        };
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discount = (input.cartAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.discountValue;
      if (discount > input.cartAmount) {
        discount = input.cartAmount;
      }
    }

    discount = Math.round(discount * 100) / 100;

    return {
      isValid: true,
      discount,
      coupon,
      message: "Coupon applied successfully",
    };
  }

  /**
   * Get user's usage count for a coupon
   */
  private async getUserCouponUsageCount(
    userId: string,
    couponId: string,
    tenantId: string,
  ): Promise<number> {
    // This would need an Order model to track actual usage
    // For now, returning 0 as placeholder
    // TODO: Implement when Order model is available
    return 0;
  }

  /**
   * Check if coupon is applicable to cart items
   */
  private checkApplicability(
    coupon: ICoupon,
    cartItems: Array<{ productId: string; categoryId?: string }>,
  ): boolean {
    // If no restrictions, applicable to all
    if (
      (!coupon.applicableProducts || coupon.applicableProducts.length === 0) &&
      (!coupon.applicableCategories || coupon.applicableCategories.length === 0)
    ) {
      return true;
    }

    // Check if at least one item matches the criteria
    for (const item of cartItems) {
      // Check product restriction
      if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
        const productMatch = coupon.applicableProducts.some(
          (p) => p.toString() === item.productId,
        );
        if (productMatch) return true;
      }

      // Check category restriction
      if (
        coupon.applicableCategories &&
        coupon.applicableCategories.length > 0 &&
        item.categoryId
      ) {
        const categoryMatch = coupon.applicableCategories.some(
          (c) => c.toString() === item.categoryId,
        );
        if (categoryMatch) return true;
      }
    }

    return false;
  }

  /**
   * Increment usage count for a coupon
   */
  async incrementUsage(
    couponId: string,
    tenantId: string = "default",
  ): Promise<void> {
    await Coupon.updateOne(
      { _id: new Types.ObjectId(couponId), tenantId },
      { $inc: { totalUsed: 1 } },
    );
  }
}

export const couponService = new CouponService();
