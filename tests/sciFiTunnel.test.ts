import { describe, it, expect } from 'vitest';
import {
  createArchitecturalConduitRingGeometry,
  createRotatingApertureRingGeometry,
  createCyberTrackSegmentGeometry,
  createFloatingTechPanelGeometry,
} from '../src/procedural/SciFiTunnelGenerator';

describe('SciFiTunnelGenerator Procedural Components', () => {
  it('generates an architectural conduit ring with collars and vertex colors', () => {
    const geo = createArchitecturalConduitRingGeometry(505);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['normal']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    expect(geo.attributes['position']!.count).toBeGreaterThan(150);

    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    // Ring radius ~ 6.8m
    expect(box.max.y).toBeGreaterThan(6.0);
    expect(box.max.x).toBeGreaterThan(6.0);
    geo.dispose();
  });

  it('generates a concentric inner rotating aperture ring with shutter teeth', () => {
    const geo = createRotatingApertureRingGeometry(606);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();

    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    expect(box.max.y).toBeGreaterThan(5.0);
    geo.dispose();
  });

  it('generates a multi-rail cybernetic highway track segment', () => {
    const geo = createCyberTrackSegmentGeometry();
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();

    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    // Track width ~ 3.6m
    expect(box.max.x - box.min.x).toBeGreaterThan(3.0);
    geo.dispose();
  });

  it('generates floating hexagonal tech panels with sensor lenses', () => {
    const geo = createFloatingTechPanelGeometry(707);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    geo.dispose();
  });
});
