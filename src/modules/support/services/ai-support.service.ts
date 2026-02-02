/**
 * AI Support Service
 * OpenAI integration for chatbot support
 */

import OpenAI from "openai";
import { Types } from "mongoose";
import {
  ChatSession,
  IChatSession,
  IChatMessage,
  ChatRole,
} from "../models/ChatSession.model.js";
import {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../models/SupportTicket.model.js";
import { Order } from "../../order/index.js";
import { Product } from "../../product/index.js";
import { config } from "../../../config/index.js";
import { logger } from "../../../shared/utils/logger.js";
import { nanoid } from "nanoid";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// System prompt for the AI
const SYSTEM_PROMPT = `You are a helpful customer support assistant for an eCommerce platform. Your role is to:
1. Answer customer questions about orders, products, shipping, and payments
2. Help customers track their orders and understand delivery status
3. Assist with returns and refunds inquiries
4. Provide product information and recommendations
5. Escalate complex issues to human support when needed

Guidelines:
- Be polite, professional, and empathetic
- Provide accurate information based on context provided
- If you don't know something, say so and offer to connect with a human agent
- Keep responses concise but helpful
- Ask clarifying questions when needed
- Use the customer's name if available

When to escalate to human support:
- Customer requests to speak with a human
- Complex refund or dispute situations
- Technical issues you cannot resolve
- Complaints or negative experiences
- Situations requiring policy exceptions`;

export interface ChatInput {
  sessionId?: string;
  userId?: string;
  message: string;
  context?: {
    orderId?: string;
    productId?: string;
  };
  metadata?: {
    userAgent?: string;
    ip?: string;
    source?: string;
  };
  tenantId?: string;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  intent?: string;
  handoffRequested: boolean;
  ticketId?: string;
}

class AISupportService {
  private readonly maxContextMessages = 10;

  /**
   * Process chat message
   */
  async chat(input: ChatInput): Promise<ChatResponse> {
    // Get or create session
    const session = await this.getOrCreateSession(input);

    // Add user message
    session.messages.push({
      role: "user",
      content: input.message,
      timestamp: new Date(),
    });

    // Build context for AI
    const contextInfo = await this.buildContext(session, input.context);

    // Get AI response
    const { reply, intent, handoffRequested } = await this.getAIResponse(
      session.messages,
      contextInfo,
    );

    // Add assistant message
    session.messages.push({
      role: "assistant",
      content: reply,
      timestamp: new Date(),
      metadata: { intent, handoffRequested },
    });

    // Handle handoff if requested
    let ticketId: string | undefined;
    if (handoffRequested) {
      const ticket = await this.createHandoffTicket(session, input.message);
      ticketId = ticket._id.toString();
      session.status = "handoff";
      session.handoffTicketId = ticket._id;
    }

    await session.save();

    return {
      sessionId: session.sessionId,
      reply,
      intent,
      handoffRequested,
      ticketId,
    };
  }

  /**
   * Get chat history
   */
  async getChatHistory(sessionId: string): Promise<IChatSession | null> {
    return ChatSession.findOne({ sessionId });
  }

  /**
   * Close chat session
   */
  async closeSession(sessionId: string): Promise<void> {
    await ChatSession.findOneAndUpdate({ sessionId }, { status: "closed" });
  }

  /**
   * Get or create chat session
   */
  private async getOrCreateSession(input: ChatInput): Promise<IChatSession> {
    if (input.sessionId) {
      const existing = await ChatSession.findOne({
        sessionId: input.sessionId,
      });
      if (existing && existing.status === "active") {
        return existing;
      }
    }

    // Create new session
    const sessionId = input.sessionId || `chat-${nanoid(12)}`;

    const session = await ChatSession.create({
      sessionId,
      userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
          timestamp: new Date(),
        },
      ],
      context: {
        orderId: input.context?.orderId
          ? new Types.ObjectId(input.context.orderId)
          : undefined,
        productId: input.context?.productId
          ? new Types.ObjectId(input.context.productId)
          : undefined,
      },
      status: "active",
      metadata: input.metadata,
      tenantId: input.tenantId || "default",
    });

    return session;
  }

  /**
   * Build context information for AI
   */
  private async buildContext(
    session: IChatSession,
    context?: { orderId?: string; productId?: string },
  ): Promise<string> {
    const contextParts: string[] = [];

    // Add order context
    if (context?.orderId || session.context.orderId) {
      const orderId = context?.orderId || session.context.orderId?.toString();
      try {
        const order = await Order.findById(orderId)
          .populate("items.productId", "name")
          .select("orderNumber status paymentStatus total estimatedDelivery");

        if (order) {
          contextParts.push(
            `
Current Order Context:
- Order Number: ${order.orderNumber}
- Status: ${order.status}
- Payment Status: ${order.paymentStatus}
- Total: ₹${order.total}
- Estimated Delivery: ${order.estimatedDelivery?.toDateString() || "Not available"}
- Items: ${order.items.map((i: any) => i.name || "Product").join(", ")}
          `.trim(),
          );
        }
      } catch (error) {
        logger.warn("Failed to fetch order context");
      }
    }

    // Add product context
    if (context?.productId || session.context.productId) {
      const productId =
        context?.productId || session.context.productId?.toString();
      try {
        const product = await Product.findById(productId).select(
          "name description basePrice totalStock",
        );

        if (product) {
          contextParts.push(
            `
Product Context:
- Name: ${product.name}
- Price: ₹${product.basePrice}
- In Stock: ${product.totalStock > 0 ? "Yes" : "No"}
- Description: ${product.description.substring(0, 200)}...
          `.trim(),
          );
        }
      } catch (error) {
        logger.warn("Failed to fetch product context");
      }
    }

    return contextParts.join("\n\n");
  }

  /**
   * Get AI response from OpenAI
   */
  private async getAIResponse(
    messages: IChatMessage[],
    contextInfo: string,
  ): Promise<{ reply: string; intent?: string; handoffRequested: boolean }> {
    try {
      // Prepare messages for OpenAI
      const recentMessages = messages.slice(-this.maxContextMessages);

      const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
        recentMessages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        }));

      // Add context as system message
      if (contextInfo) {
        openAIMessages.push({
          role: "system",
          content: `Additional Context:\n${contextInfo}`,
        });
      }

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openAIMessages,
        temperature: 0.7,
        max_tokens: 500,
        functions: [
          {
            name: "analyze_intent",
            description:
              "Analyze the customer intent and determine if handoff is needed",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "order_status",
                    "refund",
                    "shipping",
                    "product_info",
                    "complaint",
                    "general",
                    "handoff",
                  ],
                },
                handoffRequested: {
                  type: "boolean",
                  description:
                    "Whether the customer should be connected to a human agent",
                },
              },
              required: ["intent", "handoffRequested"],
            },
          },
        ],
        function_call: { name: "analyze_intent" },
      });

      const message = completion.choices[0].message;
      let intent: string | undefined;
      let handoffRequested = false;

      // Parse function call response
      if (message.function_call) {
        const funcArgs = JSON.parse(message.function_call.arguments);
        intent = funcArgs.intent;
        handoffRequested = funcArgs.handoffRequested || intent === "handoff";
      }

      // Get the actual response
      const responseCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openAIMessages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const reply =
        responseCompletion.choices[0].message.content ||
        "I apologize, but I'm having trouble responding. Would you like to speak with a human agent?";

      return { reply, intent, handoffRequested };
    } catch (error: any) {
      logger.error(`OpenAI API error: ${error.message}`);

      return {
        reply:
          "I'm currently experiencing technical difficulties. Would you like me to connect you with a human support agent?",
        intent: "error",
        handoffRequested: true,
      };
    }
  }

  /**
   * Create handoff ticket
   */
  private async createHandoffTicket(
    session: IChatSession,
    lastMessage: string,
  ): Promise<any> {
    // Summarize conversation
    const conversationSummary = session.messages
      .filter((m) => m.role !== "system")
      .slice(-5)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const ticket = await SupportTicket.create({
      userId: session.userId || new Types.ObjectId(),
      subject: `Chat Handoff: ${lastMessage.substring(0, 50)}...`,
      description: `Customer requested human support.\n\nLast message: ${lastMessage}\n\nConversation summary:\n${conversationSummary}`,
      category: this.inferCategory(session.context),
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
      orderId: session.context.orderId,
      tags: ["chat-handoff", "ai-escalation"],
      tenantId: session.tenantId,
    });

    logger.info(`Handoff ticket created: ${ticket.ticketNumber}`);
    return ticket;
  }

  /**
   * Infer ticket category from context
   */
  private inferCategory(context: IChatSession["context"]): TicketCategory {
    if (context.orderId) return TicketCategory.ORDER;
    if (context.productId) return TicketCategory.PRODUCT;
    return TicketCategory.OTHER;
  }
}

export const aiSupportService = new AISupportService();
