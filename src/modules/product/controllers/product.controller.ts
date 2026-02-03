/**
 * Product Controller
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../shared/types/index.js";
import { productService } from "../services/product.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from "../../../shared/utils/apiResponse.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {
  CreateProductInput,
  UpdateProductInput,
  ProductListQuery,
  SearchQuery,
  AddVariantInput,
  UpdateVariantInput,
  UpdateStockInput,
} from "../validators/product.validator.js";

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Seller, Admin
 */
export const createProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const input: CreateProductInput = req.body;
    const product = await productService.create({
      ...input,
      sellerId: req.user!.userId,
      tenantId: req.tenantId || "default",
    });

    sendCreated(res, { product }, "Product created successfully");
  },
);

/**
 * @route   GET /api/v1/products
 * @desc    Get all products
 * @access  Public
 */
export const getProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const brand = req.query.brand as string;
    const search = req.query.search as string;

    const result = await productService.getAll(
      {
        category,
        status: status as any,
        brand,
        search,
      },
      {
        page,
        limit,
      },
    );

    sendPaginated(res, result.data, result.pagination);
  },
);

/**
 * @route   GET /api/v1/products/search
 * @desc    Search products
 * @access  Public
 */
export const searchProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const searchTerm = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;

    if (!searchTerm) {
      return sendSuccess(res, { products: [], total: 0 });
    }

    const result = await productService.search(
      searchTerm,
      { category },
      { page, limit },
    );

    sendPaginated(res, result.data, result.pagination);
  },
);

/**
 * @route   GET /api/v1/products/featured
 * @desc    Get featured products
 * @access  Public
 */
export const getFeaturedProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const products = await productService.getFeatured(limit);

    sendSuccess(res, { products, count: products.length });
  },
);

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
export const getProductById = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const product = await productService.getById(id);

    sendSuccess(res, { product });
  },
);

/**
 * @route   GET /api/v1/products/slug/:slug
 * @desc    Get product by slug
 * @access  Public
 */
export const getProductBySlug = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { slug } = req.params;
    const product = await productService.getBySlug(slug);

    sendSuccess(res, { product });
  },
);

/**
 * @route   GET /api/v1/products/:id/related
 * @desc    Get related products
 * @access  Public
 */
export const getRelatedProducts = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 6;
    const products = await productService.getRelated(id, limit);

    sendSuccess(res, { products });
  },
);

/**
 * @route   PATCH /api/v1/products/:id
 * @desc    Update product
 * @access  Seller (owner), Admin
 */
export const updateProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const input: UpdateProductInput = req.body;
    const product = await productService.update(id, input, req.user!.userId);

    sendSuccess(res, { product }, { message: "Product updated successfully" });
  },
);

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete product
 * @access  Seller (owner), Admin
 */
export const deleteProduct = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    await productService.delete(id, req.user!.userId);

    sendNoContent(res);
  },
);

/**
 * @route   POST /api/v1/products/:id/variants
 * @desc    Add variant to product
 * @access  Seller (owner), Admin
 */
export const addVariant = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const input: AddVariantInput = req.body;
    const product = await productService.addVariant(
      id,
      input,
      req.user!.userId,
    );

    sendCreated(res, { product }, "Variant added successfully");
  },
);

/**
 * @route   PATCH /api/v1/products/:id/variants/:variantId
 * @desc    Update variant
 * @access  Seller (owner), Admin
 */
export const updateVariant = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id, variantId } = req.params;
    const input: UpdateVariantInput = req.body;
    const product = await productService.updateVariant(
      id,
      variantId,
      input,
      req.user!.userId,
    );

    sendSuccess(res, { product }, { message: "Variant updated successfully" });
  },
);

/**
 * @route   PATCH /api/v1/products/:id/stock
 * @desc    Update product/variant stock
 * @access  Seller (owner), Admin
 */
export const updateStock = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const { quantity, type, notes, variantId }: UpdateStockInput = req.body;
    const product = await productService.updateStock(
      id,
      variantId || null,
      quantity,
      type,
      req.user!.userId,
      notes,
    );

    sendSuccess(res, { product }, { message: "Stock updated successfully" });
  },
);
