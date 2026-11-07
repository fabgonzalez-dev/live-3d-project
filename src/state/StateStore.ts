/**
 * state/StateStore.ts
 * Client-side reactive state store.
 * Receives snapshots/patches from the WebSocket server.
 * Control panel sends commands through it.
 * Rendering reads it via getState() — no direct mutation by consumers.
 */
import type { SessionState } from './types';
import { DEFAULT_STATE } from './types';

type Listener = (state: SessionState) => void;

export class StateStore {
  private _state: SessionState = { ...DEFAULT_STATE, visual: { ...DEFAULT_STATE.visual } };
  private _listeners: Set<Listener> = new Set();

  getState(): Readonly<SessionState> {
    return this._state;
  }

  applySnapshot(snapshot: Partial<SessionState>): void {
    this._state = { ...this._state, ...snapshot };
    this._notify();
  }

  applyPatch(patch: Partial<SessionState>): void {
    this._state = { ...this._state, ...patch };
    this._notify();
  }

  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void {
    for (const fn of this._listeners) fn(this._state);
  }
}
