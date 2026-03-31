// ── Enums & Literals ──

export type MessageEffect =
  | "slam"
  | "loud"
  | "gentle"
  | "invisibleInk"
  | "confetti"
  | "fireworks"
  | "lasers"
  | "love"
  | "balloons"
  | "spotlight"
  | "echo";

export type ReactionType =
  | "love"
  | "like"
  | "dislike"
  | "laugh"
  | "emphasize"
  | "question";

export type MessageStatus =
  | "queued"
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "received"
  | "failed"
  | "unsent"
  | "scheduled";

export type MessageChannel = "imessage" | "sms" | null;

export type PaymentRequestStatus = "pending" | "paid" | "cancelled" | "expired";

// ── Client Config ──

export interface TextBubblesConfig {
  apiKey: string;
  baseUrl?: string;
}

// ── Messages ──

export interface MessageContent {
  text?: string;
  media?: string[];
}

export interface SendMessageParams {
  to: string;
  content: MessageContent;
  effect?: MessageEffect;
  scheduledAt?: string;
  idempotencyKey?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
}

export interface ListMessagesParams {
  to?: string;
  from?: string;
  status?: MessageStatus;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface SendCarouselParams {
  to: string;
  images: string[];
  idempotencyKey?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
}

export interface ReactToMessageParams {
  reaction: ReactionType;
}

export interface EditMessageParams {
  content: MessageContent;
}

export interface Message {
  id: string;
  to: string;
  from: string;
  content: MessageContent;
  effect?: MessageEffect;
  status: MessageStatus;
  channel: MessageChannel;
  parentMessageId?: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface MessageList {
  data: Message[];
  total: number;
  limit: number;
  offset: number;
  cursor?: string;
  hasMore?: boolean;
}

// ── Chats ──

export interface CreateGroupParams {
  name: string;
  participants: string[];
}

export interface Chat {
  guid: string;
  name?: string;
  participants: string[];
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RenameChatParams {
  name: string;
}

export interface ChatParticipantParams {
  phoneNumber: string;
}

// ── Contacts ──

export interface CreateContactParams {
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface UpdateContactParams {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface ListContactsParams {
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
  tags: string[];
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactList {
  data: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export interface BulkCreateContactsParams {
  contacts: CreateContactParams[];
}

export interface BulkDeleteContactsParams {
  ids: string[];
}

export interface BulkCreateResult {
  created: number;
  failed: number;
  errors?: Array<{ index: number; error: string }>;
}

export interface BulkDeleteResult {
  deleted: number;
}

// ── Payments ──

export interface RequestPaymentParams {
  to: string;
  amount: number;
  currency?: string;
  memo?: string;
}

export interface PaymentRequest {
  id: string;
  to: string;
  amount: number;
  currency: string;
  memo?: string;
  status: PaymentRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRequestList {
  data: PaymentRequest[];
  total: number;
  limit: number;
  offset: number;
}

// ── Profile ──

export interface ProfileState {
  name?: string;
  photo?: string;
  displayName?: string;
}

export interface SetProfileParams {
  name?: string;
  photo?: string;
  displayName?: string;
}

// ── Capabilities ──

export interface CapabilityResult {
  phoneNumber: string;
  iMessage: boolean;
}

// ── Webhooks ──

export interface WebhookConfig {
  url: string;
  secret: string;
  events: WebhookEventType[];
}

export interface SetWebhookParams {
  url: string;
  secret: string;
  events: WebhookEventType[];
}

export type WebhookEventType =
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "message.received"
  | "message.scheduled"
  | "message.schedule_cancelled"
  | "message.reaction"
  | "reaction.added"
  | "reaction.removed"
  | "typing.started"
  | "typing.stopped"
  | "typing.indicator"
  | "payment.request.created"
  | "payment.request.paid"
  | "payment.request.cancelled"
  | "payment.request.expired"
  | "facetime.incoming"
  | "facetime.status_changed";

// ── Webhook Event Payloads ──

export interface BaseWebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
}

export interface MessageWebhookEvent extends BaseWebhookEvent {
  type:
    | "message.sent"
    | "message.delivered"
    | "message.read"
    | "message.failed"
    | "message.received"
    | "message.scheduled"
    | "message.schedule_cancelled"
    | "message.reaction";
  data: Message;
}

export interface ReactionWebhookEvent extends BaseWebhookEvent {
  type: "reaction.added" | "reaction.removed";
  data: {
    messageId: string;
    reaction: ReactionType;
    from: string;
  };
}

export interface TypingWebhookEvent extends BaseWebhookEvent {
  type: "typing.started" | "typing.stopped" | "typing.indicator";
  data: {
    chatGuid: string;
    from: string;
  };
}

export interface PaymentWebhookEvent extends BaseWebhookEvent {
  type:
    | "payment.request.created"
    | "payment.request.paid"
    | "payment.request.cancelled"
    | "payment.request.expired";
  data: PaymentRequest;
}

export interface FacetimeWebhookEvent extends BaseWebhookEvent {
  type: "facetime.incoming" | "facetime.status_changed";
  data: {
    from: string;
    status: string;
  };
}

export type WebhookEvent =
  | MessageWebhookEvent
  | ReactionWebhookEvent
  | TypingWebhookEvent
  | PaymentWebhookEvent
  | FacetimeWebhookEvent;

// ── Message Direction Helpers ──

export function isOutgoingMessage(msg: Message): boolean {
  return msg.status !== "received";
}

export function isIncomingMessage(msg: Message): boolean {
  return msg.status === "received";
}
