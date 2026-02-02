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
  validate({ body: chatMessageSchema.shape.body }),
  supportController.chat,
);

// Get chat history
router.get(
  "/chat/:sessionId",
  optionalAuth,
  validate({ params: getChatHistorySchema.shape.params }),
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
  validate({ body: createTicketSchema.shape.body }),
  supportController.createTicket,
);

router.get("/tickets/my-tickets", supportController.getUserTickets);

// Support Agent & Admin routes
router.get(
  "/tickets",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate({ query: ticketFiltersSchema.shape.query }),
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
  validate({ params: getTicketSchema.shape.params }),
  supportController.getTicketById,
);

router.get(
  "/tickets/number/:ticketNumber",
  validate({ params: getByTicketNumberSchema.shape.params }),
  supportController.getTicketByNumber,
);

router.post(
  "/tickets/:ticketId/messages",
  validate({
    params: addMessageSchema.shape.params,
    body: addMessageSchema.shape.body,
  }),
  supportController.addMessage,
);

// Admin/Support Agent only
router.patch(
  "/tickets/:ticketId/status",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate({
    params: updateStatusSchema.shape.params,
    body: updateStatusSchema.shape.body,
  }),
  supportController.updateStatus,
);

router.post(
  "/tickets/:ticketId/assign",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate({
    params: assignTicketSchema.shape.params,
    body: assignTicketSchema.shape.body,
  }),
  supportController.assignTicket,
);

router.patch(
  "/tickets/:ticketId/priority",
  authorize(UserRole.ADMIN, UserRole.SUPPORT_AGENT),
  validate({
    params: updatePrioritySchema.shape.params,
    body: updatePrioritySchema.shape.body,
  }),
  supportController.updatePriority,
);

export const supportRoutes = router;
