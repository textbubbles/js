# @textbubbles/js

TypeScript SDK for the TextBubbles messaging API. Supports iMessage, group chats, contacts, payments, webhooks, real-time events, and more.

## Install

```bash
npm install @textbubbles/js
```

## Quick Start

```typescript
import { TextBubblesClient } from "@textbubbles/js";

const tb = new TextBubblesClient({
  apiKey: "your-api-key-here",
});

// Send a message
const message = await tb.messages.send({
  to: "+14155551234",
  content: { text: "Hello from TextBubbles!" },
});

// Send with effects
await tb.messages.send({
  to: "+14155551234",
  content: { text: "Congratulations!" },
  effect: "confetti",
});
```

## AI Agent Skill

This SDK includes an **Agent Skill** for AI coding assistants like Claude Code and Cursor. The skill makes AI assistants experts at using this SDK.

### Claude Code

Add to your project's `AGENTS.md` or run:

```bash
# Copy the skill to your project
cp -r node_modules/@textbubbles/js/skill ./textbubbles-skill

# Or reference it in AGENTS.md
echo "Skill: node_modules/@textbubbles/js/skill/SKILL.md" >> AGENTS.md
```

### Cursor

Add to `.cursor/rules`:

```
Read and follow the TextBubbles SDK skill at: node_modules/@textbubbles/js/skill/SKILL.md
```

Or copy `skill/SKILL.md` content into your `.cursorrules` file.

### What the Skill Provides

- Complete API reference for all SDK methods
- Parameter types and return values
- Code examples for common use cases
- Webhook event handling patterns
- Real-time events examples
- Next.js integration examples

---

## Messages

```typescript
// Send a message
await tb.messages.send({
  to: "+14155551234",
  content: { text: "Hello!", mediaUrls: ["https://example.com/photo.jpg"] },
  effect: "confetti",
  scheduledAt: "2026-03-29T09:00:00Z",
  idempotencyKey: "unique-key",
  callbackUrl: "https://example.com/callback",
  metadata: { orderId: "123" },
});

// List messages (supports cursor-based pagination)
const page1 = await tb.messages.list({
  to: "+14155551234",
  status: "delivered",
  limit: 20,
});

// Paginate with cursor
if (page1.hasMore && page1.cursor) {
  const page2 = await tb.messages.list({ limit: 20, cursor: page1.cursor });
}

// Get a message
const msg = await tb.messages.get("msg_abc123");

// Check message channel and direction
import { isIncomingMessage } from "@textbubbles/js";
console.log(msg.channel); // "imessage" | "sms" | null
if (isIncomingMessage(msg)) {
  console.log("Received from:", msg.from);
}

// Send image carousel (2-20 images)
await tb.messages.sendCarousel({
  to: "+14155551234",
  images: [
    "https://example.com/img1.jpg",
    "https://example.com/img2.jpg",
  ],
});

// List scheduled messages
const scheduled = await tb.messages.listScheduled();

// Cancel a scheduled message
await tb.messages.cancelSchedule("msg_abc123");

// Delete a message
await tb.messages.delete("msg_abc123");

// Unsend a message
await tb.messages.unsend("msg_abc123");

// Get delivery status
const status = await tb.messages.getStatus("msg_abc123");
console.log(status.status); // "delivered"

// React to a message
await tb.messages.react("msg_abc123", { reaction: "love" });

// Edit a message
await tb.messages.edit("msg_abc123", {
  content: { text: "Updated text" },
});
```

## Chats

```typescript
// Create a group chat
const chat = await tb.chats.create({
  name: "Project Team",
  participants: ["+14155551234", "+14155555678"],
});

// Get chat details
const chatInfo = await tb.chats.get("chat_guid");

// Rename a chat
await tb.chats.rename("chat_guid", { name: "New Name" });

// Add/remove participants
await tb.chats.addParticipant("chat_guid", { phoneNumber: "+14155559999" });
await tb.chats.removeParticipant("chat_guid", { phoneNumber: "+14155559999" });

// Leave a chat
await tb.chats.leave("chat_guid");

// Mark read/unread
await tb.chats.markRead("chat_guid");
await tb.chats.markUnread("chat_guid");

// Send typing indicator
await tb.chats.sendTyping("chat_guid");
```

## Contacts

```typescript
// Create a contact
const contact = await tb.contacts.create({
  firstName: "Jane",
  lastName: "Doe",
  phoneNumber: "+14155551234",
  email: "jane@example.com",
  tags: ["vip"],
});

// List contacts
const contacts = await tb.contacts.list({
  tag: "vip",
  search: "Jane",
  limit: 50,
});

// Get, update, delete
const c = await tb.contacts.get("contact_id");
await tb.contacts.update("contact_id", { tags: ["vip", "partner"] });
await tb.contacts.delete("contact_id");

// Bulk operations (max 100 contacts)
await tb.contacts.bulkCreate({
  contacts: [
    { firstName: "Alice", phoneNumber: "+14155551111" },
    { firstName: "Bob", phoneNumber: "+14155552222" },
  ],
});
await tb.contacts.bulkDelete({ ids: ["id1", "id2"] });
```

## Payment Requests (Apple Cash)

Request payments via iMessage. This sends a formatted message with payment details — **the recipient must manually send payment via Apple Cash**.

> **Note:** These are payment _requests_, not actual Apple Pay transactions. We detect when payments are received by pattern-matching incoming iMessages.

```typescript
// Request a payment (sends formatted iMessage)
const payment = await tb.payments.request({
  to: "+14155551234",
  amount: 25.0,
  currency: "USD",
  memo: "Lunch",
});

// List payment requests
const payments = await tb.payments.list();

// Get a specific request
const req = await tb.payments.get("pay_abc123");

// Cancel a pending request (marks as cancelled, fires webhook)
await tb.payments.cancel("pay_abc123");
```

### How Payment Detection Works

1. You call `payments.request()` → We send a formatted iMessage asking for payment
2. Recipient manually sends money via Apple Cash
3. We detect the incoming "sent you $X" message and match it to your request
4. Status updates to `paid` and `payment.request.paid` webhook fires

## Numbers

List the phone numbers and iMessage emails that are authorized as valid `from` addresses for your account.

```typescript
const numbers = await tb.numbers.list();
for (const n of numbers) {
  console.log(n.phoneNumber, n.email, n.isDefault, n.healthStatus);
}
```

Each entry: `{ phoneNumber, email, instanceName, isDefault, healthStatus }` where `healthStatus` is `"healthy" | "degraded" | "unhealthy" | "unknown"`.

## Capabilities

```typescript
// Check if a phone number supports iMessage
const result = await tb.capabilities.check("+14155551234");
console.log(result.iMessage); // true or false
```

## Receiving incoming messages

There are two ways to listen for inbound messages (fans replying to you):

1. **Webhooks** — the API POSTs events to a URL you host. Best for production servers that are reachable from the internet. See [Webhooks](#webhooks) below.
2. **Server-Sent Events (SSE)** — open a long-lived HTTP stream from your process to `GET /v1/events`. Best for local dev, scripts, or clients that can't host a public URL. See [Real-Time Events (SSE)](#real-time-events-sse) below.

Both paths emit the **same event envelope** (`{ id, type, timestamp, data }`) and the **same event types**. The inbound-message event is `message.inbound` — its `data` contains `messageId`, `from`, `to`, `text`, `channel`, and any `attachments`.

Quick webhook example (handles inbound messages):

```typescript
import { WebhookHandler } from "@textbubbles/js";

const handler = new WebhookHandler({ secret: process.env.WEBHOOK_SECRET! });

handler.on("message.inbound", async (event) => {
  console.log(`${event.data.from}: ${event.data.text}`);
});

// In your HTTP route (Express example):
app.post("/webhooks/textbubbles", async (req, res) => {
  const result = await handler.handleRequest(
    JSON.stringify(req.body),
    req.get("X-Signature")!,
    req.get("X-Timestamp") ?? undefined,
  );
  res.status(result.ok ? 200 : 400).send(result);
});
```

Quick SSE example:

```typescript
import { TextBubblesEventClient } from "@textbubbles/js";

const events = new TextBubblesEventClient({
  url: "https://api.textbubbles.com/v1/events",
  headers: { Authorization: `Bearer ${process.env.TEXTBUBBLES_API_KEY}` },
});

events.on("message.inbound", (event) => {
  console.log(`${event.data.from}: ${event.data.text}`);
});

events.connect();
```

## Webhooks

### Configuration

```typescript
// Get current webhook config
const config = await tb.webhooks.get();

// Set webhook config — subscribe to specific events
await tb.webhooks.set({
  url: "https://example.com/webhooks/textbubbles",
  secret: "whsec_your_secret",
  events: ["message.received", "message.delivered"],
});

// Subscribe to ALL events with wildcard
await tb.webhooks.set({
  url: "https://example.com/webhooks/textbubbles",
  secret: "whsec_your_secret",
  events: ["*"],
});
```

### Handling Webhooks

The API sends webhooks with an `X-Signature` header (`sha256=<hex>` format) and an `X-Timestamp` header. The signature is HMAC-SHA256 of `${timestamp}.${body}`.

```typescript
import { verifyWebhookSignature, parseWebhookEvent, isMessageEvent } from "@textbubbles/js/webhooks";

// Verify signature (pass timestamp from X-Timestamp header)
const isValid = await verifyWebhookSignature(rawBody, signature, secret, timestamp);

// Parse and handle events
const event = parseWebhookEvent(rawBody);

if (isMessageEvent(event)) {
  console.log("Message:", event.data.content.text);
}
```

### WebhookHandler Class

For server frameworks without a dedicated integration:

```typescript
import { WebhookHandler } from "@textbubbles/js/webhooks";

const handler = new WebhookHandler({
  secret: process.env.WEBHOOK_SECRET!,
  onError: (err) => console.error(err),
});

handler
  .on("message.received", (event) => {
    console.log("New message from:", event.data.from);
  })
  .on("message.delivered", (event) => {
    console.log("Delivered:", event.data.id);
  });

// In your route handler:
const { ok, error } = await handler.handleRequest(body, signature, timestamp);
```

### Next.js Integration

**App Router** (`app/api/webhooks/textbubbles/route.ts`):

```typescript
import { createWebhookHandler } from "@textbubbles/js/nextjs";

const handler = createWebhookHandler({
  secret: process.env.TEXTBUBBLES_WEBHOOK_SECRET!,
  handlers: {
    "message.received": async (event) => {
      console.log("New message from:", event.data.from);
    },
    "message.delivered": async (event) => {
      console.log("Message delivered:", event.data.id);
    },
    "payment.request.paid": async (event) => {
      console.log("Payment received:", event.data.amount);
    },
  },
  onError: (err) => console.error("Webhook error:", err),
});

export const POST = handler;
```

**Pages Router** (`pages/api/webhooks/textbubbles.ts`):

```typescript
import { createWebhookHandler } from "@textbubbles/js/nextjs";

export default createWebhookHandler({
  secret: process.env.TEXTBUBBLES_WEBHOOK_SECRET!,
  handlers: {
    "message.received": async (event) => {
      console.log("New message:", event.data.content.text);
    },
  },
});
```

## Real-Time Events (SSE)

Receive events in real-time using Server-Sent Events:

```typescript
import { TextBubblesEventClient } from "@textbubbles/js/events";

const events = new TextBubblesEventClient({
  url: "https://api.textbubbles.com/v1/events",
  headers: { Authorization: `Bearer ${apiKey}` },
});

// Listen for specific events
events.on("message.received", (event) => {
  console.log("New message:", event.data);
});

// Listen for all events
events.on("*", (event) => {
  console.log("Event:", event.type);
});

// Connect (auto-reconnects with exponential backoff)
events.connect();

// Check connection status
console.log(events.isConnected);

// Disconnect when done
events.disconnect();
```

## Message Direction Helpers

```typescript
import { isOutgoingMessage, isIncomingMessage } from "@textbubbles/js";

const msg = await tb.messages.get("msg_abc123");

if (isIncomingMessage(msg)) {
  // msg.status === "received"
  console.log("From:", msg.from, "via", msg.channel);
}

if (isOutgoingMessage(msg)) {
  console.log("Sent to:", msg.to, "status:", msg.status);
}
```

## Webhook Event Types

| Event | Description |
|-------|-------------|
| `message.sent` | Message was sent |
| `message.delivered` | Message was delivered |
| `message.read` | Message was read |
| `message.failed` | Message delivery failed |
| `message.received` | New message received |
| `message.scheduled` | Message was scheduled |
| `message.schedule_cancelled` | Scheduled message cancelled |
| `message.reaction` | Reaction on a message (via message context) |
| `reaction.added` | Reaction added to message |
| `reaction.removed` | Reaction removed from message |
| `typing.started` | User started typing |
| `typing.stopped` | User stopped typing |
| `typing.indicator` | Typing indicator received |
| `payment.request.created` | Payment request sent |
| `payment.request.paid` | Payment detected from recipient |
| `payment.request.cancelled` | Payment request cancelled |
| `payment.request.expired` | Payment request expired (30 days) |
| `facetime.incoming` | Incoming FaceTime call detected |
| `facetime.status_changed` | FaceTime call status changed |

## Error Handling

```typescript
import {
  TextBubblesError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
} from "@textbubbles/js";

try {
  await tb.messages.send({ to: "+1...", content: { text: "Hi" } });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log("Rate limited, retry after:", err.retryAfter, "seconds");
  } else if (err instanceof AuthenticationError) {
    console.log("Check your API key");
  } else if (err instanceof ValidationError) {
    console.log("Invalid request:", err.details);
  } else if (err instanceof NotFoundError) {
    console.log("Resource not found");
  } else if (err instanceof TextBubblesError) {
    console.log("API error:", err.status, err.message);
  }
}
```

## TypeScript

All request params and response types are exported:

```typescript
import type {
  Message,
  MessageChannel,
  SendMessageParams,
  WebhookEvent,
  WebhookEventType,
} from "@textbubbles/js";
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- TypeScript 5.0+ (optional, for type checking)

## License

MIT
