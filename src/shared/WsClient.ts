/**
 * shared/WsClient.ts
 * Minimal WebSocket client that reconnects with bounded exponential backoff.
 * Validates incoming messages with the WsMessage schema.
 */
import { WsMessageSchema, type WsMessage } from './events';

const BASE_DELAY = 500;
const MAX_DELAY  = 30_000;
const MAX_RETRIES = 20;

type WsHandler = (msg: WsMessage) => void;
type StatusHandler = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private timeoutId = 0;
  private _intentionallyClosed = false;

  private handlers: Set<WsHandler>       = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();

  constructor(private readonly url: string) {}

  connect(): void {
    this._intentionallyClosed = false;
    this._open();
  }

  disconnect(): void {
    this._intentionallyClosed = true;
    clearTimeout(this.timeoutId);
    this.ws?.close();
    this.ws = null;
  }

  send(msg: WsMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(fn: WsHandler): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  onStatus(fn: StatusHandler): () => void {
    this.statusHandlers.add(fn);
    return () => this.statusHandlers.delete(fn);
  }

  private _open(): void {
    this._emitStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.retries = 0;
      this._emitStatus('connected');
    };

    this.ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string);
        const parsed = WsMessageSchema.safeParse(raw);
        if (parsed.success) {
          for (const fn of this.handlers) fn(parsed.data);
        }
      } catch {
        // malformed message — ignore
      }
    };

    this.ws.onerror = () => {
      this._emitStatus('error');
    };

    this.ws.onclose = () => {
      if (!this._intentionallyClosed) {
        this._scheduleReconnect();
      } else {
        this._emitStatus('disconnected');
      }
    };
  }

  private _scheduleReconnect(): void {
    if (this._intentionallyClosed || this.retries >= MAX_RETRIES) {
      this._emitStatus('error');
      return;
    }
    const jitter = Math.random() * 300;
    const delay  = Math.min(BASE_DELAY * 2 ** this.retries + jitter, MAX_DELAY);
    this.retries++;
    this._emitStatus('disconnected');
    this.timeoutId = window.setTimeout(() => this._open(), delay);
  }

  private _emitStatus(s: Parameters<StatusHandler>[0]): void {
    for (const fn of this.statusHandlers) fn(s);
  }
}
