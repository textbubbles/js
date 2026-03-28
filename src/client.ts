import {
  NexsendoError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
} from "./errors.js";
import type {
  NexsendoConfig,
  SendMessageParams,
  ListMessagesParams,
  SendCarouselParams,
  ReactToMessageParams,
  EditMessageParams,
  Message,
  MessageList,
  CreateGroupParams,
  Chat,
  RenameChatParams,
  ChatParticipantParams,
  CreateContactParams,
  UpdateContactParams,
  ListContactsParams,
  Contact,
  ContactList,
  BulkCreateContactsParams,
  BulkDeleteContactsParams,
  BulkCreateResult,
  BulkDeleteResult,
  RequestPaymentParams,
  PaymentRequest,
  PaymentRequestList,
  ProfileState,
  SetProfileParams,
  CapabilityResult,
  WebhookConfig,
  SetWebhookParams,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.nexsendo.com";

export class NexsendoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  public readonly messages: MessagesResource;
  public readonly chats: ChatsResource;
  public readonly contacts: ContactsResource;
  public readonly payments: PaymentsResource;
  public readonly profile: ProfileResource;
  public readonly capabilities: CapabilitiesResource;
  public readonly webhooks: WebhooksResource;

  constructor(config: NexsendoConfig) {
    if (!config.apiKey) {
      throw new AuthenticationError("API key is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

    this.messages = new MessagesResource(this);
    this.chats = new ChatsResource(this);
    this.contacts = new ContactsResource(this);
    this.payments = new PaymentsResource(this);
    this.profile = new ProfileResource(this);
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

    return (await res.json()) as T;
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
        throw new NexsendoError(
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
  constructor(private client: NexsendoClient) {}

  async send(params: SendMessageParams): Promise<Message> {
    return this.client.request<Message>("POST", "/v1/messages", params);
  }

  async list(params?: ListMessagesParams): Promise<MessageList> {
    return this.client.request<MessageList>("GET", "/v1/messages", undefined, params as Record<string, string | number | undefined>);
  }

  async get(id: string): Promise<Message> {
    return this.client.request<Message>("GET", `/v1/messages/${encodeURIComponent(id)}`);
  }

  async sendCarousel(params: SendCarouselParams): Promise<Message> {
    return this.client.request<Message>("POST", "/v1/messages/carousel", params);
  }

  async listScheduled(): Promise<MessageList> {
    return this.client.request<MessageList>("GET", "/v1/messages/scheduled");
  }

  async cancelSchedule(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/messages/${encodeURIComponent(id)}/schedule`);
  }

  async delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/messages/${encodeURIComponent(id)}`);
  }

  async react(id: string, params: ReactToMessageParams): Promise<void> {
    return this.client.request<void>("POST", `/v1/messages/${encodeURIComponent(id)}/reaction`, params);
  }

  async edit(id: string, params: EditMessageParams): Promise<Message> {
    return this.client.request<Message>("PUT", `/v1/messages/${encodeURIComponent(id)}`, params);
  }
}

class ChatsResource {
  constructor(private client: NexsendoClient) {}

  async create(params: CreateGroupParams): Promise<Chat> {
    return this.client.request<Chat>("POST", "/v1/chats/groups", params);
  }

  async get(guid: string): Promise<Chat> {
    return this.client.request<Chat>("GET", `/v1/chats/${encodeURIComponent(guid)}`);
  }

  async rename(guid: string, params: RenameChatParams): Promise<Chat> {
    return this.client.request<Chat>("PUT", `/v1/chats/${encodeURIComponent(guid)}`, params);
  }

  async addParticipant(guid: string, params: ChatParticipantParams): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/participants`, params);
  }

  async removeParticipant(guid: string, params: ChatParticipantParams): Promise<void> {
    return this.client.request<void>("DELETE", `/v1/chats/${encodeURIComponent(guid)}/participants`, params);
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

  async sendTyping(guid: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/chats/${encodeURIComponent(guid)}/typing`);
  }
}

class ContactsResource {
  constructor(private client: NexsendoClient) {}

  async create(params: CreateContactParams): Promise<Contact> {
    return this.client.request<Contact>("POST", "/v1/contacts", params);
  }

  async list(params?: ListContactsParams): Promise<ContactList> {
    return this.client.request<ContactList>("GET", "/v1/contacts", undefined, params as Record<string, string | number | undefined>);
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
}

class PaymentsResource {
  constructor(private client: NexsendoClient) {}

  async request(params: RequestPaymentParams): Promise<PaymentRequest> {
    return this.client.request<PaymentRequest>("POST", "/v1/payments/request", params);
  }

  async list(): Promise<PaymentRequestList> {
    return this.client.request<PaymentRequestList>("GET", "/v1/payments/requests");
  }

  async get(id: string): Promise<PaymentRequest> {
    return this.client.request<PaymentRequest>("GET", `/v1/payments/requests/${encodeURIComponent(id)}`);
  }

  async cancel(id: string): Promise<void> {
    return this.client.request<void>("POST", `/v1/payments/requests/${encodeURIComponent(id)}/cancel`);
  }
}

class ProfileResource {
  constructor(private client: NexsendoClient) {}

  async getState(): Promise<ProfileState> {
    return this.client.request<ProfileState>("GET", "/v1/profile/state");
  }

  async set(params: SetProfileParams): Promise<ProfileState> {
    return this.client.request<ProfileState>("POST", "/v1/profile", params);
  }

  async delete(): Promise<void> {
    return this.client.request<void>("DELETE", "/v1/profile");
  }
}

class CapabilitiesResource {
  constructor(private client: NexsendoClient) {}

  async check(phoneNumber: string): Promise<CapabilityResult> {
    return this.client.request<CapabilityResult>("GET", `/v1/capabilities/${encodeURIComponent(phoneNumber)}`);
  }
}

class WebhooksResource {
  constructor(private client: NexsendoClient) {}

  async get(): Promise<WebhookConfig> {
    return this.client.request<WebhookConfig>("GET", "/v1/webhooks");
  }

  async set(params: SetWebhookParams): Promise<WebhookConfig> {
    return this.client.request<WebhookConfig>("PUT", "/v1/webhooks", params);
  }
}
