import { describe, it, expect, beforeEach } from 'vitest';
import { GiftEffectEngine } from '../server/engine/GiftEffectEngine';

describe('GiftEffectEngine', () => {
  let engine: GiftEffectEngine;

  beforeEach(() => {
    engine = new GiftEffectEngine();
  });

  describe('Tier Mapping', () => {
    it('maps standard low-tier gifts to sparkle_wave', () => {
      const trig = engine.resolveGift('Rose', 1, 'Alice');
      expect(trig).not.toBeNull();
      expect(trig?.effectName).toBe('sparkle_wave');
      expect(trig?.senderName).toBe('Alice');
      expect(trig?.giftName).toBe('Rose');
    });

    it('maps mid-tier gifts and streak >= 10 to constellation_flash', () => {
      const trig = engine.resolveGift('Confetti', 1, 'Bob');
      expect(trig).not.toBeNull();
      expect(trig?.effectName).toBe('constellation_flash');
    });

    it('maps high-tier gifts (Galaxy, Dragon) or streak >= 50 to aurora_veil', () => {
      const trig = engine.resolveGift('Galaxy', 1, 'Charlie');
      expect(trig).not.toBeNull();
      expect(trig?.effectName).toBe('aurora_veil');
      expect(trig?.durationMs).toBe(6000);
    });
  });

  describe('Like Milestone Triggers', () => {
    it('triggers sparkle_wave when delta likes >= 25', () => {
      const trig = engine.resolveLikes(50);
      expect(trig).not.toBeNull();
      expect(trig?.effectName).toBe('sparkle_wave');
    });

    it('does not trigger on small like increments (< 25)', () => {
      const trig = engine.resolveLikes(5);
      expect(trig).toBeNull();
    });
  });
});
