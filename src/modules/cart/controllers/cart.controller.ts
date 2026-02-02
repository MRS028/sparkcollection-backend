/**
 * Cart Controller
 * Thin controller for cart operations
 */

import { Response } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { cartService } from "../services/cart.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { sendSuccess } from "../../../shared/utils/apiResponse.js";

export class CartController {
  /**
   * Get cart
   * GET /api/v1/cart
   */
  getCart = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;

      const cart = await cartService.getOrCreateCart(userId, sessionId);

      sendSuccess(res, cart, "Cart retrieved successfully");
    },
  );

  /**
   * Add item to cart
   * POST /api/v1/cart/items
   */
  addItem = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;
      const { productId, variantId, quantity } = req.body;

      const cart = await cartService.addItem(userId, sessionId, {
        productId,
        variantId,
        quantity,
      });

      sendSuccess(res, cart, "Item added to cart", 201);
    },
  );

  /**
   * Update item quantity
   * PATCH /api/v1/cart/items/:itemId
   */
  updateItem = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;
      const { itemId } = req.params;
      const { quantity } = req.body;

      const cart = await cartService.updateItemQuantity(userId, sessionId, {
        itemId,
        quantity,
      });

      sendSuccess(res, cart, "Cart item updated");
    },
  );

  /**
   * Remove item from cart
   * DELETE /api/v1/cart/items/:itemId
   */
  removeItem = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;
      const { itemId } = req.params;

      const cart = await cartService.removeItem(userId, sessionId, itemId);

      sendSuccess(res, cart, "Item removed from cart");
    },
  );

  /**
   * Clear cart
   * DELETE /api/v1/cart
   */
  clearCart = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;

      const cart = await cartService.clearCart(userId, sessionId);

      sendSuccess(res, cart, "Cart cleared");
    },
  );

  /**
   * Apply discount code
   * POST /api/v1/cart/discount
   */
  applyDiscount = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;
      const { code } = req.body;

      const cart = await cartService.applyDiscountCode(userId, sessionId, code);

      sendSuccess(res, cart, "Discount applied");
    },
  );

  /**
   * Remove discount code
   * DELETE /api/v1/cart/discount
   */
  removeDiscount = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;

      const cart = await cartService.removeDiscountCode(userId, sessionId);

      sendSuccess(res, cart, "Discount removed");
    },
  );

  /**
   * Merge guest cart with user cart
   * POST /api/v1/cart/merge
   */
  mergeCarts = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user!.id;
      const { sessionId } = req.body;

      const cart = await cartService.mergeCarts(userId, sessionId);

      sendSuccess(res, cart, "Carts merged successfully");
    },
  );

  /**
   * Validate cart
   * POST /api/v1/cart/validate
   */
  validateCart = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const sessionId = req.headers["x-session-id"] as string | undefined;

      const result = await cartService.validateCart(userId, sessionId);

      sendSuccess(
        res,
        result,
        result.issues.length > 0
          ? "Cart has issues that need attention"
          : "Cart is valid",
      );
    },
  );
}

export const cartController = new CartController();
