/**
 * Support Routes
 * Route definitions for support and AI chat operations
 */

import { Router } from "express";
import { supportController } from "../controllers/support.controller.js";
import {
  authenticate,
  authorize,
  optionalAuth,
} from "../../auth/middleware/auth.middleware.js";
import { validate } from "../../../shared/middleware/validate.js";
import { UserRole } from "../../../shared/types/index.js";
import {
  createTicketSchema,
  getTicketSchema,
  getByTicketNumberSchema,
  addMessageSchema,
  updateStatusSchema,
  assignTicketSchema,
  updatePrioritySchema,
  ticketFiltersSchema,
  chatMessageSchema,
  getChatHistorySchema,
} from "../validators/support.validator.js";

const router = Router();

// ==================== AI Chat Routes ====================
// These can work with optional auth for guest users

// Send chat message
router.post(
  "/chat",
  optionalAuth,
  validate(chatMessageSchema),
  supportController.chat,
);

// Get chat history
router.get(
  "/chat/:sessionId",
  optionalAuth,
  validate(getChatHistorySchema),
  supportController.getChatHistory,
);

// Close chat session
router.post(
  "/chat/:sessionId/close",
  optionalAuth,
  supportController.closeChatSession,
);

// ==================== Ticket Routes ====================
// All ticket routes require authentication
router.use("/tickets", authenticate);

// Customer routes
router.post(
  "/tickets",
  validate(createTicketSchema),
  supportController.createTicket,
);

router.get("/tickets/my-tickets", supportController.getUserTickets);

// Support Agent & Admin routes
router.get(
  "/tickets",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate(ticketFiltersSchema),
  supportController.getAllTickets,
);

router.get(
  "/tickets/statistics",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  supportController.getStatistics,
);

// Shared ticket routes (with authorization in controller)
router.get(
  "/tickets/:ticketId",
  validate(getTicketSchema),
  supportController.getTicketById,
);

router.get(
  "/tickets/number/:ticketNumber",
  validate(getByTicketNumberSchema),
  supportController.getTicketByNumber,
);

router.post(
  "/tickets/:ticketId/messages",
  validate(addMessageSchema),
  supportController.addMessage,
);

// Admin/Support Agent only
router.patch(
  "/tickets/:ticketId/status",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate(updateStatusSchema),
  supportController.updateStatus,
);

router.post(
  "/tickets/:ticketId/assign",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate(assignTicketSchema),
  supportController.assignTicket,
);

router.patch(
  "/tickets/:ticketId/priority",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate(updatePrioritySchema),
  supportController.updatePriority,
);

export const supportRoutes = router;
