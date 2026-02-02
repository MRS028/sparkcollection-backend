/**
 * Support Validators
 * Zod schemas for support operations
 */

import { z } from "zod";
import {
  objectIdSchema,
  paginationSchema,
} from "../../../shared/validators/common.js";
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "../models/SupportTicket.model.js";

// Create ticket
export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(5).max(500),
    description: z.string().min(10).max(5000),
    category: z.nativeEnum(TicketCategory),
    priority: z.nativeEnum(TicketPriority).optional(),
    orderId: objectIdSchema.optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),
});

// Get ticket by ID
export const getTicketSchema = z.object({
  params: z.object({
    ticketId: objectIdSchema,
  }),
});

// Get ticket by ticket number
export const getByTicketNumberSchema = z.object({
  params: z.object({
    ticketNumber: z.string().min(10).max(30),
  }),
});

// Add message to ticket
export const addMessageSchema = z.object({
  params: z.object({
    ticketId: objectIdSchema,
  }),
  body: z.object({
    content: z.string().min(1).max(5000),
    isInternal: z.boolean().optional().default(false),
    attachments: z.array(z.string().url()).max(5).optional(),
  }),
});

// Update ticket status
export const updateStatusSchema = z.object({
  params: z.object({
    ticketId: objectIdSchema,
  }),
  body: z.object({
    status: z.nativeEnum(TicketStatus),
    resolution: z.string().max(2000).optional(),
  }),
});

// Assign ticket
export const assignTicketSchema = z.object({
  params: z.object({
    ticketId: objectIdSchema,
  }),
  body: z.object({
    agentId: objectIdSchema,
  }),
});

// Update priority
export const updatePrioritySchema = z.object({
  params: z.object({
    ticketId: objectIdSchema,
  }),
  body: z.object({
    priority: z.nativeEnum(TicketPriority),
  }),
});

// Ticket filters
export const ticketFiltersSchema = z.object({
  query: paginationSchema.extend({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    category: z.nativeEnum(TicketCategory).optional(),
    search: z.string().max(100).optional(),
  }),
});

// Chat message
export const chatMessageSchema = z.object({
  body: z.object({
    sessionId: z.string().max(100).optional(),
    message: z.string().min(1).max(2000),
    context: z
      .object({
        orderId: objectIdSchema.optional(),
        productId: objectIdSchema.optional(),
      })
      .optional(),
  }),
});

// Get chat history
export const getChatHistorySchema = z.object({
  params: z.object({
    sessionId: z.string().min(5).max(100),
  }),
});

// Type exports
export type CreateTicketInput = z.infer<typeof createTicketSchema>["body"];
export type AddMessageInput = z.infer<typeof addMessageSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>["body"];
