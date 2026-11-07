/**
 * server/engine/EventEngine.ts
 * Milestone D — Authoritative Event Processing Engine.
 *
 * Responsibilities:
 * - Bounded FIFO event queue with drop-oldest overflow strategy.
 * - Time-to-live (TTL) deduplication of provider events.
 * - Per-user rate limiting (sliding window/token bucket).
 * - Strict XSS sanitization of strings (usernames, chat text).
 * - Like increment normalization (handling cumulative vs incremental).
 * - Gift streak tracking with timeout resolution.
 */

import type { NormalizedEvent } from '../../src/shared/events';

export interface EventEngineOptions {
  maxQueueSize?: number;      // default: 500
  dedupTtlMs?: number;        // default: 30,000 (30s)
  rateLimitPerSec?: number;   // default: 10 events/sec per user
}

export class EventEngine {
  private queue: NormalizedEvent[] = [];
  private readonly maxQueueSize: number;
  private readonly dedupTtlMs: number;
  private readonly rateLimitPerSec: number;

  // Deduplication store: providerEventId -> timestamp
  private dedupMap: Map<string, number> = new Map();

  // Rate limit store: userId -> array of timestamps
  private rateLimitMap: Map<string, number[]> = new Map();

  // Cumulative likes store: stream/session total tracker
  private totalLikesRecorded = 0;

  // Active gift streaks: `${userId}:${giftId}` -> { count, lastTimestamp }
  private giftStreaks: Map<string, { count: number; lastTimestamp: number }> = new Map();

  constructor(options: EventEngineOptions = {}) {
    this.maxQueueSize = options.maxQueueSize ?? 500;
    this.dedupTtlMs = options.dedupTtlMs ?? 30_000;
    this.rateLimitPerSec = options.rateLimitPerSec ?? 10;
  }

  /**
   * Strictly sanitize text to prevent HTML/XSS injection.
   */
  static sanitizeText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\0/g, '')
      .trim();
  }

  /**
   * Ingest and validate an incoming event.
   * Returns true if accepted and queued, false if rejected (duplicate/rate-limited).
   */
  ingest(event: NormalizedEvent): boolean {
    const now = Date.now();

    // 1. Deduplication check
    if (event.providerEventId) {
      this._pruneDedup(now);
      if (this.dedupMap.has(event.providerEventId)) {
        return false; // duplicate dropped
      }
      this.dedupMap.set(event.providerEventId, now);
    }

    // 2. Per-user rate limiting
    if (event.userId) {
      if (!this._checkRateLimit(event.userId, now)) {
        return false; // rate limit exceeded
      }
    }

    // 3. Sanitization of human-entered text fields
    if (event.displayName) {
      event.displayName = EventEngine.sanitizeText(event.displayName).slice(0, 32);
    }
    if (event.type === 'chat' && 'text' in event.payload) {
      event.payload.text = EventEngine.sanitizeText(event.payload.text).slice(0, 200);
    }

    // 4. Bounded Queue FIFO enqueue with drop-oldest strategy
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift(); // Drop oldest event
    }
    this.queue.push(event);

    return true;
  }

  /**
   * Pop the next event from the queue.
   */
  poll(): NormalizedEvent | undefined {
    return this.queue.shift();
  }

  /**
   * Peek next event without removing it.
   */
  peek(): NormalizedEvent | undefined {
    return this.queue[0];
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Process incoming like count (handles cumulative total vs incremental).
   * Returns the incremental delta that should trigger visual effects.
   */
  processLikes(count: number, isCumulative: boolean): number {
    if (isCumulative) {
      if (count <= this.totalLikesRecorded) {
        return 0; // Stale or duplicate cumulative count
      }
      const delta = count - this.totalLikesRecorded;
      this.totalLikesRecorded = count;
      return delta;
    } else {
      this.totalLikesRecorded += count;
      return count;
    }
  }

  getTotalLikes(): number {
    return this.totalLikesRecorded;
  }

  /**
   * Updates gift streak tracking. Returns current streak number.
   */
  trackGiftStreak(userId: string, giftId: string, reportedStreak: number, isStreakEnd: boolean): number {
    const key = `${userId}:${giftId}`;
    const now = Date.now();

    if (isStreakEnd) {
      const active = this.giftStreaks.get(key);
      this.giftStreaks.delete(key);
      return active ? Math.max(active.count, reportedStreak) : reportedStreak;
    }

    const active = this.giftStreaks.get(key);
    // If last event was within 10 seconds, increment or update
    const streak = (active && (now - active.lastTimestamp < 10_000))
      ? Math.max(active.count + 1, reportedStreak)
      : reportedStreak;

    this.giftStreaks.set(key, { count: streak, lastTimestamp: now });
    return streak;
  }

  private _checkRateLimit(userId: string, now: number): boolean {
    const windowStart = now - 1000; // 1-second sliding window
    let timestamps = this.rateLimitMap.get(userId) ?? [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= this.rateLimitPerSec) {
      return false;
    }

    timestamps.push(now);
    this.rateLimitMap.set(userId, timestamps);
    return true;
  }

  private _pruneDedup(now: number): void {
    const cutoff = now - this.dedupTtlMs;
    for (const [id, time] of this.dedupMap) {
      if (time < cutoff) {
        this.dedupMap.delete(id);
      }
    }
  }
}
