# @nexsendo/sdk

TypeScript SDK for the Nexsendo messaging API. Supports iMessage, group chats, contacts, payments, webhooks, and more.

## Install

```bash
npm install @nexsendo/sdk
```

## Quick Start

```typescript
import { NexsendoClient } from "@nexsendo/sdk";

const nexsendo = new NexsendoClient({
  apiKey: "your-api-key-here",
});

// Send a message
const message = await nexsendo.messages.send({
  to: "+14155551234",
  content: { text: "Hello from Nexsendo!" },
});

// Send with effects
await nexsendo.messages.send({
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
cp -r node_modules/@nexsendo/sdk/skill ./nexsendo-skill

# Or reference it in AGENTS.md
echo "Skill: node_modules/@nexsendo/sdk/skill/SKILL.md" >> AGENTS.md
```

### Cursor

Add to `.cursor/rules`:

```
Read and follow the Nexsendo SDK skill at: node_modules/@nexsendo/sdk/skill/SKILL.md
```

Or copy `skill/SKILL.md` content into your `.cursorrules` file.

### What the Skill Provides

- Complete API reference for all SDK methods
- Parameter types and return values
- Code examples for common use cases
- Webhook event handling patterns
- Next.js integration examples

---

## Messages

```typescript
// Send a message
await nexsendo.messages.send({
  to: "+14155551234",
  content: { text: "Hello!", media: ["https://example.com/photo.jpg"] },
  effect: "confetti",
  scheduledAt: "2026-03-29T09:00:00Z",
  idempotencyKey: "unique-key",
  callbackUrl: "https://example.com/callback",
  metadata: { orderId: "123" },
});

// List messages
const messages = await nexsendo.messages.list({
  to: "+14155551234",
  status: "delivered",
  limit: 20,
  offset: 0,
});

// Get a message
const msg = await nexsendo.messages.get("msg_abc123");

// Send image carousel (2-20 images)
await nexsendo.messages.sendCarousel({
  to: "+14155551234",
  images: [
    "https://example.com/img1.jpg",
    "https://example.com/img2.jpg",
  ],
});

// List scheduled messages
const scheduled = await nexsendo.messages.listScheduled();

// Cancel a scheduled message
await nexsendo.messages.cancelSchedule("msg_abc123");

// Delete a message
await nexsendo.messages.delete("msg_abc123");

// React to a message
await nexsendo.messages.react("msg_abc123", { reaction: "love" });

// Edit a message
await nexsendo.messages.edit("msg_abc123", {
  content: { text: "Updated text" },
});
```

## Chats

```typescript
// Create a group chat
const chat = await nexsendo.chats.create({
  name: "Project Team",
  participants: ["+14155551234", "+14155555678"],
});

// Get chat details
const chatInfo = await nexsendo.chats.get("chat_guid");

// Rename a chat
await nexsendo.chats.rename("chat_guid", { name: "New Name" });

// Add/remove participants
await nexsendo.chats.addParticipant("chat_guid", { phoneNumber: "+14155559999" });
await nexsendo.chats.removeParticipant("chat_guid", { phoneNumber: "+14155559999" });

// Leave a chat
await nexsendo.chats.leave("chat_guid");

// Mark read/unread
await nexsendo.chats.markRead("chat_guid");
await nexsendo.chats.markUnread("chat_guid");

// Send typing indicator
await nexsendo.chats.sendTyping("chat_guid");
```

## Contacts

```typescript
// Create a contact
const contact = await nexsendo.contacts.create({
  firstName: "Jane",
  lastName: "Doe",
  phoneNumber: "+14155551234",
  email: "jane@example.com",
  tags: ["vip"],
});

// List contacts
const contacts = await nexsendo.contacts.list({
  tag: "vip",
  search: "Jane",
  limit: 50,
});

// Get, update, delete
const c = await nexsendo.contacts.get("contact_id");
await nexsendo.contacts.update("contact_id", { tags: ["vip", "partner"] });
await nexsendo.contacts.delete("contact_id");

// Bulk operations (max 100 contacts)
await nexsendo.contacts.bulkCreate({
  contacts: [
    { firstName: "Alice", phoneNumber: "+14155551111" },
    { firstName: "Bob", phoneNumber: "+14155552222" },
  ],
});
await nexsendo.contacts.bulkDelete({ ids: ["id1", "id2"] });
```

## Payment Requests (Apple Cash)

Request payments via iMessage. This sends a formatted message with payment details — **the recipient must manually send payment via Apple Cash**.

> **Note:** These are payment _requests_, not actual Apple Pay transactions. We detect when payments are received by pattern-matching incoming iMessages.

```typescript
// Request a payment (sends formatted iMessage)
const payment = await nexsendo.payments.request({
  to: "+14155551234",
  amount: 25.0,
  currency: "USD",
  memo: "Lunch",
});

// List payment requests
const payments = await nexsendo.payments.list();

// Get a specific request
const req = await nexsendo.payments.get("pay_abc123");

// Cancel a pending request (marks as cancelled, fires webhook)
await nexsendo.payments.cancel("pay_abc123");
```

### How Payment Detection Works

1. You call `payments.request()` → We send a formatted iMessage asking for payment
2. Recipient manually sends money via Apple Cash
3. We detect the incoming "sent you $X" message and match it to your request
4. Status updates to `paid` and `payment.request.paid` webhook fires

## Profile (Name & Photo Sharing)

```typescript
// Get profile state
const state = await nexsendo.profile.getState();

// Set profile
await nexsendo.profile.set({
  name: "John Doe",
  displayName: "John",
  photo: "https://example.com/photo.jpg",
});

// Delete profile
await nexsendo.profile.delete();
```

## Capabilities

```typescript
// Check if a phone number supports iMessage
const result = await nexsendo.capabilities.check("+14155551234");
console.log(result.iMessage); // true or false
```

## Webhooks

### Configuration

```typescript
// Get current webhook config
const config = await nexsendo.webhooks.get();

// Set webhook config
await nexsendo.webhooks.set({
  url: "https://example.com/webhooks/nexsendo",
  secret: "whsec_your_secret",
  events: ["message.received", "message.delivered"],
});
```

### Handling Webhooks

```typescript
import { verifyWebhookSignature, parseWebhookEvent, isMessageEvent } from "@nexsendo/sdk/webhooks";

// Verify signature
const isValid = await verifyWebhookSignature(rawBody, signature, secret);

// Parse and handle events
const event = parseWebhookEvent(rawBody);

if (isMessageEvent(event)) {
  console.log("Message:", event.data.content.text);
}
```

### Next.js Integration

**App Router** (`app/api/webhooks/nexsendo/route.ts`):

```typescript
import { createWebhookHandler } from "@nexsendo/sdk/nextjs";

const handler = createWebhookHandler({
  secret: process.env.NEXSENDO_WEBHOOK_SECRET!,
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

**Pages Router** (`pages/api/webhooks/nexsendo.ts`):

```typescript
import { createWebhookHandler } from "@nexsendo/sdk/nextjs";

export default createWebhookHandler({
  secret: process.env.NEXSENDO_WEBHOOK_SECRET!,
  handlers: {
    "message.received": async (event) => {
      console.log("New message:", event.data.content.text);
    },
  },
});
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
| `reaction.added` | Reaction added to message |
| `reaction.removed` | Reaction removed from message |
| `typing.started` | User started typing |
| `typing.stopped` | User stopped typing |
| `payment.request.created` | Payment request sent |
| `payment.request.paid` | Payment detected from recipient |
| `payment.request.cancelled` | Payment request cancelled |
| `payment.request.expired` | Payment request expired (30 days) |
| `facetime.incoming` | Incoming FaceTime call detected |
| `facetime.status_changed` | FaceTime call status changed |

## Error Handling

```typescript
import {
  NexsendoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
} from "@nexsendo/sdk";

try {
  await nexsendo.messages.send({ to: "+1...", content: { text: "Hi" } });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log("Rate limited, retry after:", err.retryAfter, "seconds");
  } else if (err instanceof AuthenticationError) {
    console.log("Check your API key");
  } else if (err instanceof ValidationError) {
    console.log("Invalid request:", err.details);
  } else if (err instanceof NotFoundError) {
    console.log("Resource not found");
  } else if (err instanceof NexsendoError) {
    console.log("API error:", err.status, err.message);
  }
}
```

## TypeScript

All request params and response types are exported:

```typescript
import type { Message, SendMessageParams, WebhookEvent } from "@nexsendo/sdk";
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- TypeScript 5.0+ (optional, for type checking)

## License

MIT
