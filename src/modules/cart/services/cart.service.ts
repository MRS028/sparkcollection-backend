/**
 * Cart Service
 * Business logic for cart operations
 */

import { Types } from "mongoose";
import { Cart, ICart, ICartItem } from "../models/Cart.model.js";
import { Product, ProductStatus } from "../../product/index.js";
import {
  NotFoundError,
  BadRequestError,
} from "../../../shared/errors/index.js";
import { redis } from "../../../config/redis.js";
import { logger } from "../../../shared/utils/logger.js";
import { couponService } from "../../coupon/services/coupon.service.js";

export interface AddToCartInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  itemId: string;
  quantity: number;
}

class CartService {
  private readonly cachePrefix = "cart:";
  private readonly cacheTTL = 1800; // 30 minutes
  private readonly guestCartExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Get or create cart for user/session
   */
  async getOrCreateCart(
    userId?: string,
    sessionId?: string,
    tenantId: string = "default",
  ): Promise<ICart> {
    if (!userId && !sessionId) {
      throw new BadRequestError("User ID or Session ID is required");
    }

    // Try cache first
    const cacheKey = this.getCacheKey(userId, sessionId);
    const cached = await redis.get<ICart>(cacheKey);
    if (cached) {
      return cached as unknown as ICart;
    }

    // Find existing cart
    let cart = await Cart.findOne(
      userId
        ? { userId: new Types.ObjectId(userId), tenantId }
        : { sessionId, tenantId },
    );

    // Create new cart if not found
    if (!cart) {
      cart = await Cart.create({
        userId: userId ? new Types.ObjectId(userId) : undefined,
        sessionId: userId ? undefined : sessionId,
        tenantId,
        expiresAt: userId
          ? undefined
          : new Date(Date.now() + this.guestCartExpiry),
      });
    }

    await redis.set(cacheKey, cart.toJSON(), this.cacheTTL);
    return cart;
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    input: AddToCartInput,
    tenantId: string = "default",
  ): Promise<ICart> {
    const cart = await this.getOrCreateCart(userId, sessionId, tenantId);

    // Get product and validate
    const product = await Product.findById(input.productId);
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundError("Product");
    }

    let itemData: Partial<ICartItem> = {
      productId: product._id,
      sku: product.sku,
      name: product.name,
      image: product.images[0]?.url,
      price: product.basePrice,
      compareAtPrice: product.compareAtPrice,
      quantity: input.quantity,
    };

    // Handle variant
    if (input.variantId) {
      const variant = product.variants.find(
        (v) => v._id?.toString() === input.variantId,
      );
      if (!variant || !variant.isActive) {
        throw new NotFoundError("Product variant");
      }

      // Check stock
      if (variant.stock < input.quantity) {
        throw new BadRequestError(`Only ${variant.stock} items available`);
      }

      itemData = {
        ...itemData,
        variantId: variant._id,
        sku: variant.sku,
        name: `${product.name} - ${variant.name}`,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        attributes: variant.attributes,
      };

      if (variant.images.length > 0) {
        itemData.image = variant.images[0];
      }
    } else {
      // Check main product stock
      if (product.totalStock < input.quantity) {
        throw new BadRequestError(`Only ${product.totalStock} items available`);
      }
    }

    // Check if item already exists
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === input.productId &&
        (!input.variantId || item.variantId?.toString() === input.variantId),
    );

    if (existingItemIndex > -1) {
      const newQuantity =
        cart.items[existingItemIndex].quantity + input.quantity;

      // Validate total quantity against stock
      if (input.variantId) {
        const variant = product.variants.find(
          (v) => v._id?.toString() === input.variantId,
        );
        if (variant && variant.stock < newQuantity) {
          throw new BadRequestError(`Only ${variant.stock} items available`);
        }
      } else if (product.totalStock < newQuantity) {
        throw new BadRequestError(`Only ${product.totalStock} items available`);
      }

      cart.items[existingItemIndex].quantity = newQuantity;
      cart.markModified("items");
    } else {
      cart.items.push(itemData as ICartItem);
    }

    await cart.save();
    await this.invalidateCache(userId, sessionId);

    // Reload cart to ensure _id fields are populated for new items
    const updatedCart = await Cart.findById(cart._id);
    if (updatedCart) {
      await redis.set(
        this.getCacheKey(userId, sessionId),
        updatedCart.toJSON(),
        this.cacheTTL,
      );
    }

    logger.info(`Item added to cart: ${itemData.sku}`);
    return updatedCart || cart;
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(
    userId: string | undefined,
    sessionId: string | undefined,
    input: UpdateCartItemInput,
    tenantId: string = "default",
  ): Promise<ICart> {
    // Fetch directly from DB to ensure proper ObjectId handling (not from cache)
    let cart = await Cart.findOne(
      userId
        ? { userId: new Types.ObjectId(userId), tenantId }
        : { sessionId, tenantId },
    );

    if (!cart) {
      throw new NotFoundError("Cart");
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id?.toString() === input.itemId.trim(),
    );

    if (itemIndex === -1) {
      const availableIds = cart.items
        .map((i) => `${i.name}: ${i._id?.toString()}`)
        .join(", ");
      logger.error(
        `Cart item not found. Requested itemId: "${input.itemId}". Cart has ${cart.items.length} items. Available: ${availableIds}`,
      );
      throw new NotFoundError(
        `Cart item. Available item IDs: [${cart.items.map((i) => i._id?.toString()).join(", ")}]`,
      );
    }

    const item = cart.items[itemIndex];

    // Validate stock
    const product = await Product.findById(item.productId);
    if (!product) {
      // Product no longer exists, remove from cart
      cart.items.splice(itemIndex, 1);
      await cart.save();
      throw new BadRequestError("Product no longer available");
    }

    if (item.variantId) {
      const variant = product.variants.find(
        (v) => v._id?.toString() === item.variantId?.toString(),
      );
      if (!variant || variant.stock < input.quantity) {
        throw new BadRequestError(
          `Only ${variant?.stock || 0} items available`,
        );
      }
    } else if (product.totalStock < input.quantity) {
      throw new BadRequestError(`Only ${product.totalStock} items available`);
    }

    if (input.quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = input.quantity;
    }

    // Mark items array as modified for Mongoose to detect changes
    cart.markModified("items");
    await cart.save();
    await this.invalidateCache(userId, sessionId);

    // Reload cart to ensure all fields are properly populated
    const updatedCart = await Cart.findById(cart._id);
    if (updatedCart) {
      await redis.set(
        this.getCacheKey(userId, sessionId),
        updatedCart.toJSON(),
        this.cacheTTL,
      );
    }

    return updatedCart || cart;
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
    tenantId: string = "default",
  ): Promise<ICart> {
    // Fetch directly from DB to ensure proper ObjectId handling
    let cart = await Cart.findOne(
      userId
        ? { userId: new Types.ObjectId(userId), tenantId }
        : { sessionId, tenantId },
    );

    if (!cart) {
      throw new NotFoundError("Cart");
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id?.toString() === itemId.trim(),
    );

    if (itemIndex === -1) {
      throw new NotFoundError("Cart item");
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    await this.invalidateCache(userId, sessionId);

    logger.info(`Item removed from cart: ${itemId}`);
    return cart;
  }

  /**
   * Clear cart
   */
  async clearCart(
    userId: string | undefined,
    sessionId: string | undefined,
    tenantId: string = "default",
  ): Promise<ICart> {
    const cart = await this.getOrCreateCart(userId, sessionId, tenantId);

    cart.items = [];
    cart.discount = 0;
    cart.discountCode = undefined;
    await cart.save();
    await this.invalidateCache(userId, sessionId);

    logger.info("Cart cleared");
    return cart;
  }

  /**
   * Apply discount code
   */
  async applyDiscountCode(
    userId: string | undefined,
    sessionId: string | undefined,
    code: string,
    tenantId: string = "default",
  ): Promise<ICart> {
    const cart = await this.getOrCreateCart(userId, sessionId, tenantId);

    // Prepare cart items for validation
    const cartItems = cart.items.map((item) => ({
      productId: item.productId.toString(),
      categoryId: undefined, // TODO: Add category tracking to cart items if needed
    }));

    // Validate coupon
    const validation = await couponService.validateCoupon(
      {
        code,
        userId,
        cartAmount: cart.subtotal,
        cartItems,
      },
      tenantId,
    );

    if (!validation.isValid) {
      throw new BadRequestError(
        validation.message || "Invalid or expired coupon code",
      );
    }

    // Apply discount
    cart.discount = validation.discount;
    cart.discountCode = code;

    await cart.save();
    await this.invalidateCache(userId, sessionId);

    logger.info(`Discount applied: ${code} - ₹${validation.discount}`);
    return cart;
  }

  /**
   * Remove discount code
   */
  async removeDiscountCode(
    userId: string | undefined,
    sessionId: string | undefined,
    tenantId: string = "default",
  ): Promise<ICart> {
    const cart = await this.getOrCreateCart(userId, sessionId, tenantId);

    cart.discount = 0;
    cart.discountCode = undefined;
    await cart.save();
    await this.invalidateCache(userId, sessionId);

    return cart;
  }

  /**
   * Merge guest cart with user cart on login
   */
  async mergeCarts(
    userId: string,
    sessionId: string,
    tenantId: string = "default",
  ): Promise<ICart> {
    const [userCart, guestCart] = await Promise.all([
      Cart.findOne({ userId: new Types.ObjectId(userId), tenantId }),
      Cart.findOne({ sessionId, tenantId }),
    ]);

    if (!guestCart || guestCart.items.length === 0) {
      return (
        userCart || (await this.getOrCreateCart(userId, undefined, tenantId))
      );
    }

    const targetCart =
      userCart || (await this.getOrCreateCart(userId, undefined, tenantId));

    // Merge items from guest cart
    for (const guestItem of guestCart.items) {
      const existingIndex = targetCart.items.findIndex(
        (item) =>
          item.productId.toString() === guestItem.productId.toString() &&
          (!guestItem.variantId ||
            item.variantId?.toString() === guestItem.variantId?.toString()),
      );

      if (existingIndex > -1) {
        targetCart.items[existingIndex].quantity += guestItem.quantity;
        targetCart.markModified("items");
      } else {
        targetCart.items.push(guestItem);
      }
    }

    await targetCart.save();

    // Delete guest cart
    await Cart.deleteOne({ _id: guestCart._id });
    await this.invalidateCache(undefined, sessionId);
    await this.invalidateCache(userId, undefined);

    logger.info(`Merged guest cart for user: ${userId}`);
    return targetCart;
  }

  /**
   * Validate cart items (check stock, prices)
   */
  async validateCart(
    userId: string | undefined,
    sessionId: string | undefined,
    tenantId: string = "default",
  ): Promise<{ cart: ICart; issues: string[] }> {
    const cart = await this.getOrCreateCart(userId, sessionId, tenantId);
    const issues: string[] = [];
    let hasChanges = false;

    for (let i = cart.items.length - 1; i >= 0; i--) {
      const item = cart.items[i];
      const product = await Product.findById(item.productId);

      if (!product || product.status !== ProductStatus.ACTIVE) {
        issues.push(`${item.name} is no longer available`);
        cart.items.splice(i, 1);
        hasChanges = true;
        continue;
      }

      let currentPrice = product.basePrice;
      let availableStock = product.totalStock;

      if (item.variantId) {
        const variant = product.variants.find(
          (v) => v._id?.toString() === item.variantId?.toString(),
        );
        if (!variant || !variant.isActive) {
          issues.push(`${item.name} variant is no longer available`);
          cart.items.splice(i, 1);
          hasChanges = true;
          continue;
        }
        currentPrice = variant.price;
        availableStock = variant.stock;
      }

      // Check price changes
      if (item.price !== currentPrice) {
        issues.push(
          `Price for ${item.name} has changed from ₹${item.price} to ₹${currentPrice}`,
        );
        item.price = currentPrice;
        hasChanges = true;
      }

      // Check stock
      if (availableStock < item.quantity) {
        if (availableStock === 0) {
          issues.push(`${item.name} is out of stock`);
          cart.items.splice(i, 1);
        } else {
          issues.push(`Only ${availableStock} units of ${item.name} available`);
          item.quantity = availableStock;
        }
        hasChanges = true;
      }
    }

    if (hasChanges) {
      cart.markModified("items");
      await cart.save();
      await this.invalidateCache(userId, sessionId);
    }

    return { cart, issues };
  }

  // Private helper methods

  private getCacheKey(userId?: string, sessionId?: string): string {
    return userId
      ? `${this.cachePrefix}user:${userId}`
      : `${this.cachePrefix}session:${sessionId}`;
  }

  private async invalidateCache(
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    if (userId) {
      await redis.del(`${this.cachePrefix}user:${userId}`);
    }
    if (sessionId) {
      await redis.del(`${this.cachePrefix}session:${sessionId}`);
    }
  }
}

export const cartService = new CartService();
