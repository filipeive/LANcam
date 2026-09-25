/**
 * LANCam — WebSocket Signaling Client
 *
 * Connects to the LANCam signaling server and handles
 * message routing for WebRTC signaling.
 */

import {
  RECONNECT_DELAYS_MS,
  MAX_RECONNECT_ATTEMPTS,
} from '@lancam/shared';
import type { ServerToClientMessage } from '@lancam/shared';

export type MessageHandler = (message: ServerToClientMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private pendingMessages: string[] = [];
  private _isConnected = false;

  constructor(
    private wsUrl: string,
    private onConnectionChange?: (connected: boolean) => void,
  ) {}

  /** Connect to the signaling server */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this._isConnected = true;
        this.reconnectAttempt = 0;
        this.onConnectionChange?.(true);

        // Flush pending messages
        for (const msg of this.pendingMessages) {
          this.ws?.send(msg);
        }
        this.pendingMessages = [];
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerToClientMessage;
          this.dispatch(message);
        } catch {
          console.error('[SignalingClient] Failed to parse message:', event.data);
        }
      };

      this.ws.onclose = (event) => {
        this._isConnected = false;
        this.onConnectionChange?.(false);

        if (event.code !== 4001 && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // Error events are followed by close events, handled above
      };
    } catch (err) {
      console.error('[SignalingClient] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  /** Send a message to the server */
  send(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.pendingMessages.push(data);
    }
  }

  /** Register a handler for a specific message type */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Register a handler for all messages */
  onAny(handler: MessageHandler): () => void {
    return this.on('*', handler);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /** Disconnect and stop reconnecting */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
    this._isConnected = false;
  }

  private dispatch(message: ServerToClientMessage): void {
    // Handle ping internally
    if (message.type === 'ping') {
      this.send({ type: 'pong' });
      return;
    }

    // Dispatch to type-specific handlers
    const typeHandlers = this.handlers.get(message.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        handler(message);
      }
    }

    // Dispatch to wildcard handlers
    const anyHandlers = this.handlers.get('*');
    if (anyHandlers) {
      for (const handler of anyHandlers) {
        handler(message);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[SignalingClient] Max reconnection attempts reached');
      return;
    }

    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt] ?? 30000;
    this.reconnectAttempt++;

    console.log(
      `[SignalingClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
