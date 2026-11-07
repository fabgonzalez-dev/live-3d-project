import { describe, it, expect, beforeEach } from 'vitest';
import { EventEngine } from '../server/engine/EventEngine';
import type { NormalizedEvent } from '../src/shared/events';

describe('EventEngine', () => {
  let engine: EventEngine;

  beforeEach(() => {
    engine = new EventEngine({ maxQueueSize: 5, dedupTtlMs: 500, rateLimitPerSec: 3 });
  });

  describe('Bounded Queue', () => {
    it('enforces maximum queue capacity by dropping oldest events', () => {
      for (let i = 0; i < 8; i++) {
        const ev: NormalizedEvent = {
          id: `ev-${i}`,
          provider: 'simulator',
          receivedAt: Date.now(),
          type: 'chat',
          payload: { text: `Message ${i}`, isCommand: false },
        };
        engine.ingest(ev);
      }

      expect(engine.getQueueSize()).toBe(5);
      const first = engine.poll();
      expect(first?.id).toBe('ev-3'); // ev-0, ev-1, ev-2 were dropped
    });
  });

  describe('Deduplication', () => {
    it('drops duplicate events with same providerEventId within TTL', () => {
      const ev1: NormalizedEvent = {
        id: '1',
        providerEventId: 'tiktok-event-100',
        provider: 'simulator',
        receivedAt: Date.now(),
        type: 'like',
        payload: { count: 1, isCumulative: false },
      };
      const ev2: NormalizedEvent = {
        id: '2',
        providerEventId: 'tiktok-event-100', // duplicate
        provider: 'simulator',
        receivedAt: Date.now(),
        type: 'like',
        payload: { count: 1, isCumulative: false },
      };

      expect(engine.ingest(ev1)).toBe(true);
      expect(engine.ingest(ev2)).toBe(false);
      expect(engine.getQueueSize()).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    it('rate limits users exceeding threshold events per second', () => {
      const makeEvent = (id: string): NormalizedEvent => ({
        id,
        userId: 'spammer_user',
        provider: 'simulator',
        receivedAt: Date.now(),
        type: 'chat',
        payload: { text: 'spam', isCommand: false },
      });

      expect(engine.ingest(makeEvent('1'))).toBe(true);
      expect(engine.ingest(makeEvent('2'))).toBe(true);
      expect(engine.ingest(makeEvent('3'))).toBe(true);
      // 4th event exceeds rateLimitPerSec: 3
      expect(engine.ingest(makeEvent('4'))).toBe(false);
    });
  });

  describe('XSS Sanitization', () => {
    it('strips dangerous HTML and script tags from text inputs', () => {
      const raw = '<script>alert("XSS")</script>&foo=\'bar\'';
      const sanitized = EventEngine.sanitizeText(raw);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&amp;foo=&#39;bar&#39;');
    });
  });

  describe('Like Processing', () => {
    it('computes correct delta when platform reports cumulative like counts', () => {
      expect(engine.processLikes(100, true)).toBe(100);
      expect(engine.processLikes(125, true)).toBe(25);
      expect(engine.processLikes(125, true)).toBe(0); // duplicate/stale count
      expect(engine.processLikes(90, true)).toBe(0);  // out of order count
      expect(engine.processLikes(150, true)).toBe(25);
      expect(engine.getTotalLikes()).toBe(150);
    });

    it('accumulates discrete like increments', () => {
      expect(engine.processLikes(5, false)).toBe(5);
      expect(engine.processLikes(10, false)).toBe(10);
      expect(engine.getTotalLikes()).toBe(15);
    });
  });

  describe('Gift Streak Tracking', () => {
    it('tracks incremental streaks and resolves streak on completion', () => {
      const user = 'user_1';
      const gift = 'rose';

      expect(engine.trackGiftStreak(user, gift, 1, false)).toBe(1);
      expect(engine.trackGiftStreak(user, gift, 2, false)).toBe(2);
      expect(engine.trackGiftStreak(user, gift, 3, false)).toBe(3);
      // Streak ends
      const finalStreak = engine.trackGiftStreak(user, gift, 3, true);
      expect(finalStreak).toBe(3);
    });
  });
});
