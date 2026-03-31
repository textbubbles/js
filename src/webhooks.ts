import type {
  WebhookEvent,
  WebhookEventType,
  MessageWebhookEvent,
  ReactionWebhookEvent,
  TypingWebhookEvent,
  PaymentWebhookEvent,
  FacetimeWebhookEvent,
} from "./types.js";

/**
 * Verify a webhook signature using HMAC-SHA256.
 *
 * The API sends an `X-Signature` header in `sha256=<hex>` format and an
 * `X-Timestamp` header. The signed payload is `${timestamp}.${body}`.
 */
export async function verifyWebhookSignature(
  payload: string | Uint8Array,
  signature: string,
  secret: string,
  timestamp?: string,
): Promise<boolean> {
  const crypto = await import("node:crypto");
  const bodyStr =
    typeof payload === "string" ? payload : Buffer.from(payload).toString("utf-8");

  // Build the signed content: if timestamp is provided, prepend it
  const signedContent = timestamp ? `${timestamp}.${bodyStr}` : bodyStr;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");

  // Strip 'sha256=' prefix if present
  const rawSignature = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(rawSignature, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Parse and return a typed webhook event from a raw JSON body.
 */
export function parseWebhookEvent(body: string | Record<string, unknown>): WebhookEvent {
  const parsed: unknown = typeof body === "string" ? JSON.parse(body) : body;
  return parsed as WebhookEvent;
}

// ── Type Guards ──

export function isMessageEvent(event: WebhookEvent): event is MessageWebhookEvent {
  return event.type.startsWith("message.");
}

export function isReactionEvent(event: WebhookEvent): event is ReactionWebhookEvent {
  return event.type.startsWith("reaction.");
}

export function isTypingEvent(event: WebhookEvent): event is TypingWebhookEvent {
  return event.type.startsWith("typing.");
}

export function isPaymentEvent(event: WebhookEvent): event is PaymentWebhookEvent {
  return event.type.startsWith("payment.");
}

export function isFacetimeEvent(event: WebhookEvent): event is FacetimeWebhookEvent {
  return event.type.startsWith("facetime.");
}

// ── WebhookHandler Class ──

type WebhookHandlerMap = {
  [K in WebhookEventType]?: (event: Extract<WebhookEvent, { type: K }>) => void | Promise<void>;
};

export interface WebhookHandlerOptions {
  secret: string;
  onEvent?: (event: WebhookEvent) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}

/**
 * A standalone webhook handler that verifies signatures, parses events,
 * and dispatches to registered listeners.
 *
 * ```ts
 * const handler = new WebhookHandler({ secret: 'whsec_...' });
 * handler.on('message.received', (event) => { ... });
 * await handler.handleRequest(body, signature, timestamp);
 * ```
 */
export class WebhookHandler {
  private secret: string;
  private handlers: WebhookHandlerMap = {};
  private onEvent?: (event: WebhookEvent) => void | Promise<void>;
  private onError?: (error: unknown) => void | Promise<void>;

  constructor(options: WebhookHandlerOptions) {
    this.secret = options.secret;
    this.onEvent = options.onEvent;
    this.onError = options.onError;
  }

  on<K extends WebhookEventType>(
    type: K,
    handler: (event: Extract<WebhookEvent, { type: K }>) => void | Promise<void>,
  ): this {
    this.handlers[type] = handler as (event: never) => void | Promise<void>;
    return this;
  }

  async handleRequest(
    body: string,
    signature: string,
    timestamp?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const valid = await verifyWebhookSignature(body, signature, this.secret, timestamp);
    if (!valid) {
      return { ok: false, error: "Invalid signature" };
    }

    try {
      const event = parseWebhookEvent(body);
      if (this.onEvent) await this.onEvent(event);
      const handler = this.handlers[event.type] as ((event: WebhookEvent) => void | Promise<void>) | undefined;
      if (handler) await handler(event);
      return { ok: true };
    } catch (err) {
      if (this.onError) await this.onError(err);
      return { ok: false, error: "Webhook processing failed" };
    }
  }
}

/**
 * Factory function to create a WebhookHandler with event handlers.
 *
 * ```ts
 * const handler = createWebhookHandler({
 *   secret: 'whsec_...',
 *   onEvent: (event) => console.log(event.type),
 * });
 * handler.on('message.received', (event) => { ... });
 * ```
 */
export function createWebhookHandler(options: WebhookHandlerOptions): WebhookHandler {
  return new WebhookHandler(options);
}
