/**
 * Zod Validation Middleware
 * Validates request body, query, and params against Zod schemas
 */

import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError, ZodEffects, ZodTypeAny } from "zod";
import { ValidationError } from "../errors/index.js";

type ZodSchema = AnyZodObject | ZodEffects<ZodTypeAny>;

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request against Zod schemas
 */
export const validate = (schemas: ValidationSchemas) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = ValidationError.fromZodError(error);
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate only request body
 */
export const validateBody = (schema: ZodSchema) => validate({ body: schema });

/**
 * Validate only query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });

/**
 * Validate only route parameters
 */
export const validateParams = (schema: ZodSchema) =>
  validate({ params: schema });

/**
 * Combined validation for all parts of the request
 */
export const validateRequest = validate;

export default validate;
