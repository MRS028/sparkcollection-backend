/**
 * Chat Session Model
 * AI chatbot conversation tracking
 */

import mongoose, { Schema, Document, Types } from "mongoose";

// Chat Message Role
export type ChatRole = "user" | "assistant" | "system";

// Chat Message Interface
export interface IChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    confidence?: number;
    handoffRequested?: boolean;
  };
}

// Chat Session Interface
export interface IChatSession extends Document {
  _id: Types.ObjectId;
  sessionId: string;
  userId?: Types.ObjectId;
  messages: IChatMessage[];
  context: {
    orderId?: Types.ObjectId;
    productId?: Types.ObjectId;
    intent?: string;
    entities?: Record<string, string>;
  };
  status: "active" | "handoff" | "closed";
  handoffTicketId?: Types.ObjectId;
  metadata: {
    userAgent?: string;
    ip?: string;
    source?: string;
  };
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Message Schema
const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      intent: String,
      confidence: Number,
      handoffRequested: Boolean,
    },
  },
  { _id: false },
);

// Chat Session Schema
const chatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    messages: [chatMessageSchema],
    context: {
      orderId: { type: Schema.Types.ObjectId, ref: "Order" },
      productId: { type: Schema.Types.ObjectId, ref: "Product" },
      intent: String,
      entities: { type: Map, of: String },
    },
    status: {
      type: String,
      enum: ["active", "handoff", "closed"],
      default: "active",
    },
    handoffTicketId: {
      type: Schema.Types.ObjectId,
      ref: "SupportTicket",
    },
    metadata: {
      userAgent: String,
      ip: String,
      source: String,
    },
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
chatSessionSchema.index({ sessionId: 1 }, { unique: true });
chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ status: 1 });
chatSessionSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 },
); // 7 days TTL

export const ChatSession = mongoose.model<IChatSession>(
  "ChatSession",
  chatSessionSchema,
);
