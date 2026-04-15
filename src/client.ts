import {
  TextBubblesError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
} from "./errors.js";
import type {
  TextBubblesConfig,
  SendMessageParams,
  ListMessagesParams,
  SendCarouselParams,
  ReactToMessageParams,
  EditMessageParams,
  Message,
  MessageList,
  SendMessageResult,
  CreateGroupParams,
  Chat,
  RenameChatParams,
  AddParticipantParams,
  TypingIndicatorParams,
  CreateContactParams,
  UpdateContactParams,
  ListContactsParams,
  Contact,
  ContactList,
  FocusStatus,
  FaceTimeStatus,
  BulkCreateContactsParams,
  BulkDeleteContactsParams,
  BulkCreateResult,
  BulkDeleteResult,
  RequestPaymentParams,
  ListPaymentRequestsParams,
  PaymentRequest,
  PaymentRequestList,
  SenderNumber,
  CapabilityResult,
  WebhookConfig,
  SetWebhookParams,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.textbubbles.com";

export class TextBubblesClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  public readonly messages: MessagesResource;
  public readonly chats: ChatsResource;
  public readonly contacts: ContactsResource;
  public readonly payments: PaymentsResource;
  public readonly numbers: NumbersResource;
  public readonly capabilities: CapabilitiesResource;
  public readonly webhooks: WebhooksResource;

  constructor(config: TextBubblesConfig) {
    if (!config.apiKey) {
      throw new AuthenticationError("API key is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

    this.messages = new MessagesResource(this);
    this.chats = new ChatsResource(this);
    this.contacts = new ContactsResource(this);
    this.payments = new PaymentsResource(this);
    this.numbers = new NumbersResource(this);
    this.capabilities = new CapabilitiesResource(this);
    this.webhooks = new WebhooksResource(this);
  }

  /** @internal */
  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      await this.handleError(res);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const parsed = (await res.json()) as unknown;
    // The API wraps every success response as `{ success, data, requestId }`.
    // Unwrap so callers get the shape their types describe. Fall back to the
    // raw body for any endpoint that doesn't use the envelope.
    if (
      parsed &&
      typeof parsed === "object" &&
      "success" in parsed &&
      "data" in parsed &&
      (parsed as { success: unknown }).success === true
    ) {
      return (parsed as { data: T }).data;
    }
    return parsed as T;
  }

  private async handleError(res: Response): Promise<never> {
    let errorBody: { message?: string; code?: string; details?: unknown } | undefined;
    try {
      errorBody = (await res.json()) as { message?: string; code?: string; details?: unknown };
    } catch {
      // Response may not be JSON
    }

    const message = errorBody?.message ?? res.statusText;

    switch (res.status) {
      case 401:
        throw new AuthenticationError(message);
      case 404:
        throw new NotFoundError(message);
      case 429: {
        const retryAfter = res.headers.get("Retry-After");
        throw new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : null);
      }
      case 400:
      case 422:
        throw new ValidationError(message, errorBody?.details);
      default:
        throw new TextBubblesError(
          message,
          res.status,
          errorBody?.code ?? "api_error",
          errorBody?.details,
        );
    }
  }
}

// ── Resource Classes ──

class MessagesResource {
  constructor(private client: TextBubblesClient) {}

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    return this.client.request<SendMessageResult>("POST", "/v1/messages", params);
  }

  async list(params?: ListMessagesParams): Promise<MessageList> {
    const raw = await this.client.request<{
      messages: Message[];
      pagination: { hasMore: boolean; nextCursor?: string };
    }>("GET", "/v1/messages", undefined, params as Record<string, string | number | undefined>);
    return { data: raw.messages, hasMore: raw.pagination.hasMore, nextCursor: raw.pagination.nextCursor };
  }

  async get(id: string): Promise<Message> {
    return this.client.request<Message>("GET", `/v1/messages/${encodeURIComponent(id)}`);
  }

  async sendCarousel(params: SendCarouselParams): Promise<SendMessageResult> {
    return this.client.request<SendMessageResult>("POST", "/v1/messages/carousel", params);
  }

  async listScheduled(): Promise<MessageList> {
    const raw = await this.client.request<{
      messages: Message[];
      pagination: { hasMore: boolean; nextCursor?: string };
    }>("GET", "/v1/messages/scheduled");
    return { data: raw.messages, hasMore: raw.pagination.hasMore, nextCursor: raw.pagination.nextCursor };
  }

  async cancelSchedule(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/messages/${encodeURIComponent(id)}/schedule`);
  }

  async delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/messages/${encodeURIComponent(id)}`);
  }

  async react(id: string, params: ReactToMessageParams): Promise<void> {
    return this.client.request<void>("POST", `/v1/messages/${encodeURIComponent(id)}/reactions`, params);
  }

  async edit(id: string, params: EditMessageParams): Promise<Message> {
    return this.client.request<Message>("PUT", `/v1/messages/${encodeURIComponent(id)}`, params);
  }

  async unsend(id: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/messages/${encodeURIComponent(id)}/unsend`);
  }
}

class ChatsResource {
  constructor(private client: TextBubblesClient) {}

  async create(params: CreateGroupParams): Promise<Chat> {
    return this.client.request<Chat>("POST", "/v1/chats/groups", params);
  }

  async get(guid: string): Promise<Chat> {
    return this.client.request<Chat>("GET", `/v1/chats/${encodeURIComponent(guid)}`);
  }

  async rename(guid: string, params: RenameChatParams): Promise<Chat> {
    return this.client.request<Chat>("PUT", `/v1/chats/${encodeURIComponent(guid)}/name`, params);
  }

  async addParticipant(guid: string, params: AddParticipantParams): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/participants`, params);
  }

  async removeParticipant(guid: string, participantId: string): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/chats/${encodeURIComponent(guid)}/participants/${encodeURIComponent(participantId)}`);
  }

  async leave(guid: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/leave`);
  }

  async markRead(guid: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/read`);
  }

  async markUnread(guid: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/unread`);
  }

  async sendTyping(guid: string, params: TypingIndicatorParams): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/typing`, params);
  }
}

class ContactsResource {
  constructor(private client: TextBubblesClient) {}

  async create(params: CreateContactParams): Promise<Contact> {
    return this.client.request<Contact>("POST", "/v1/contacts", params);
  }

  async list(params?: ListContactsParams): Promise<ContactList> {
    const raw = await this.client.request<{ contacts: Contact[] }>(
      "GET",
      "/v1/contacts",
      undefined,
      params as Record<string, string | number | undefined>,
    );
    return { data: raw.contacts };
  }

  async get(id: string): Promise<Contact> {
    return this.client.request<Contact>("GET", `/v1/contacts/${encodeURIComponent(id)}`);
  }

  async update(id: string, params: UpdateContactParams): Promise<Contact> {
    return this.client.request<Contact>("PUT", `/v1/contacts/${encodeURIComponent(id)}`, params);
  }

  async delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/contacts/${encodeURIComponent(id)}`);
  }

  async bulkCreate(params: BulkCreateContactsParams): Promise<BulkCreateResult> {
    return this.client.request<BulkCreateResult>("POST", "/v1/contacts/bulk", params);
  }

  async bulkDelete(params: BulkDeleteContactsParams): Promise<BulkDeleteResult> {
    return this.client.request<BulkDeleteResult>("DELETE", "/v1/contacts/bulk", params);
  }

  async getFocusStatus(phoneNumber: string): Promise<FocusStatus> {
    return this.client.request<FocusStatus>("GET", `/v1/contacts/${encodeURIComponent(phoneNumber)}/focus`);
  }

  async getFaceTimeStatus(phoneNumber: string): Promise<FaceTimeStatus> {
    return this.client.request<FaceTimeStatus>("GET", `/v1/contacts/${encodeURIComponent(phoneNumber)}/facetime`);
  }
}

class PaymentsResource {
  constructor(private client: TextBubblesClient) {}

  async request(params: RequestPaymentParams): Promise<PaymentRequest> {
    return this.client.request<PaymentRequest>("POST", "/v1/payments/request", params);
  }

  async list(params?: ListPaymentRequestsParams): Promise<PaymentRequestList> {
    const raw = await this.client.request<{
      requests: PaymentRequest[];
      pagination: { hasMore: boolean; nextCursor?: string };
    }>("GET", "/v1/payments/requests", undefined, params as Record<string, string | number | undefined>);
    return { data: raw.requests, hasMore: raw.pagination.hasMore, nextCursor: raw.pagination.nextCursor };
  }

  async get(id: string): Promise<PaymentRequest> {
    return this.client.request<PaymentRequest>("GET", `/v1/payments/requests/${encodeURIComponent(id)}`);
  }

  async cancel(id: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/payments/requests/${encodeURIComponent(id)}/cancel`);
  }
}

class NumbersResource {
  constructor(private client: TextBubblesClient) {}

  async list(): Promise<SenderNumber[]> {
    return this.client.request<SenderNumber[]>("GET", "/v1/numbers");
  }
}

class CapabilitiesResource {
  constructor(private client: TextBubblesClient) {}

  async check(phoneNumber: string): Promise<CapabilityResult> {
    return this.client.request<CapabilityResult>("GET", `/v1/capabilities/${encodeURIComponent(phoneNumber)}`);
  }
}

class WebhooksResource {
  constructor(private client: TextBubblesClient) {}

  async get(): Promise<WebhookConfig> {
    return this.client.request<WebhookConfig>("GET", "/v1/webhooks");
  }

  async set(params: SetWebhookParams): Promise<WebhookConfig> {
    return this.client.request<WebhookConfig>("PUT", "/v1/webhooks", params);
  }
}
