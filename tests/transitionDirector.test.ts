import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TransitionDirector } from '../src/transitions/TransitionDirector';
import type { SceneLifecycle } from '../src/scenes/SceneLifecycle';

function createMockScene(): SceneLifecycle {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(75, 1, 0.1, 100),
    initialize: vi.fn(),
    update: vi.fn(),
    resize: vi.fn(),
    applyPalette: vi.fn(),
    applyVisualParams: vi.fn(),
    triggerEffect: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('TransitionDirector', () => {
  it('initializes in idle non-transitioning state', () => {
    const director = new TransitionDirector();
    expect(director.isTransitioning()).toBe(false);
    expect(director.getProgress()).toBe(0);
    director.dispose();
  });

  it('manages transition lifecycle from sceneFrom to sceneTo', () => {
    const director = new TransitionDirector();
    const from = createMockScene();
    const to = createMockScene();
    const onComplete = vi.fn();

    director.startTransition(from, to, 2.0, 'portal_warp', onComplete);
    expect(director.isTransitioning()).toBe(true);

    // Step halfway
    director.update(1.0, 1.0);
    expect(director.isTransitioning()).toBe(true);
    expect(director.getProgress()).toBeCloseTo(0.5, 1);
    expect(from.update).toHaveBeenCalled();
    expect(to.update).toHaveBeenCalled();

    // Step to completion
    director.update(1.1, 2.1);
    expect(director.isTransitioning()).toBe(false);
    expect(from.dispose).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(to);

    director.dispose();
  });

  it('supports multiple transition techniques without error', () => {
    const director = new TransitionDirector();
    const from = createMockScene();
    const to = createMockScene();

    director.startTransition(from, to, 1.0, 'atmospheric_dissolve');
    expect(director.isTransitioning()).toBe(true);
    director.update(1.1, 1.1);
    expect(director.isTransitioning()).toBe(false);

    director.dispose();
  });
});
