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
  mediaUrls?: string[];
}

export interface MessageAttachment {
  type: "url" | "base64";
  url?: string;
  data?: string;
  mimeType?: string;
  filename?: string;
}

export interface MessageMention {
  address: string;
  start: number;
  length: number;
}

export interface MessageRouting {
  preference?: ("imessage" | "sms")[];
  fallback?: boolean;
}

export interface SendMessageParams {
  to: string;
  content: MessageContent;
  from?: string;
  routing?: MessageRouting;
  replyTo?: string;
  attachments?: MessageAttachment[];
  effect?: MessageEffect;
  mentions?: MessageMention[];
  createContact?: boolean;
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
  mediaUrls: string[];
  text?: string;
  effect?: MessageEffect;
  idempotencyKey?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
}

export interface ReactToMessageParams {
  type: ReactionType;
}

export interface EditMessageParams {
  text: string;
  backwardsCompatibilityMessage?: string;
}

export interface Message {
  id: string;
  to: string;
  from?: string;
  content: MessageContent;
  effect?: MessageEffect;
  status: MessageStatus;
  channel: MessageChannel;
  parentMessageId?: string;
  fallbackTriggered?: boolean;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Partial message record returned by `messages.send()`. The API responds with
 * 202 Accepted before the message is routed, so only identity + scheduling
 * fields are populated at this point. Subsequent state changes arrive via
 * webhooks / SSE or by fetching the full record with `messages.get(id)`.
 */
export interface SendMessageResult {
  id: string;
  status: MessageStatus;
  to: string;
  from?: string;
  channel?: MessageChannel;
  scheduledAt?: string;
  createdAt: string;
}

export interface MessageList {
  data: Message[];
  hasMore: boolean;
  nextCursor?: string;
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

export interface AddParticipantParams {
  participant: string;
}

export interface TypingIndicatorParams {
  status: "start" | "stop";
}

// ── Contacts ──

export interface CreateContactParams {
  firstName?: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
  company?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface UpdateContactParams {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  company?: string;
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
  firstName?: string;
  lastName?: string;
  phoneNumber: string;
  email?: string;
  company?: string;
  tags: string[];
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface FocusStatus {
  phoneNumber: string;
  focusActive: boolean;
  focusMode?: string;
}

export interface FaceTimeStatus {
  phoneNumber: string;
  available: boolean;
}

export interface ContactList {
  data: Contact[];
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
  note?: string;
  callbackUrl?: string;
}

export interface PaymentRequest {
  id: string;
  to: string;
  amount: number;
  currency: string;
  note?: string;
  status: PaymentRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListPaymentRequestsParams {
  status?: PaymentRequestStatus;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface PaymentRequestList {
  data: PaymentRequest[];
  hasMore: boolean;
  nextCursor?: string;
}

// ── Numbers ──

export type NumberHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface SenderNumber {
  phoneNumber: string;
  email: string | null;
  instanceName: string;
  isDefault: boolean;
  healthStatus: NumberHealthStatus;
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
  | "message.queued"
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "message.fallback"
  | "message.inbound"
  | "message.scheduled"
  | "message.schedule_cancelled"
  | "message.edit_failed"
  | "message.reaction"
  | "typing.indicator"
  | "payment.request.created"
  | "payment.request.paid"
  | "payment.request.cancelled"
  | "payment.request.expired"
  | "facetime.incoming"
  | "facetime.status_changed"
  | "webhook.test";

// ── Webhook Event Payloads ──

export interface BaseWebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
}

/**
 * Payload shape for every `message.*` event. The API flattens message fields
 * onto the `data` object rather than returning a full Message; the exact
 * fields present vary by event type.
 */
export interface MessageEventData {
  messageId: string;
  externalMessageId?: string;
  from?: string;
  to?: string;
  text?: string;
  channel?: MessageChannel | "sms";
  status?: MessageStatus;
  customerId?: string;
  parentMessageId?: string | null;
  error?: string;
  fallbackFrom?: MessageChannel;
  scheduledAt?: string;
  attachments?: Array<{
    guid: string;
    mimeType: string;
    filename: string;
    totalBytes: number;
    downloadUrl?: string;
  }>;
  reaction?: ReactionType;
  metadata?: Record<string, unknown>;
}

export interface MessageWebhookEvent extends BaseWebhookEvent {
  type:
    | "message.queued"
    | "message.sent"
    | "message.delivered"
    | "message.read"
    | "message.failed"
    | "message.fallback"
    | "message.inbound"
    | "message.scheduled"
    | "message.schedule_cancelled"
    | "message.edit_failed"
    | "message.reaction";
  data: MessageEventData;
}

/**
 * @deprecated Reaction events are now delivered as `message.reaction`
 * MessageWebhookEvents with a `reaction` field on `data`. This alias is kept
 * for backward compatibility and will be removed in a future major.
 */
export type ReactionWebhookEvent = Extract<MessageWebhookEvent, { type: "message.reaction" }>;

export interface TypingWebhookEvent extends BaseWebhookEvent {
  type: "typing.indicator";
  data: {
    chatGuid?: string;
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

export interface TestWebhookEvent extends BaseWebhookEvent {
  type: "webhook.test";
  data: {
    message: string;
    customerId?: string;
    requestId?: string;
  };
}

export type WebhookEvent =
  | MessageWebhookEvent
  | ReactionWebhookEvent
  | TypingWebhookEvent
  | PaymentWebhookEvent
  | FacetimeWebhookEvent
  | TestWebhookEvent;

// ── Message Direction Helpers ──

export function isOutgoingMessage(msg: Message): boolean {
  return msg.status !== "received";
}

export function isIncomingMessage(msg: Message): boolean {
  return msg.status === "received";
}
