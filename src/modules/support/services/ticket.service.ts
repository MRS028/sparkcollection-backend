/**
 * Support Ticket Service
 * Business logic for support ticket management
 */

import { Types, FilterQuery } from "mongoose";
import {
  SupportTicket,
  ISupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "../models/SupportTicket.model.js";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../shared/errors/index.js";
import {
  PaginatedResult,
  PaginationOptions,
  UserRole,
} from "../../../shared/types/index.js";
import { logger } from "../../../shared/utils/logger.js";

export interface CreateTicketInput {
  userId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  orderId?: string;
  tags?: string[];
  tenantId?: string;
}

export interface TicketFilters {
  userId?: string;
  assignedTo?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  search?: string;
  tenantId?: string;
}

class SupportTicketService {
  /**
   * Create ticket
   */
  async create(input: CreateTicketInput): Promise<ISupportTicket> {
    const ticket = await SupportTicket.create({
      userId: new Types.ObjectId(input.userId),
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: input.priority || TicketPriority.MEDIUM,
      orderId: input.orderId ? new Types.ObjectId(input.orderId) : undefined,
      tags: input.tags || [],
      status: TicketStatus.OPEN,
      tenantId: input.tenantId || "default",
    });

    logger.info(`Support ticket created: ${ticket.ticketNumber}`);
    return ticket;
  }

  /**
   * Get ticket by ID
   */
  async getById(
    ticketId: string,
    userId?: string,
    role?: UserRole,
  ): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findById(ticketId)
      .populate("userId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName")
      .populate("orderId", "orderNumber status");

    if (!ticket) {
      throw new NotFoundError("Support ticket");
    }

    // Authorization check
    if (userId && role !== UserRole.ADMIN && role !== UserRole.SUPPORT_AGENT) {
      if (ticket.userId._id.toString() !== userId) {
        throw new ForbiddenError("Access denied");
      }
    }

    return ticket;
  }

  /**
   * Get ticket by ticket number
   */
  async getByTicketNumber(ticketNumber: string): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findOne({ ticketNumber })
      .populate("userId", "firstName lastName email")
      .populate("assignedTo", "firstName lastName");

    if (!ticket) {
      throw new NotFoundError("Support ticket");
    }

    return ticket;
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    senderId: string,
    senderType: "customer" | "agent",
    content: string,
    isInternal: boolean = false,
    attachments?: string[],
  ): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Support ticket");
    }

    ticket.addMessage(
      new Types.ObjectId(senderId),
      senderType,
      content,
      isInternal,
      attachments,
    );

    // Update status if agent replies
    if (senderType === "agent" && ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    } else if (
      senderType === "customer" &&
      ticket.status === TicketStatus.WAITING_CUSTOMER
    ) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    await ticket.save();

    logger.info(`Message added to ticket ${ticket.ticketNumber}`);
    return ticket;
  }

  /**
   * Update ticket status
   */
  async updateStatus(
    ticketId: string,
    status: TicketStatus,
    resolution?: string,
  ): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Support ticket");
    }

    ticket.status = status;

    if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
      ticket.resolvedAt = new Date();
      if (resolution) {
        ticket.resolution = resolution;
      }
    }

    await ticket.save();

    logger.info(`Ticket ${ticket.ticketNumber} status updated to ${status}`);
    return ticket;
  }

  /**
   * Assign ticket to agent
   */
  async assignTicket(
    ticketId: string,
    agentId: string,
  ): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        assignedTo: new Types.ObjectId(agentId),
        status: TicketStatus.IN_PROGRESS,
      },
      { new: true },
    ).populate("assignedTo", "firstName lastName");

    if (!ticket) {
      throw new NotFoundError("Support ticket");
    }

    logger.info(`Ticket ${ticket.ticketNumber} assigned to agent ${agentId}`);
    return ticket;
  }

  /**
   * Update ticket priority
   */
  async updatePriority(
    ticketId: string,
    priority: TicketPriority,
  ): Promise<ISupportTicket> {
    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      { priority },
      { new: true },
    );

    if (!ticket) {
      throw new NotFoundError("Support ticket");
    }

    return ticket;
  }

  /**
   * Get user tickets
   */
  async getUserTickets(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<ISupportTicket>> {
    return this.getAll({ userId }, options);
  }

  /**
   * Get agent tickets
   */
  async getAgentTickets(
    agentId: string,
    options: PaginationOptions,
    filters?: Partial<TicketFilters>,
  ): Promise<PaginatedResult<ISupportTicket>> {
    return this.getAll({ ...filters, assignedTo: agentId }, options);
  }

  /**
   * Get all tickets
   */
  async getAll(
    filters: TicketFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<ISupportTicket>> {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;
    const skip = (page - 1) * limit;

    const query = this.buildFilterQuery(filters);

    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    };

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate("userId", "firstName lastName email")
        .populate("assignedTo", "firstName lastName")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      SupportTicket.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get ticket statistics
   */
  async getStatistics(
    agentId?: string,
    tenantId?: string,
  ): Promise<{
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    avgResponseTime: number;
    ticketsByCategory: Record<TicketCategory, number>;
    ticketsByPriority: Record<TicketPriority, number>;
  }> {
    const baseMatch: FilterQuery<ISupportTicket> = {};
    if (agentId) baseMatch.assignedTo = new Types.ObjectId(agentId);
    if (tenantId) baseMatch.tenantId = tenantId;

    const [
      total,
      openTickets,
      resolvedTickets,
      categoryStats,
      priorityStats,
      responseTimeStats,
    ] = await Promise.all([
      SupportTicket.countDocuments(baseMatch),
      SupportTicket.countDocuments({ ...baseMatch, status: TicketStatus.OPEN }),
      SupportTicket.countDocuments({
        ...baseMatch,
        status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
      }),
      SupportTicket.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: { ...baseMatch, firstResponseAt: { $exists: true } } },
        {
          $project: {
            responseTime: {
              $subtract: ["$firstResponseAt", "$createdAt"],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: "$responseTime" },
          },
        },
      ]),
    ]);

    // Build category stats
    const ticketsByCategory = {} as Record<TicketCategory, number>;
    for (const cat of Object.values(TicketCategory)) {
      const found = categoryStats.find((c) => c._id === cat);
      ticketsByCategory[cat] = found ? found.count : 0;
    }

    // Build priority stats
    const ticketsByPriority = {} as Record<TicketPriority, number>;
    for (const pri of Object.values(TicketPriority)) {
      const found = priorityStats.find((p) => p._id === pri);
      ticketsByPriority[pri] = found ? found.count : 0;
    }

    return {
      totalTickets: total,
      openTickets,
      resolvedTickets,
      avgResponseTime: responseTimeStats[0]?.avgResponseTime
        ? Math.round(responseTimeStats[0].avgResponseTime / 60000) // Convert to minutes
        : 0,
      ticketsByCategory,
      ticketsByPriority,
    };
  }

  // Private methods

  private buildFilterQuery(
    filters: TicketFilters,
  ): FilterQuery<ISupportTicket> {
    const query: FilterQuery<ISupportTicket> = {};

    if (filters.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }
    if (filters.assignedTo) {
      query.assignedTo = new Types.ObjectId(filters.assignedTo);
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.priority) {
      query.priority = filters.priority;
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }
    if (filters.search) {
      query.$or = [
        { ticketNumber: { $regex: filters.search, $options: "i" } },
        { subject: { $regex: filters.search, $options: "i" } },
      ];
    }

    return query;
  }
}

export const supportTicketService = new SupportTicketService();
