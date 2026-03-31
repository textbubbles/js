import type { WebhookEvent, WebhookEventType } from "./types.js";

type EventHandler = (event: WebhookEvent) => void;

interface EventClientOptions {
  /** The SSE endpoint URL to connect to. */
  url: string;
  /** Optional headers to send with the connection (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Initial reconnect delay in ms. Defaults to 1000. */
  reconnectDelay?: number;
  /** Maximum reconnect delay in ms. Defaults to 30000. */
  maxReconnectDelay?: number;
}

/**
 * Real-time event client using Server-Sent Events (SSE).
 *
 * ```ts
 * const events = new TextBubblesEventClient({
 *   url: 'https://api.textbubbles.com/v1/events',
 *   headers: { Authorization: 'Bearer sk_...' },
 * });
 *
 * events.on('message.received', (event) => {
 *   console.log('New message:', event.data);
 * });
 *
 * events.connect();
 * ```
 */
export class TextBubblesEventClient {
  private url: string;
  private headers: Record<string, string>;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private currentDelay: number;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private abortController: AbortController | null = null;
  private connected = false;
  private shouldReconnect = true;

  constructor(options: EventClientOptions) {
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.reconnectDelay = options.reconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30000;
    this.currentDelay = this.reconnectDelay;
  }

  /**
   * Register an event handler for a specific webhook event type,
   * or use '*' to listen to all events.
   */
  on(type: WebhookEventType | "*", handler: EventHandler): this {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
    return this;
  }

  /** Remove an event handler. */
  off(type: WebhookEventType | "*", handler: EventHandler): this {
    this.listeners.get(type)?.delete(handler);
    return this;
  }

  /** Connect to the SSE endpoint and start receiving events. */
  connect(): void {
    this.shouldReconnect = true;
    this.startConnection();
  }

  /** Disconnect and stop receiving events. */
  disconnect(): void {
    this.shouldReconnect = false;
    this.connected = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /** Whether the client is currently connected. */
  get isConnected(): boolean {
    return this.connected;
  }

  private async startConnection(): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        headers: {
          Accept: "text/event-stream",
          ...this.headers,
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("SSE response has no body");
      }

      this.connected = true;
      this.currentDelay = this.reconnectDelay;
      this.emit("*", { id: "", type: "typing.started" as WebhookEventType, timestamp: new Date().toISOString() } as never);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventData = "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            eventData += line.slice(6);
          } else if (line === "" && eventData) {
            try {
              const event = JSON.parse(eventData) as WebhookEvent;
              this.emit(event.type, event);
              this.emit("*", event);
            } catch {
              // Skip malformed events
            }
            eventData = "";
          }
        }
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) return;
      this.connected = false;
    }

    this.connected = false;
    if (this.shouldReconnect) {
      setTimeout(() => this.startConnection(), this.currentDelay);
      this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
    }
  }

  private emit(type: string, event: WebhookEvent): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Don't let handler errors break the event loop
        }
      }
    }
  }
}
