import { describe, it, expect } from 'vitest';
import { RoadSpline } from '../src/procedural/RoadSpline';

describe('RoadSpline Procedural Engine', () => {
  const spline = new RoadSpline();

  it('evaluates smooth, bounded positions along longitudinal coordinate z', () => {
    for (let z = -200; z <= 200; z += 20) {
      const pos = spline.getPositionAt(z);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
      expect(pos.z).toBe(z);
      // Gentle curve bounds
      expect(Math.abs(pos.x)).toBeLessThanOrEqual(10.0);
      expect(Math.abs(pos.y)).toBeLessThanOrEqual(3.0);
    }
  });

  it('evaluates normalized forward tangents', () => {
    for (let z = -100; z <= 100; z += 25) {
      const tan = spline.getTangentAt(z);
      expect(Math.abs(tan.length() - 1.0)).toBeLessThan(1e-4);
      // Points in negative forward direction
      expect(tan.z).toBeLessThan(0);
    }
  });

  it('produces an orthonormal Frenet coordinate frame', () => {
    for (let z = -50; z <= 50; z += 15) {
      const frame = spline.getFrameAt(z);

      expect(Math.abs(frame.tangent.length() - 1.0)).toBeLessThan(1e-3);
      expect(Math.abs(frame.binormal.length() - 1.0)).toBeLessThan(1e-3);
      expect(Math.abs(frame.normal.length() - 1.0)).toBeLessThan(1e-3);

      // Orthogonality: dot product of tangent and binormal is 0
      expect(Math.abs(frame.tangent.dot(frame.binormal))).toBeLessThan(1e-3);
      expect(Math.abs(frame.tangent.dot(frame.normal))).toBeLessThan(1e-3);
    }
  });

  it('blends terrain height continuously with road elevation at the asphalt center', () => {
    const z = -45;
    const roadP = spline.getPositionAt(z);
    const terrainCenter = spline.getTerrainHeight(roadP.x, z, 6.0);
    expect(Math.abs(terrainCenter - roadP.y)).toBeLessThan(1e-3);

    // Flanking hills outside road shoulder are non-negative relative to road
    const terrainFlank = spline.getTerrainHeight(roadP.x + 25.0, z, 6.0);
    expect(terrainFlank).toBeGreaterThanOrEqual(roadP.y);
  });
});
