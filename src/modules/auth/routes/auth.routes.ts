/**
 * Authentication Routes
 */

import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateBody } from "../../../shared/middleware/validate.js";
import {
  authLimiter,
  passwordResetLimiter,
} from "../../../shared/middleware/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

// Public routes
router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  authController.register,
);

router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  authController.login,
);

router.post("/refresh", authController.refreshToken);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword,
);

// Protected routes
router.post("/logout", authenticate, authController.logout);

router.post("/logout-all", authenticate, authController.logoutAll);

router.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword,
);

router.get("/me", authenticate, authController.getCurrentUser);

export default router;
