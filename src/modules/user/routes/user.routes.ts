/**
 * User Routes
 */

import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { authenticate, adminOnly, ownerOrAdmin } from "../../auth/index.js";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../shared/middleware/validate.js";
import {
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdParamsSchema,
  userListQuerySchema,
  updateRoleSchema,
  updateStatusSchema,
} from "../validators/user.validator.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile routes (current user)
router.get("/profile", userController.getProfile);
router.patch(
  "/profile",
  validateBody(updateProfileSchema),
  userController.updateProfile,
);

// Admin routes
router.get(
  "/",
  adminOnly,
  validateQuery(userListQuerySchema),
  userController.getUsers,
);

router.get("/statistics", adminOnly, userController.getUserStatistics);

router.post(
  "/",
  adminOnly,
  validateBody(createUserSchema),
  userController.createUser,
);

router.get(
  "/:id",
  validateParams(userIdParamsSchema),
  ownerOrAdmin((req) => req.params.id),
  userController.getUserById,
);

router.patch(
  "/:id",
  adminOnly,
  validateParams(userIdParamsSchema),
  validateBody(updateUserSchema),
  userController.updateUser,
);

router.patch(
  "/:id/role",
  adminOnly,
  validateParams(userIdParamsSchema),
  validateBody(updateRoleSchema),
  userController.updateUserRole,
);

router.patch(
  "/:id/status",
  adminOnly,
  validateParams(userIdParamsSchema),
  validateBody(updateStatusSchema),
  userController.updateUserStatus,
);

router.patch(
  "/:id/ban",
  adminOnly,
  validateParams(userIdParamsSchema),
  userController.banUser,
);

router.delete(
  "/delete/:id",
  adminOnly,
  validateParams(userIdParamsSchema),
  userController.deleteUser,
);

export default router;
