/**
 * Support Module Exports
 */

export * from "./models/SupportTicket.model.js";
export * from "./models/ChatSession.model.js";
export * from "./services/ticket.service.js";
export * from "./services/ai-support.service.js";
export * from "./controllers/support.controller.js";
export * from "./routes/support.routes.js";
// Note: validators export types that may overlap with service, use service types for internal use
export {
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
} from "./validators/support.validator.js";
