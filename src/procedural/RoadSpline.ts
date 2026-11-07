/**
 * procedural/RoadSpline.ts
 * Parametric road spline defining gentle curving paths, vertical elevation,
 * tangent vectors, lateral binormals, and banking for infinite traversal.
 */

import * as THREE from 'three';

export interface SplinePoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  binormal: THREE.Vector3;
  normal: THREE.Vector3;
  curvature: number;
}

export class RoadSpline {
  // Grand, sweeping alpine highway curves for meditative cruising
  private ampX1 = 5.2;
  private freqX1 = 0.009;
  private ampX2 = 2.4;
  private freqX2 = 0.018;

  private ampY1 = 1.4;
  private freqY1 = 0.007;
  private ampY2 = 0.6;
  private freqY2 = 0.016;

  // Reusable temporaries for zero garbage
  private readonly _pos = new THREE.Vector3();
  private readonly _tan = new THREE.Vector3();
  private readonly _bin = new THREE.Vector3();
  private readonly _norm = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  /**
   * Evaluate road centerline coordinate at longitudinal distance z.
   */
  getPositionAt(worldZ: number, out = this._pos): THREE.Vector3 {
    const x = Math.sin(worldZ * this.freqX1) * this.ampX1 +
              Math.sin(worldZ * this.freqX2) * this.ampX2;

    const y = Math.cos(worldZ * this.freqY1) * this.ampY1 +
              Math.sin(worldZ * this.freqY2) * this.ampY2;

    out.set(x, y, worldZ);
    return out;
  }

  /**
   * Evaluate forward tangent vector at worldZ using analytic derivatives.
   */
  getTangentAt(worldZ: number, out = this._tan): THREE.Vector3 {
    // dx/dz
    const dx = Math.cos(worldZ * this.freqX1) * this.ampX1 * this.freqX1 +
               Math.cos(worldZ * this.freqX2) * this.ampX2 * this.freqX2;

    // dy/dz
    const dy = -Math.sin(worldZ * this.freqY1) * this.ampY1 * this.freqY1 +
                Math.cos(worldZ * this.freqY2) * this.ampY2 * this.freqY2;

    // dz/dz is negative forward in Three.js (camera looks down -Z)
    out.set(-dx, -dy, -1.0).normalize();
    return out;
  }

  /**
   * Evaluate full Frenet frame (position, tangent, binormal, normal, curvature) at worldZ.
   */
  getFrameAt(worldZ: number, out?: SplinePoint): SplinePoint {
    const p = this.getPositionAt(worldZ, out ? out.position : this._pos);
    const t = this.getTangentAt(worldZ, out ? out.tangent : this._tan);

    // Lateral binormal = tangent x worldUp
    const b = (out ? out.binormal : this._bin).crossVectors(t, this._up).normalize();

    // Road normal = binormal x tangent
    const n = (out ? out.normal : this._norm).crossVectors(b, t).normalize();

    // Curvature approximation: second derivative d2x/dz2
    const d2x = -Math.sin(worldZ * this.freqX1) * this.ampX1 * this.freqX1 * this.freqX1 -
                 Math.sin(worldZ * this.freqX2) * this.ampX2 * this.freqX2 * this.freqX2;

    return {
      position: p,
      tangent: t,
      binormal: b,
      normal: n,
      curvature: d2x,
    };
  }

  /**
   * Evaluate terrain height at arbitrary (x, z), smoothly matching the road elevation
   * with raised roadside snowbanks (plowed berms) and rolling forest floor.
   */
  getTerrainHeight(worldX: number, worldZ: number, roadWidth = 6.8): number {
    const roadP = this.getPositionAt(worldZ);
    const distFromCenter = Math.abs(worldX - roadP.x);
    const halfRoad = roadWidth * 0.5;

    if (distFromCenter <= halfRoad) {
      // Direct asphalt driving surface
      return roadP.y;
    }

    const shoulderDist = distFromCenter - halfRoad;
    // 0 to 1.2m: gravel shoulder flush with asphalt
    if (shoulderDist < 1.2) {
      return roadP.y + (shoulderDist / 1.2) * 0.08;
    }

    // 1.2 to 4.5m: raised plowed snowbank / berm (+0.55m peak)
    if (shoulderDist < 4.5) {
      const t = (shoulderDist - 1.2) / 3.3;
      const berm = Math.sin(t * Math.PI) * 0.55 + t * 0.25;
      return roadP.y + 0.08 + berm;
    }

    // Beyond snowbank: rolling alpine snow hills with natural snowdrifts
    const flankDist = shoulderDist - 4.5;
    const blendT = Math.min(flankDist / 6.0, 1.0);
    const hills = Math.sin(worldX * 0.06 + worldZ * 0.02) * 1.8 +
                  Math.cos(worldX * 0.03 - worldZ * 0.035) * 1.3;

    return roadP.y + 0.33 + blendT * Math.max(0, hills);
  }
}
