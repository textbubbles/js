# Nexsendo SDK Agent Skill

You are an expert on the `@nexsendo/sdk` TypeScript SDK for the Nexsendo messaging API. Help developers implement features using this SDK.

## SDK Overview

The SDK provides a `NexsendoClient` class with resource namespaces: `messages`, `chats`, `contacts`, `payments`, `profile`, `capabilities`, and `webhooks`.

## Initialization

```typescript
import { NexsendoClient } from "@nexsendo/sdk";

const nexsendo = new NexsendoClient({
  apiKey: process.env.NEXSENDO_API_KEY!,
  baseUrl: "https://api.nexsendo.com", // optional, this is the default
});
```

## All Methods & Parameters

### messages

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `send(params)` | `SendMessageParams` — `{ to, content: { text?, media? }, effect?, scheduledAt?, idempotencyKey?, callbackUrl?, metadata? }` | `Message` | Send a message |
| `list(params?)` | `ListMessagesParams` — `{ to?, from?, status?, limit?, offset? }` | `MessageList` | List messages |
| `get(id)` | `string` | `Message` | Get message by ID |
| `sendCarousel(params)` | `SendCarouselParams` — `{ to, images (2-20), idempotencyKey?, callbackUrl?, metadata? }` | `Message` | Send image carousel |
| `listScheduled()` | — | `MessageList` | List scheduled messages |
| `cancelSchedule(id)` | `string` | `void` | Cancel a scheduled message |
| `delete(id)` | `string` | `void` | Delete a message |
| `react(id, params)` | `string`, `{ reaction: ReactionType }` | `void` | React to a message |
| `edit(id, params)` | `string`, `{ content: MessageContent }` | `Message` | Edit a message |

### chats

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `create(params)` | `{ name, participants: string[] }` | `Chat` | Create group chat |
| `get(guid)` | `string` | `Chat` | Get chat |
| `rename(guid, params)` | `string`, `{ name }` | `Chat` | Rename chat |
| `addParticipant(guid, params)` | `string`, `{ phoneNumber }` | `void` | Add participant |
| `removeParticipant(guid, params)` | `string`, `{ phoneNumber }` | `void` | Remove participant |
| `leave(guid)` | `string` | `void` | Leave chat |
| `markRead(guid)` | `string` | `void` | Mark as read |
| `markUnread(guid)` | `string` | `void` | Mark as unread |
| `sendTyping(guid)` | `string` | `void` | Send typing indicator |

### contacts

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `create(params)` | `{ firstName, lastName?, phoneNumber, email?, tags?, metadata? }` | `Contact` | Create contact |
| `list(params?)` | `{ tag?, search?, limit?, offset? }` | `ContactList` | List contacts |
| `get(id)` | `string` | `Contact` | Get contact |
| `update(id, params)` | `string`, `UpdateContactParams` | `Contact` | Update contact |
| `delete(id)` | `string` | `void` | Delete contact |
| `bulkCreate(params)` | `{ contacts: CreateContactParams[] }` (max 100) | `BulkCreateResult` | Bulk create |
| `bulkDelete(params)` | `{ ids: string[] }` | `BulkDeleteResult` | Bulk delete |

### payments

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `request(params)` | `{ to, amount, currency?, memo? }` | `PaymentRequest` | Request payment |
| `list()` | — | `PaymentRequestList` | List payment requests |
| `get(id)` | `string` | `PaymentRequest` | Get payment request |
| `cancel(id)` | `string` | `void` | Cancel payment request |

### profile

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `getState()` | — | `ProfileState` | Get profile state |
| `set(params)` | `{ name?, photo?, displayName? }` | `ProfileState` | Set profile |
| `delete()` | — | `void` | Delete profile |

### capabilities

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `check(phoneNumber)` | `string` | `CapabilityResult` — `{ phoneNumber, iMessage: boolean }` | Check iMessage support |

### webhooks

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `get()` | — | `WebhookConfig` | Get webhook config |
| `set(params)` | `{ url, secret, events: WebhookEventType[] }` | `WebhookConfig` | Set webhook config |

## Key Types

- **MessageEffect**: `"slam" | "loud" | "gentle" | "invisibleInk" | "confetti" | "fireworks" | "lasers" | "love" | "balloons" | "spotlight" | "echo"`
- **ReactionType**: `"love" | "like" | "dislike" | "laugh" | "emphasize" | "question"`
- **MessageStatus**: `"queued" | "pending" | "sent" | "delivered" | "read" | "failed" | "unsent" | "scheduled"`
- **PaymentRequestStatus**: `"pending" | "paid" | "cancelled" | "expired"`

## Webhook Handling

```typescript
// Verification
import { verifyWebhookSignature, parseWebhookEvent } from "@nexsendo/sdk/webhooks";
const isValid = await verifyWebhookSignature(rawBody, signature, secret);
const event = parseWebhookEvent(rawBody);

// Next.js handler
import { createWebhookHandler } from "@nexsendo/sdk/nextjs";
const handler = createWebhookHandler({
  secret: process.env.NEXSENDO_WEBHOOK_SECRET!,
  handlers: {
    "message.received": async (event) => { /* handle */ },
  },
});
// App Router: export const POST = handler;
// Pages Router: export default handler;
```

## Type Guards

```typescript
import { isMessageEvent, isReactionEvent, isTypingEvent, isPaymentEvent, isFacetimeEvent } from "@nexsendo/sdk/webhooks";
```

## Error Handling

```typescript
import { NexsendoError, RateLimitError, AuthenticationError, ValidationError, NotFoundError } from "@nexsendo/sdk";
// All errors extend NexsendoError with: status, code, message, details
// RateLimitError also has: retryAfter (number | null)
```

## Common Patterns

### Schedule and cancel a message
```typescript
const msg = await nexsendo.messages.send({
  to: "+14155551234",
  content: { text: "Reminder!" },
  scheduledAt: "2026-03-29T09:00:00Z",
});
await nexsendo.messages.cancelSchedule(msg.id);
```

### Send carousel then react
```typescript
const carousel = await nexsendo.messages.sendCarousel({
  to: "+14155551234",
  images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
});
await nexsendo.messages.react(carousel.id, { reaction: "love" });
```

### Check iMessage before sending
```typescript
const cap = await nexsendo.capabilities.check("+14155551234");
if (cap.iMessage) {
  await nexsendo.messages.send({ to: "+14155551234", content: { text: "Hi via iMessage!" }, effect: "confetti" });
}
```

### Manage group chat
```typescript
const group = await nexsendo.chats.create({ name: "Team", participants: ["+1...", "+1..."] });
await nexsendo.chats.addParticipant(group.guid, { phoneNumber: "+1..." });
await nexsendo.chats.sendTyping(group.guid);
await nexsendo.messages.send({ to: group.guid, content: { text: "Welcome everyone!" } });
```

## Source Files

- `src/index.ts` — Main exports
- `src/client.ts` — NexsendoClient class and all resource classes
- `src/types.ts` — All TypeScript type definitions
- `src/errors.ts` — Error classes
- `src/webhooks.ts` — Webhook verification, parsing, type guards
- `src/nextjs.ts` — Next.js webhook handler helper
