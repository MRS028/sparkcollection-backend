/**
 * Support Ticket Model
 * Customer support ticket management
 */

import mongoose, { Schema, Document, Types } from "mongoose";

// Ticket Status
export enum TicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  WAITING_CUSTOMER = "waiting_customer",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

// Ticket Priority
export enum TicketPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

// Ticket Category
export enum TicketCategory {
  ORDER = "order",
  PAYMENT = "payment",
  SHIPPING = "shipping",
  PRODUCT = "product",
  REFUND = "refund",
  ACCOUNT = "account",
  TECHNICAL = "technical",
  OTHER = "other",
}

// Message Interface
export interface ITicketMessage {
  _id?: Types.ObjectId;
  senderId: Types.ObjectId;
  senderType: "customer" | "agent" | "bot";
  content: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: Date;
}

// Support Ticket Interface
export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  userId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  orderId?: Types.ObjectId;
  messages: ITicketMessage[];
  tags: string[];
  resolution?: string;
  resolvedAt?: Date;
  firstResponseAt?: Date;
  lastResponseAt?: Date;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Message Schema
const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderType: {
      type: String,
      enum: ["customer", "agent", "bot"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    attachments: [
      {
        type: String,
      },
    ],
    isInternal: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

// Support Ticket Schema
const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    subject: {
      type: String,
      required: true,
      maxlength: 500,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    messages: [ticketMessageSchema],
    tags: [
      {
        type: String,
        maxlength: 50,
      },
    ],
    resolution: {
      type: String,
      maxlength: 2000,
    },
    resolvedAt: Date,
    firstResponseAt: Date,
    lastResponseAt: Date,
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
supportTicketSchema.index({ ticketNumber: 1 }, { unique: true });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });

// Generate ticket number
supportTicketSchema.pre("save", function (next) {
  if (!this.ticketNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.ticketNumber = `TKT-${timestamp}-${random}`;
  }
  next();
});

// Method to add message
supportTicketSchema.methods.addMessage = function (
  senderId: Types.ObjectId,
  senderType: "customer" | "agent" | "bot",
  content: string,
  isInternal: boolean = false,
  attachments?: string[],
): void {
  this.messages.push({
    senderId,
    senderType,
    content,
    isInternal,
    attachments,
    createdAt: new Date(),
  });

  this.lastResponseAt = new Date();

  if (senderType === "agent" && !this.firstResponseAt) {
    this.firstResponseAt = new Date();
  }
};

export const SupportTicket = mongoose.model<ISupportTicket>(
  "SupportTicket",
  supportTicketSchema,
);
