/**
 * scenes/SceneLifecycle.ts
 * Contract that all visual scenes must implement.
 */
import type * as THREE from 'three';
import type { VisualParams, PaletteDefinition } from '../state/types';
import type { AudioBands } from '../audio/AudioAnalyser';

export interface SceneLifecycle {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  initialize(): void;
  update(dt: number, elapsed: number, audio?: AudioBands): void;
  resize(width: number, height: number): void;
  applyPalette(palette: PaletteDefinition, transitionT: number, prevPalette?: PaletteDefinition): void;
  applyVisualParams(params: VisualParams): void;
  triggerEffect(effectName: string, params?: Record<string, unknown>): void;
  dispose(): void;
}
