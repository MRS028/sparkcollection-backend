/**
 * Coupon Controller
 * Handles coupon-related HTTP requests
 */

import { Response } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { couponService } from "../services/coupon.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../../shared/utils/apiResponse.js";

export class CouponController {
  /**
   * Create a new coupon
   * POST /api/v1/coupons
   */
  createCoupon = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const createdBy = req.user!.userId;
      const coupon = await couponService.createCoupon(req.body, createdBy);

      sendSuccess(res, coupon, {
        message: "Coupon created successfully",
        statusCode: 201,
      });
    },
  );

  /**
   * Get all coupons
   * GET /api/v1/coupons
   */
  listCoupons = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { status, search } = req.query;

      const coupons = await couponService.listCoupons("default", {
        status: status as any,
        search: search as string,
      });

      sendSuccess(res, coupons, {
        message: "Coupons retrieved successfully",
      });
    },
  );

  /**
   * Get coupon by code
   * GET /api/v1/coupons/code/:code
   */
  getCouponByCode = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { code } = req.params;
      const coupon = await couponService.getCouponByCode(code);

      sendSuccess(res, coupon, {
        message: "Coupon retrieved successfully",
      });
    },
  );

  /**
   * Get coupon by ID
   * GET /api/v1/coupons/:id
   */
  getCouponById = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const coupon = await couponService.getCouponById(id);

      sendSuccess(res, coupon, {
        message: "Coupon retrieved successfully",
      });
    },
  );

  /**
   * Update coupon
   * PATCH /api/v1/coupons/:id
   */
  updateCoupon = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const coupon = await couponService.updateCoupon(id, req.body);

      sendSuccess(res, coupon, {
        message: "Coupon updated successfully",
      });
    },
  );

  /**
   * Delete coupon
   * DELETE /api/v1/coupons/:id
   */
  deleteCoupon = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      await couponService.deleteCoupon(id);

      sendSuccess(res, null, {
        message: "Coupon deleted successfully",
      });
    },
  );

  /**
   * Validate coupon (public endpoint for cart)
   * POST /api/v1/coupons/validate
   */
  validateCoupon = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.userId;
      const { code, cartAmount, cartItems } = req.body;

      const result = await couponService.validateCoupon({
        code,
        userId,
        cartAmount,
        cartItems,
      });

      if (result.isValid) {
        sendSuccess(res, result, {
          message: result.message || "Coupon is valid",
        });
      } else {
        sendSuccess(
          res,
          { isValid: false, discount: 0 },
          {
            message: result.message || "Coupon is invalid",
            statusCode: 400,
          },
        );
      }
    },
  );
}

export const couponController = new CouponController();
