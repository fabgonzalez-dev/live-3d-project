import { describe, it, expect } from 'vitest';
import {
  createCarvedRunePortalGeometry,
  createAncientGrandfatherTreeGeometry,
  createElderTwistedTreeGeometry,
  createCanopyPillarTreeGeometry,
  createMossyBoulderGeometry,
  createAncientStoneStepGeometry,
} from '../src/procedural/AncientForestGenerator';

describe('AncientForestGenerator Procedural Assets', () => {
  it('generates a valid carved rune portal megalith with vertex colors', () => {
    const geo = createCarvedRunePortalGeometry(505);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['normal']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    expect(geo.attributes['position']!.count).toBeGreaterThan(200);

    // Verify reasonable dimensions (portal opening > 2.5m, outer ring ~ 4m)
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.max.y).toBeGreaterThan(4.0);
    expect(box.max.x).toBeGreaterThan(3.5);
    geo.dispose();
  });

  it('generates an ancient grandfather tree with massive roots and foliage', () => {
    const geo = createAncientGrandfatherTreeGeometry(101);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();

    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    // Towering canopy height > 12m
    expect(box.max.y).toBeGreaterThan(12.0);
    // Buttress root spread > 2.5m
    expect(box.max.x).toBeGreaterThan(2.5);
    geo.dispose();
  });

  it('generates elder twisted trees and canopy pillar trees with valid bounds', () => {
    const elder = createElderTwistedTreeGeometry(202);
    expect(elder.attributes['position']!.count).toBeGreaterThan(100);
    elder.dispose();

    const pillar = createCanopyPillarTreeGeometry(303);
    pillar.computeBoundingBox();
    expect(pillar.boundingBox!.max.y).toBeGreaterThan(10.0);
    pillar.dispose();
  });

  it('generates mossy boulders and ancient pathway stone steps', () => {
    const boulder = createMossyBoulderGeometry(404);
    expect(boulder.attributes['color']).toBeDefined();
    boulder.dispose();

    const step = createAncientStoneStepGeometry();
    expect(step.attributes['position']).toBeDefined();
    step.computeBoundingBox();
    // Path width ~ 4.6m
    expect(step.boundingBox!.max.x - step.boundingBox!.min.x).toBeGreaterThan(4.0);
    step.dispose();
  });
});
