import { describe, it, expect } from 'vitest';
import {
  createCrystalClusterGeometry,
  createCrystallineGatewayGeometry,
  createPrismaticShardGeometry,
  createCrystalStalactiteGeometry,
} from '../src/procedural/CrystalClusterGenerator';

describe('CrystalClusterGenerator', () => {
  it('creates multi-spire crystal geode cluster with normal and color attributes', () => {
    const geo = createCrystalClusterGeometry(101);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['normal']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    expect(geo.attributes['position']!.count).toBeGreaterThan(100);
    geo.dispose();
  });

  it('creates grand hexagonal crystalline gateway with valid geometry', () => {
    const geo = createCrystallineGatewayGeometry(202);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['normal']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    expect(geo.attributes['position']!.count).toBeGreaterThan(150);
    geo.dispose();
  });

  it('creates zero-g prismatic shard with vertex colors', () => {
    const geo = createPrismaticShardGeometry(303);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['normal']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    expect(geo.attributes['position']!.count).toBeGreaterThan(12);
    geo.dispose();
  });

  it('creates ceiling quartz stalactite needle cluster pointing downward', () => {
    const geo = createCrystalStalactiteGeometry(404);
    expect(geo.attributes['position']).toBeDefined();
    expect(geo.attributes['normal']).toBeDefined();
    expect(geo.attributes['color']).toBeDefined();
    expect(geo.attributes['position']!.count).toBeGreaterThan(80);
    geo.dispose();
  });
});
