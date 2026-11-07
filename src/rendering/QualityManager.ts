/**
 * rendering/QualityManager.ts
 * Centralized renderer configuration & adaptive quality system.
 * Governs resolution scale, particle budget, bloom passes, anti-aliasing, and geometry detail.
 */

import type { RenderingManager } from './RenderingManager';
import type { VisualParams } from '../state/types';

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityProfile {
  name: QualityLevel;
  renderScale: number;
  maxPixelRatio: number;
  bloomQuality: 'off' | 'low' | 'medium' | 'high';
  bloomStrengthMultiplier: number;
  bloomRadius: number;
  particleBudget: number;
  geometryDetailMultiplier: number;
  fxaaEnabled: boolean;
  postProcessingQuality: 'minimal' | 'balanced' | 'cinematic';
  targetFps: 30 | 60;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    name: 'low',
    renderScale: 0.60,
    maxPixelRatio: 1.0,
    bloomQuality: 'low',
    bloomStrengthMultiplier: 0.7,
    bloomRadius: 0.35,
    particleBudget: 2000,
    geometryDetailMultiplier: 0.6,
    fxaaEnabled: false,
    postProcessingQuality: 'minimal',
    targetFps: 30,
  },
  medium: {
    name: 'medium',
    renderScale: 0.75,
    maxPixelRatio: 1.25,
    bloomQuality: 'medium',
    bloomStrengthMultiplier: 0.85,
    bloomRadius: 0.40,
    particleBudget: 8000,
    geometryDetailMultiplier: 0.8,
    fxaaEnabled: true,
    postProcessingQuality: 'balanced',
    targetFps: 30,
  },
  high: {
    name: 'high',
    renderScale: 0.90,
    maxPixelRatio: 1.5,
    bloomQuality: 'high',
    bloomStrengthMultiplier: 1.0,
    bloomRadius: 0.45,
    particleBudget: 16000,
    geometryDetailMultiplier: 1.0,
    fxaaEnabled: true,
    postProcessingQuality: 'cinematic',
    targetFps: 60,
  },
  ultra: {
    name: 'ultra',
    renderScale: 1.0,
    maxPixelRatio: 2.0,
    bloomQuality: 'high',
    bloomStrengthMultiplier: 1.15,
    bloomRadius: 0.50,
    particleBudget: 32000,
    geometryDetailMultiplier: 1.2,
    fxaaEnabled: true,
    postProcessingQuality: 'cinematic',
    targetFps: 60,
  },
};

const LEVEL_ORDER: QualityLevel[] = ['ultra', 'high', 'medium', 'low'];

/** Performance adaptation thresholds (ms) */
const DOWNGRADE_THRESHOLD_MS = 38; // < 26 fps triggers downgrade
const UPGRADE_THRESHOLD_MS = 22;   // > 45 fps triggers upgrade
const HOLD_FRAMES = 90;
const HYSTERESIS_FRAMES = 180;

export class QualityManager {
  currentLevel: QualityLevel = 'high';
  renderScale = 1.0;
  maxPixelRatio = 1.5;

  private _autoAdaptive = true;
  private _framesSinceChange = 0;
  private _rendering: RenderingManager;
  private _listeners: Array<(profile: QualityProfile) => void> = [];

  constructor(rendering: RenderingManager, initial: VisualParams) {
    this._rendering = rendering;
    this.renderScale = initial.renderScale;
    const initialPreset = (initial.qualityPreset as QualityLevel) || 'high';
    this.setQualityPreset(initialPreset, false);
  }

  getProfile(): QualityProfile {
    return QUALITY_PROFILES[this.currentLevel];
  }

  onQualityChange(fn: (profile: QualityProfile) => void): () => void {
    this._listeners.push(fn);
    return () => {
      const idx = this._listeners.indexOf(fn);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  setAutoAdaptive(enabled: boolean): void {
    this._autoAdaptive = enabled;
  }

  isAutoAdaptive(): boolean {
    return this._autoAdaptive;
  }

  /** Call every frame with raw dt (seconds) */
  update(dt: number): void {
    if (!this._autoAdaptive) return;
    this._framesSinceChange++;
    if (this._framesSinceChange < HOLD_FRAMES) return;

    const ftMs = dt * 1000;
    const idx = LEVEL_ORDER.indexOf(this.currentLevel);

    if (ftMs > DOWNGRADE_THRESHOLD_MS && idx < LEVEL_ORDER.length - 1) {
      this._applyLevel(LEVEL_ORDER[idx + 1]!);
    } else if (ftMs < UPGRADE_THRESHOLD_MS && idx > 0 && this._framesSinceChange > HYSTERESIS_FRAMES) {
      this._applyLevel(LEVEL_ORDER[idx - 1]!);
    }
  }

  setQualityPreset(level: QualityLevel, disableAuto = true): void {
    if (disableAuto) {
      this._autoAdaptive = false;
    }
    this._applyLevel(level);
  }

  applyRenderScale(scale: number): void {
    this.renderScale = Math.max(0.5, Math.min(1.0, scale));
    window.dispatchEvent(new Event('resize'));
  }

  private _applyLevel(level: QualityLevel): void {
    this.currentLevel = level;
    this._framesSinceChange = 0;
    const profile = QUALITY_PROFILES[level];

    this.renderScale = profile.renderScale;
    this.maxPixelRatio = profile.maxPixelRatio;

    // Apply pixel ratio to renderer
    this._rendering.renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.maxPixelRatio));

    // Notify listeners (e.g. scenes adjusting geometry/particles)
    for (const listener of this._listeners) {
      listener(profile);
    }

    // Trigger full resize pass
    window.dispatchEvent(new Event('resize'));
  }
}
