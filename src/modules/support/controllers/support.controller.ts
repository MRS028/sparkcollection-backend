/**
 * Support Controller
 * Thin controller for support operations
 */

import { Response } from "express";
import { AuthRequest, UserRole } from "../../../shared/types/index.js";
import { supportTicketService } from "../services/ticket.service.js";
import { aiSupportService } from "../services/ai-support.service.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {
  sendSuccess,
  sendPaginated,
} from "../../../shared/utils/apiResponse.js";

export class SupportController {
  // ==================== Ticket Endpoints ====================

  /**
   * Create ticket
   * POST /api/v1/support/tickets
   */
  createTicket = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user!.userId;
      const { subject, description, category, priority, orderId, tags } =
        req.body;

      const ticket = await supportTicketService.create({
        userId,
        subject,
        description,
        category,
        priority,
        orderId,
        tags,
      });

      sendSuccess(res, ticket, { message: "Ticket created", statusCode: 201 });
    },
  );

  /**
   * Get ticket by ID
   * GET /api/v1/support/tickets/:ticketId
   */
  getTicketById = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { ticketId } = req.params;
      const userId = req.user!.userId;
      const role = req.user!.role as UserRole;

      const ticket = await supportTicketService.getById(ticketId, userId, role);

      sendSuccess(res, ticket, { message: "Ticket retrieved" });
    },
  );

  /**
   * Get ticket by ticket number
   * GET /api/v1/support/tickets/number/:ticketNumber
   */
  getTicketByNumber = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { ticketNumber } = req.params;

      const ticket = await supportTicketService.getByTicketNumber(ticketNumber);

      sendSuccess(res, ticket, { message: "Ticket retrieved" });
    },
  );

  /**
   * Get user tickets
   * GET /api/v1/support/tickets/my-tickets
   */
  getUserTickets = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user!.userId;
      const { page, limit, sortBy, sortOrder } = req.query;

      const result = await supportTicketService.getUserTickets(userId, {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        sortBy: (sortBy as string) || "createdAt",
        sortOrder: (sortOrder as "asc" | "desc") || "desc",
      });

      sendPaginated(res, result.data, result.pagination, "Tickets retrieved");
    },
  );

  /**
   * Get all tickets (Admin/Support Agent)
   * GET /api/v1/support/tickets
   */
  getAllTickets = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const {
        page,
        limit,
        sortBy,
        sortOrder,
        status,
        priority,
        category,
        search,
      } = req.query;

      const result = await supportTicketService.getAll(
        {
          status: status as any,
          priority: priority as any,
          category: category as any,
          search: search as string,
        },
        {
          page: Number(page) || 1,
          limit: Number(limit) || 10,
          sortBy: (sortBy as string) || "createdAt",
          sortOrder: (sortOrder as "asc" | "desc") || "desc",
        },
      );

      sendPaginated(res, result.data, result.pagination, "Tickets retrieved");
    },
  );

  /**
   * Add message to ticket
   * POST /api/v1/support/tickets/:ticketId/messages
   */
  addMessage = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { ticketId } = req.params;
      const { content, isInternal, attachments } = req.body;
      const userId = req.user!.userId;
      const role = req.user!.role as UserRole;

      const senderType = [UserRole.ADMIN, UserRole.SUPPORT_AGENT].includes(role)
        ? "agent"
        : "customer";

      const ticket = await supportTicketService.addMessage(
        ticketId,
        userId,
        senderType,
        content,
        isInternal,
        attachments,
      );

      sendSuccess(res, ticket, { message: "Message added" });
    },
  );

  /**
   * Update ticket status
   * PATCH /api/v1/support/tickets/:ticketId/status
   */
  updateStatus = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { ticketId } = req.params;
      const { status, resolution } = req.body;

      const ticket = await supportTicketService.updateStatus(
        ticketId,
        status,
        resolution,
      );

      sendSuccess(res, ticket, { message: "Status updated" });
    },
  );

  /**
   * Assign ticket
   * POST /api/v1/support/tickets/:ticketId/assign
   */
  assignTicket = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { ticketId } = req.params;
      const { agentId } = req.body;

      const ticket = await supportTicketService.assignTicket(ticketId, agentId);

      sendSuccess(res, ticket, { message: "Ticket assigned" });
    },
  );

  /**
   * Update priority
   * PATCH /api/v1/support/tickets/:ticketId/priority
   */
  updatePriority = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { ticketId } = req.params;
      const { priority } = req.body;

      const ticket = await supportTicketService.updatePriority(
        ticketId,
        priority,
      );

      sendSuccess(res, ticket, { message: "Priority updated" });
    },
  );

  /**
   * Get ticket statistics
   * GET /api/v1/support/tickets/statistics
   */
  getStatistics = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const role = req.user!.role as UserRole;
      const userId = req.user!.userId;

      const agentId = role === UserRole.SUPPORT_AGENT ? userId : undefined;

      const stats = await supportTicketService.getStatistics(agentId);

      sendSuccess(res, stats, { message: "Statistics retrieved" });
    },
  );

  // ==================== AI Chat Endpoints ====================

  /**
   * Send chat message
   * POST /api/v1/support/chat
   */
  chat = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const userId = req.user?.userId;
      const { sessionId, message, context } = req.body;
      const userAgent = req.headers["user-agent"];
      const ip = req.ip;

      const response = await aiSupportService.chat({
        sessionId,
        userId,
        message,
        context,
        metadata: {
          userAgent,
          ip,
          source: "web",
        },
      });

      sendSuccess(res, response, { message: "Message processed" });
    },
  );

  /**
   * Get chat history
   * GET /api/v1/support/chat/:sessionId
   */
  getChatHistory = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { sessionId } = req.params;

      const session = await aiSupportService.getChatHistory(sessionId);

      sendSuccess(res, session, { message: "Chat history retrieved" });
    },
  );

  /**
   * Close chat session
   * POST /api/v1/support/chat/:sessionId/close
   */
  closeChatSession = asyncHandler(
    async (req: AuthRequest, res: Response): Promise<void> => {
      const { sessionId } = req.params;

      await aiSupportService.closeSession(sessionId);

      sendSuccess(res, null, { message: "Chat session closed" });
    },
  );
}

export const supportController = new SupportController();
