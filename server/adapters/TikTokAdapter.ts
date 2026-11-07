/**
 * server/adapters/TikTokAdapter.ts
 * Milestone D — Live TikTok Ingestion Adapter Interface.
 *
 * Responsibilities:
 * - Decouples TikTok Live streaming connector from core server logic.
 * - Standardizes incoming platform payloads into NormalizedEvent contract.
 * - Graceful fallback to Simulator when live connection is absent or disabled.
 */

import type { NormalizedEvent } from '../../src/shared/events';

export interface PlatformAdapter {
  readonly isConnected: boolean;
  connect(uniqueId: string): Promise<boolean>;
  disconnect(): void;
  onEvent(handler: (event: NormalizedEvent) => void): void;
}

export class MockTikTokAdapter implements PlatformAdapter {
  private _connected = false;
  private handlers: Set<(event: NormalizedEvent) => void> = new Set();

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(uniqueId: string): Promise<boolean> {
    console.info(`[TikTokAdapter] Mock connecting to TikTok user: @${uniqueId}`);
    this._connected = true;
    return true;
  }

  disconnect(): void {
    this._connected = false;
    this.handlers.clear();
  }

  onEvent(handler: (event: NormalizedEvent) => void): void {
    this.handlers.add(handler);
  }

  emit(event: NormalizedEvent): void {
    for (const h of this.handlers) {
      h(event);
    }
  }
}
