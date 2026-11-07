/**
 * server/engine/GiftEffectEngine.ts
 * Milestone D — Authoritative Gift & Like Milestone Trigger Engine.
 *
 * Responsibilities:
 * - Maps gift tiers and like milestones to visual scene triggers.
 * - Enforces cooldowns and duration bounds to prevent visual fatigue/flashing.
 * - Provides structured trigger payloads consumed by SceneLifecycle.triggerEffect().
 */

export type TriggerEffectName = 'sparkle_wave' | 'constellation_flash' | 'aurora_veil';

export interface VisualTrigger {
  id: string;
  effectName: TriggerEffectName;
  durationMs: number;
  intensity: number;      // 0..2
  senderName?: string;
  giftName?: string;
  triggeredAt: number;
}

export class GiftEffectEngine {
  private lastTriggerTime: Record<TriggerEffectName, number> = {
    sparkle_wave: 0,
    constellation_flash: 0,
    aurora_veil: 0,
  };

  // Cooldowns per effect type in milliseconds
  private readonly cooldowns: Record<TriggerEffectName, number> = {
    sparkle_wave: 250,        // fast, light
    constellation_flash: 1200,// medium
    aurora_veil: 6000,        // large cinematic effect
  };

  /**
   * Resolves a gift to a visual trigger effect.
   */
  resolveGift(giftName: string, streakCount = 1, senderName = 'Viewer'): VisualTrigger | null {
    const nameLower = giftName.toLowerCase();
    const now = Date.now();

    let effect: TriggerEffectName = 'sparkle_wave';
    let duration = 2000;
    let intensity = 1.0;

    // High-tier gifts
    if (
      nameLower.includes('galaxy') ||
      nameLower.includes('universe') ||
      nameLower.includes('dragon') ||
      nameLower.includes('lion') ||
      nameLower.includes('whale') ||
      streakCount >= 50
    ) {
      effect = 'aurora_veil';
      duration = 6000;
      intensity = 1.8;
    }
    // Mid-tier gifts
    else if (
      nameLower.includes('confetti') ||
      nameLower.includes('doughnut') ||
      nameLower.includes('corgi') ||
      nameLower.includes('fireworks') ||
      streakCount >= 10
    ) {
      effect = 'constellation_flash';
      duration = 3000;
      intensity = 1.4;
    }
    // Low-tier gifts (Rose, Heart, etc.)
    else {
      effect = 'sparkle_wave';
      duration = 1800;
      intensity = 1.0 + Math.min(streakCount * 0.05, 0.5);
    }

    // Check cooldown
    if (now - this.lastTriggerTime[effect] < this.cooldowns[effect]) {
      // If higher tier is on cooldown, downgrade to sparkle wave if off cooldown
      if (effect !== 'sparkle_wave' && now - this.lastTriggerTime.sparkle_wave >= this.cooldowns.sparkle_wave) {
        effect = 'sparkle_wave';
        duration = 1800;
        intensity = 1.0;
      } else {
        return null; // Rate-limited
      }
    }

    this.lastTriggerTime[effect] = now;

    return {
      id: `trig-${now}-${Math.random().toString(36).slice(2, 8)}`,
      effectName: effect,
      durationMs: duration,
      intensity,
      senderName,
      giftName,
      triggeredAt: now,
    };
  }

  /**
   * Resolves like milestone surges.
   */
  resolveLikes(deltaLikes: number): VisualTrigger | null {
    const now = Date.now();
    if (deltaLikes >= 25 && now - this.lastTriggerTime.sparkle_wave >= this.cooldowns.sparkle_wave) {
      this.lastTriggerTime.sparkle_wave = now;
      return {
        id: `trig-like-${now}`,
        effectName: 'sparkle_wave',
        durationMs: 1500,
        intensity: Math.min(1.0 + deltaLikes * 0.01, 1.6),
        giftName: `${deltaLikes} Likes`,
        triggeredAt: now,
      };
    }
    return null;
  }
}
