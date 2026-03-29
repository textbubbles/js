# TextBubbles SDK Agent Skill

You are an expert on the `@textbubbles/js` TypeScript SDK for the TextBubbles messaging API. Help developers implement features using this SDK.

## SDK Overview

The SDK provides a `TextBubblesClient` class with resource namespaces: `messages`, `chats`, `contacts`, `payments`, `profile`, `capabilities`, and `webhooks`.

## Initialization

```typescript
import { TextBubblesClient } from "@textbubbles/js";

const tb = new TextBubblesClient({
  apiKey: process.env.TEXTBUBBLES_API_KEY!,
  baseUrl: "https://api.textbubbles.com", // optional, this is the default
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
import { verifyWebhookSignature, parseWebhookEvent } from "@textbubbles/js/webhooks";
const isValid = await verifyWebhookSignature(rawBody, signature, secret);
const event = parseWebhookEvent(rawBody);

// Next.js handler
import { createWebhookHandler } from "@textbubbles/js/nextjs";
const handler = createWebhookHandler({
  secret: process.env.TEXTBUBBLES_WEBHOOK_SECRET!,
  handlers: {
    "message.received": async (event) => { /* handle */ },
  },
});
// App Router: export const POST = handler;
// Pages Router: export default handler;
```

## Type Guards

```typescript
import { isMessageEvent, isReactionEvent, isTypingEvent, isPaymentEvent, isFacetimeEvent } from "@textbubbles/js/webhooks";
```

## Error Handling

```typescript
import { TextBubblesError, RateLimitError, AuthenticationError, ValidationError, NotFoundError } from "@textbubbles/js";
// All errors extend TextBubblesError with: status, code, message, details
// RateLimitError also has: retryAfter (number | null)
```

## Common Patterns

### Schedule and cancel a message
```typescript
const msg = await tb.messages.send({
  to: "+14155551234",
  content: { text: "Reminder!" },
  scheduledAt: "2026-03-29T09:00:00Z",
});
await tb.messages.cancelSchedule(msg.id);
```

### Send carousel then react
```typescript
const carousel = await tb.messages.sendCarousel({
  to: "+14155551234",
  images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
});
await tb.messages.react(carousel.id, { reaction: "love" });
```

### Check iMessage before sending
```typescript
const cap = await tb.capabilities.check("+14155551234");
if (cap.iMessage) {
  await tb.messages.send({ to: "+14155551234", content: { text: "Hi via iMessage!" }, effect: "confetti" });
}
```

### Manage group chat
```typescript
const group = await tb.chats.create({ name: "Team", participants: ["+1...", "+1..."] });
await tb.chats.addParticipant(group.guid, { phoneNumber: "+1..." });
await tb.chats.sendTyping(group.guid);
await tb.messages.send({ to: group.guid, content: { text: "Welcome everyone!" } });
```

## CLI

The SDK includes a `textbubbles` CLI. Install globally with `npm i -g @textbubbles/js` or run via `npx @textbubbles/js`.

### Auth
```bash
textbubbles login              # Save API key to ~/.textbubbles/config.json
textbubbles logout             # Remove saved credentials
textbubbles whoami             # Show current auth status
```

### Messages
```bash
textbubbles send <to> <message> [--effect confetti] [--media url]
textbubbles send:carousel <to> <url1> <url2> [url3...]
textbubbles send:schedule <to> <message> --at "2026-03-29T09:00:00Z"
textbubbles messages list [--to +1...] [--limit 20]
textbubbles messages get <id>
textbubbles messages cancel <id>
```

### Contacts
```bash
textbubbles contacts list [--tag vip] [--search jane]
textbubbles contacts create --phone +1... --name "Jane Doe"
textbubbles contacts get <id>
textbubbles contacts delete <id>
```

### Capabilities
```bash
textbubbles check <phone>      # Check if phone supports iMessage
```

### Webhooks
```bash
textbubbles webhooks get
textbubbles webhooks set <url> [--events message.received,message.delivered] [--secret s]
```

### Payments
```bash
textbubbles pay:request <to> <amount> [--memo "For lunch"] [--currency USD]
textbubbles pay:list
textbubbles pay:cancel <id>
```

### Global Options
- `--json` — Output raw JSON instead of formatted tables
- `--help` — Show help for any command

### Config
Credentials are stored in `~/.textbubbles/config.json`. The `TEXTBUBBLES_API_KEY` env var takes precedence over the config file.

## Source Files

- `src/index.ts` — Main exports
- `src/client.ts` — TextBubblesClient class and all resource classes
- `src/types.ts` — All TypeScript type definitions
- `src/errors.ts` — Error classes
- `src/webhooks.ts` — Webhook verification, parsing, type guards
- `src/nextjs.ts` — Next.js webhook handler helper
- `src/cli.ts` — CLI entry point (commander-based)
