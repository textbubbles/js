import { verifyWebhookSignature, parseWebhookEvent } from "./webhooks.js";
import type { WebhookEvent, WebhookEventType } from "./types.js";

type WebhookHandlerMap = {
  [K in WebhookEventType]?: (event: Extract<WebhookEvent, { type: K }>) => void | Promise<void>;
};

interface WebhookHandlerOptions {
  secret: string;
  handlers: WebhookHandlerMap;
  onError?: (error: unknown) => void | Promise<void>;
}

/**
 * Create a webhook handler compatible with Next.js API routes (Pages Router)
 * and Route Handlers (App Router).
 *
 * Pages Router usage:
 * ```ts
 * export default createWebhookHandler({ secret: process.env.WEBHOOK_SECRET!, handlers: { ... } });
 * ```
 *
 * App Router usage:
 * ```ts
 * const handler = createWebhookHandler({ secret: process.env.WEBHOOK_SECRET!, handlers: { ... } });
 * export const POST = handler;
 * ```
 */
export function createWebhookHandler(options: WebhookHandlerOptions) {
  const { secret, handlers, onError } = options;

  // Return a function that handles both Next.js Pages Router (req, res) and
  // App Router (Request) signatures.
  return async function handler(...args: unknown[]): Promise<unknown> {
    // App Router: single Request argument
    if (args.length === 1 && args[0] instanceof Request) {
      return handleAppRouter(args[0] as Request, secret, handlers, onError);
    }

    // Pages Router: (req, res) with req.body and res.status().json()
    const req = args[0] as PagesReq;
    const res = args[1] as PagesRes;
    return handlePagesRouter(req, res, secret, handlers, onError);
  };
}

// ── App Router ──

async function handleAppRouter(
  req: Request,
  secret: string,
  handlers: WebhookHandlerMap,
  onError?: (error: unknown) => void | Promise<void>,
): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const signature = req.headers.get("x-signature") ?? req.headers.get("x-textbubbles-signature") ?? "";
  const timestamp = req.headers.get("x-timestamp") ?? undefined;
  const body = await req.text();

  const valid = await verifyWebhookSignature(body, signature, secret, timestamp);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  try {
    const event = parseWebhookEvent(body);
    const handler = handlers[event.type] as ((event: WebhookEvent) => void | Promise<void>) | undefined;
    if (handler) {
      await handler(event);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    if (onError) await onError(err);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500 });
  }
}

// ── Pages Router ──

interface PagesReq {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface PagesRes {
  status(code: number): PagesRes;
  json(body: unknown): void;
}

function getRawBody(req: PagesReq): string {
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body);
}

async function handlePagesRouter(
  req: PagesReq,
  res: PagesRes,
  secret: string,
  handlers: WebhookHandlerMap,
  onError?: (error: unknown) => void | Promise<void>,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const signature = ((req.headers?.["x-signature"] ?? req.headers?.["x-textbubbles-signature"]) ?? "") as string;
  const timestamp = (req.headers?.["x-timestamp"] ?? undefined) as string | undefined;
  const body = getRawBody(req);

  const valid = await verifyWebhookSignature(body, signature, secret, timestamp);
  if (!valid) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  try {
    const event = parseWebhookEvent(body);
    const handler = handlers[event.type] as ((event: WebhookEvent) => void | Promise<void>) | undefined;
    if (handler) {
      await handler(event);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    if (onError) await onError(err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
